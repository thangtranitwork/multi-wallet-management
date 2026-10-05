import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { getCloudinaryConfig, uploadToCloudinary } from '../services/cloudinaryService';
import { useSecurity } from '../context/SecurityContext';
import { Wallet } from '../types';
import { THEME, formatVND } from '../constants';
import { findBankByBin } from '../constants/banks';
import { hapticLight, hapticSuccess, hapticError } from '../utils/haptics';
import { useCustomAlert } from './CustomAlertModal';
import { hasWalletQR } from '../utils/debtUtils';

interface WalletQRModalProps {
  visible: boolean;
  onClose: () => void;
  wallet: Wallet | null;
  amount?: number;
  purpose?: string;
  title?: string;
  onConfigureWallet?: (walletId: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const QR_BOX_SIZE = Math.min(SCREEN_WIDTH - 64, 320);

export const WalletQRModal: React.FC<WalletQRModalProps> = ({
  visible,
  onClose,
  wallet,
  amount = 0,
  purpose = '',
  title,
  onConfigureWallet,
}) => {
  const { wallets, editWallet } = useWallet();
  const { temporarilyBypassLock } = useSecurity();
  const { showAlert, showConfirm, AlertModalComponent } = useCustomAlert(false);
  const db = useSQLiteContext();

  const [selectedWalletId, setSelectedWalletId] = React.useState<string>(wallet?.id || '');

  React.useEffect(() => {
    if (wallet?.id) {
      setSelectedWalletId(wallet.id);
    }
  }, [wallet?.id]);

  if (!wallet) return null;
  const currentWallet = wallets.find(w => w.id === selectedWalletId) || wallet;

  const transferNote = purpose ? `Tra tien ${purpose}`.trim() : '';
  const vietQrUrl = (currentWallet.bank_bin && currentWallet.bank_account)
    ? `https://img.vietqr.io/image/${currentWallet.bank_bin}-${currentWallet.bank_account}-compact2.png?amount=${Math.round(amount || 0)}${transferNote ? `&addInfo=${encodeURIComponent(transferNote.slice(0, 25))}` : ''}`
    : null;
  const bankInfo = findBankByBin(currentWallet.bank_bin);

  const hasVietQr = !!vietQrUrl;
  const hasCustomImage = !!currentWallet.qr_image_uri;
  const [activeTab, setActiveTab] = React.useState<'vietqr' | 'custom'>(hasVietQr ? 'vietqr' : 'custom');

  React.useEffect(() => {
    if (hasVietQr) {
      setActiveTab('vietqr');
    } else if (hasCustomImage) {
      setActiveTab('custom');
    }
  }, [hasVietQr, hasCustomImage, selectedWalletId]);

  const handlePickQRImage = async () => {
    try {
      temporarilyBypassLock(120000);
      hapticLight();
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showAlert('Cần quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh để tải lên mã QR.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const src = result.assets[0].uri;
        let finalUri = src;

        try {
          const cfg = await getCloudinaryConfig(db);
          if (cfg.enabled && cfg.cloudName && cfg.uploadPreset) {
            const uploadRes = await uploadToCloudinary(src, cfg, 'multi_wallet_qrs');
            if (uploadRes.secureUrl) {
              finalUri = uploadRes.secureUrl;
            }
          }
        } catch (e) {
          console.warn('Lỗi tải QR lên Cloudinary:', e);
        }

        if (finalUri === src) {
          const qrDir = `${FileSystem.documentDirectory}wallet_qrs/`;
          const dirInfo = await FileSystem.getInfoAsync(qrDir);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(qrDir, { intermediates: true });
          }

          const ext = src.split('.').pop() || 'jpg';
          finalUri = `${qrDir}qr_${currentWallet.id}_${Date.now()}.${ext}`;
          await FileSystem.copyAsync({ from: src, to: finalUri });
        }

        // Cập nhật ví
        await editWallet({
          id: currentWallet.id,
          qr_image_uri: finalUri,
        });

        hapticSuccess();
      }
    } catch (err: any) {
      hapticError();
      showAlert('Lỗi', err?.message || 'Không thể chọn ảnh mã QR');
    }
  };

  const handleRemoveQRImage = () => {
    showConfirm(
      'Xóa ảnh mã QR',
      `Bạn có chắc muốn xóa ảnh mã QR của ví "${currentWallet.name}"?`,
      async () => {
        try {
          if (currentWallet.qr_image_uri) {
            try {
              await FileSystem.deleteAsync(currentWallet.qr_image_uri, { idempotent: true });
            } catch {}
          }
          await editWallet({
            id: currentWallet.id,
            qr_image_uri: null,
          });
          hapticSuccess();
        } catch (err: any) {
          showAlert('Lỗi', err?.message || 'Không thể xóa ảnh mã QR');
        }
      },
      { destructive: true, confirmText: 'Xóa ảnh' }
    );
  };

  const handleShareImage = async () => {
    try {
      temporarilyBypassLock(120000);
      hapticLight();
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        showAlert('Không hỗ trợ', 'Tính năng chia sẻ không khả dụng trên thiết bị này.');
        return;
      }

      if (activeTab === 'vietqr' && vietQrUrl) {
        const dest = `${FileSystem.cacheDirectory}vietqr_${currentWallet.id}_${Date.now()}.png`;
        const downloadRes = await FileSystem.downloadAsync(vietQrUrl, dest);
        await Sharing.shareAsync(downloadRes.uri, {
          dialogTitle: `Mã VietQR ${currentWallet.name}`,
          mimeType: 'image/png',
        });
        return;
      }

      if (currentWallet.qr_image_uri) {
        await Sharing.shareAsync(currentWallet.qr_image_uri, {
          dialogTitle: `Mã QR ${currentWallet.name}`,
          mimeType: 'image/jpeg',
        });
      }
    } catch (err: any) {
      // User cancelled
    }
  };

  const handleCopyText = async (text: string, label: string) => {
    hapticSuccess();
    await Clipboard.setStringAsync(text);
    showAlert('Đã sao chép', `Đã sao chép ${label}: ${text}`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title || `MÃ QR: ${currentWallet.name.toUpperCase()}`}
              </Text>
              <Text style={styles.headerSub}>Quét mã để nhận tiền hoặc thanh toán</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color="#000000" />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Wallet Picker if multiple wallets */}
            {wallets.length > 1 && (
              <View style={styles.walletPickerSection}>
                <View style={styles.walletPickerHeader}>
                  <Ionicons name="wallet-outline" size={13} color="#000000" />
                  <Text style={styles.walletPickerLabel}>Ví nhận thanh toán</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.walletChipsRow}
                >
                  {wallets.map(w => {
                    const isSelected = w.id === currentWallet.id;
                    const wHasQR = hasWalletQR(w);
                    return (
                      <Pressable
                        key={w.id}
                        style={[
                          styles.walletChip,
                          isSelected && styles.walletChipSelected,
                        ]}
                        onPress={() => {
                          hapticLight();
                          setSelectedWalletId(w.id);
                        }}
                      >
                        <Text
                          style={[
                            styles.walletChipText,
                            isSelected && styles.walletChipTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {w.name}
                        </Text>
                        {wHasQR ? (
                          <View style={[styles.qrDot, isSelected && styles.qrDotSelected]}>
                            <Ionicons name="qr-code" size={10} color={isSelected ? '#000000' : '#15803D'} />
                          </View>
                        ) : (
                          <Text style={styles.noQrText}>(không hỗ trợ QR)</Text>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Tab switcher if wallet has both dynamic VietQR and custom uploaded image */}
            {hasVietQr && hasCustomImage && (
              <View style={styles.tabContainer}>
                <Pressable
                  style={[styles.tabBtn, activeTab === 'vietqr' && styles.tabBtnActive]}
                  onPress={() => {
                    hapticLight();
                    setActiveTab('vietqr');
                  }}
                >
                  <Ionicons
                    name="qr-code-outline"
                    size={14}
                    color={activeTab === 'vietqr' ? '#000000' : '#6B7280'}
                  />
                  <Text style={[styles.tabBtnText, activeTab === 'vietqr' && styles.tabBtnTextActive]}>
                    Mã VietQR động
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.tabBtn, activeTab === 'custom' && styles.tabBtnActive]}
                  onPress={() => {
                    hapticLight();
                    setActiveTab('custom');
                  }}
                >
                  <Ionicons
                    name="image-outline"
                    size={14}
                    color={activeTab === 'custom' ? '#000000' : '#6B7280'}
                  />
                  <Text style={[styles.tabBtnText, activeTab === 'custom' && styles.tabBtnTextActive]}>
                    Ảnh QR đã lưu
                  </Text>
                </Pressable>
              </View>
            )}

            {/* 1. Dynamic VietQR Preview */}
            {activeTab === 'vietqr' && vietQrUrl && (
              <View style={styles.imageWrapper}>
                <View style={styles.imageCardShadow}>
                  <View style={styles.imageCardInner}>
                    <Image
                      source={{ uri: vietQrUrl }}
                      style={{ width: QR_BOX_SIZE, height: QR_BOX_SIZE }}
                      resizeMode="contain"
                    />
                  </View>
                </View>

                {/* Bank / E-Wallet Account Details Card */}
                <View style={styles.bankDetailCard}>
                  <View style={styles.bankDetailRow}>
                    <Text style={styles.bankDetailLabel}>
                      {currentWallet.type === 'e_wallet' ? 'Ví / Đơn vị:' : 'Ngân hàng:'}
                    </Text>
                    <Pressable
                      style={styles.copyPill}
                      onPress={() => handleCopyText(bankInfo?.shortName || currentWallet.name || (currentWallet.bank_bin ? `Mã BIN: ${currentWallet.bank_bin}` : ''), currentWallet.type === 'e_wallet' ? 'Tên ví' : 'Tên ngân hàng')}
                    >
                      <Text style={styles.bankDetailVal}>{bankInfo?.shortName || currentWallet.name || (currentWallet.bank_bin ? `Mã BIN: ${currentWallet.bank_bin}` : '')}</Text>
                      <Ionicons name="copy-outline" size={12} color="#000000" />
                    </Pressable>
                  </View>

                  <View style={[styles.bankDetailRow, { marginTop: 6 }]}>
                    <Text style={styles.bankDetailLabel}>
                      {currentWallet.type === 'e_wallet' ? 'Số TK / SĐT ví:' : 'Số tài khoản:'}
                    </Text>
                    <Pressable
                      style={styles.copyPill}
                      onPress={() => handleCopyText(currentWallet.bank_account || '', 'Số tài khoản')}
                    >
                      <Text style={[styles.bankDetailVal, { color: '#047857' }]}>
                        {currentWallet.bank_account}
                      </Text>
                      <Ionicons name="copy-outline" size={12} color="#047857" />
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {/* 2. Custom Uploaded Image QR Preview */}
            {activeTab === 'custom' && currentWallet.qr_image_uri && (
              <View style={styles.imageWrapper}>
                <View style={styles.imageCardShadow}>
                  <View style={styles.imageCardInner}>
                    <Image
                      source={{ uri: currentWallet.qr_image_uri }}
                      style={{ width: QR_BOX_SIZE, height: QR_BOX_SIZE }}
                      resizeMode="contain"
                    />
                  </View>
                </View>

                {/* Quick actions for Image */}
                <View style={styles.imageActionsRow}>
                  <Pressable style={styles.imageMiniBtn} onPress={handlePickQRImage}>
                    <Ionicons name="image-outline" size={15} color="#000000" />
                    <Text style={styles.imageMiniBtnText}>Đổi ảnh khác</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.imageMiniBtn, styles.deleteMiniBtn]}
                    onPress={handleRemoveQRImage}
                  >
                    <Ionicons name="trash-outline" size={15} color="#DC2626" />
                    <Text style={[styles.imageMiniBtnText, { color: '#DC2626' }]}>Xóa ảnh</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* 3. Empty state: Neither VietQR nor Custom Image */}
            {!hasVietQr && !hasCustomImage && (
              <View style={styles.emptyBox}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="qr-code-outline" size={36} color="#000000" />
                </View>
                <Text style={styles.emptyTitle}>Chưa có mã QR thanh toán</Text>
                <Text style={styles.emptyDesc}>
                  {currentWallet.type === 'e_wallet'
                    ? 'Bạn có thể cấu hình số điện thoại / STK ví MoMo, Viettel Money... để tự tạo mã VietQR chuẩn NAPAS 24/7, hoặc tải lên ảnh chụp mã QR từ app ví.'
                    : 'Bạn có thể cấu hình số tài khoản ngân hàng để tự tạo mã VietQR chuẩn NAPAS 24/7, hoặc tải lên ảnh chụp mã QR từ thiết bị.'}
                </Text>

                <View style={{ width: '100%', gap: 10 }}>
                  {onConfigureWallet && (
                    <Pressable
                      style={styles.uploadBtn}
                      onPress={() => {
                        onClose();
                        onConfigureWallet(currentWallet.id);  
                      }}
                    >
                      <Ionicons
                        name={currentWallet.type === 'e_wallet' ? 'phone-portrait-outline' : 'business-outline'}
                        size={18}
                        color="#000000"
                      />
                      <Text style={styles.uploadBtnText}>
                        {currentWallet.type === 'e_wallet' ? 'CẤU HÌNH VÍ & SỐ ĐIỆN THOẠI' : 'CẤU HÌNH NGÂN HÀNG & STK'}
                      </Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={[styles.uploadBtn, { backgroundColor: '#FFFFFF' }]}
                    onPress={handlePickQRImage}
                  >
                    <Ionicons name="cloud-upload-outline" size={18} color="#000000" />
                    <Text style={styles.uploadBtnText}>TẢI LÊN ẢNH MÃ QR TỪ MÁY</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Hint for Amount & Purpose if opened from Debt or Split */}
            {amount > 0 && (
              <View style={styles.infoBox}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Số tiền cần chuyển:</Text>
                  <View style={styles.infoValWithCopy}>
                    <Text style={styles.infoAmountVal}>{formatVND(amount)}</Text>
                    <Pressable
                      style={styles.copyBtn}
                      onPress={() => handleCopyText(Math.round(amount).toString(), 'Số tiền')}
                    >
                      <Ionicons name="copy-outline" size={13} color="#000000" />
                      <Text style={styles.copyBtnText}>Chép</Text>
                    </Pressable>
                  </View>
                </View>

                {purpose ? (
                  <View style={[styles.infoRow, { marginTop: 8 }]}>
                    <Text style={styles.infoLabel}>Nội dung chuyển:</Text>
                    <View style={styles.infoValWithCopy}>
                      <Text style={styles.infoPurposeVal} numberOfLines={1}>
                        {purpose}
                      </Text>
                      <Pressable
                        style={styles.copyBtn}
                        onPress={() => handleCopyText(purpose, 'Nội dung')}
                      >
                        <Ionicons name="copy-outline" size={13} color="#000000" />
                        <Text style={styles.copyBtnText}>Chép</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          {(hasVietQr || hasCustomImage) ? (
            <View style={styles.footer}>
              <Pressable style={styles.shareBtn} onPress={handleShareImage}>
                <Ionicons name="share-social-outline" size={18} color="#000000" />
                <Text style={styles.shareBtnText}>CHIA SẺ ẢNH MÃ QR</Text>
              </Pressable>
            </View>
          ) : null}

          {AlertModalComponent}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 2.5,
    borderColor: '#000000',
    borderBottomWidth: 0,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  bankDetailCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#000000',
    padding: 10,
    marginTop: 8,
  },
  bankDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bankDetailLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  bankDetailVal: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#111827',
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  imageWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  imageCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 20,
    marginBottom: 12,
  },
  imageCardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#000000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  imageActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  imageMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#F1F5F9',
  },
  deleteMiniBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  imageMiniBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  emptyBox: {
    padding: 24,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    marginVertical: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#FFE600',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00E599',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  infoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    flexShrink: 1,
  },
  infoValWithCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoAmountVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#047857',
  },
  infoPurposeVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
    maxWidth: 160,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
  },
  copyBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFE600',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  walletPickerSection: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: '#F3F4F6',
  },
  walletPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  walletPickerLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  walletChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingRight: 10,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  walletChipSelected: {
    backgroundColor: THEME.popYellow,
    shadowColor: '#000000',
    shadowOffset: { width: 1.5, height: 1.5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  walletChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  walletChipTextSelected: {
    color: '#000000',
    fontWeight: '900',
  },
  qrDot: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#15803D',
  },
  qrDotSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#000000',
  },
  noQrText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});
