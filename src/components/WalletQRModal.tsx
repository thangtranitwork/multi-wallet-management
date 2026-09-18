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
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { Wallet } from '../types';
import { THEME, formatVND } from '../constants';
import { hapticLight, hapticSuccess, hapticError } from '../utils/haptics';
import { useCustomAlert } from './CustomAlertModal';

interface WalletQRModalProps {
  visible: boolean;
  onClose: () => void;
  wallet: Wallet | null;
  amount?: number;
  purpose?: string;
  title?: string;
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
}) => {
  const { wallets, editWallet } = useWallet();
  const { showAlert, showConfirm, AlertModalComponent } = useCustomAlert(false);

  if (!wallet) return null;
  const currentWallet = wallets.find(w => w.id === wallet.id) || wallet;

  const handlePickQRImage = async () => {
    try {
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
        const sourceUri = result.assets[0].uri;
        const qrDir = `${FileSystem.documentDirectory}wallet_qrs/`;
        const dirInfo = await FileSystem.getInfoAsync(qrDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(qrDir, { intermediates: true });
        }

        const ext = sourceUri.split('.').pop() || 'jpg';
        const targetUri = `${qrDir}qr_${currentWallet.id}_${Date.now()}.${ext}`;
        await FileSystem.copyAsync({ from: sourceUri, to: targetUri });

        // Cập nhật ví
        await editWallet({
          id: currentWallet.id,
          qr_image_uri: targetUri,
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
      `Ngài có chắc muốn xóa ảnh mã QR của ví "${currentWallet.name}"?`,
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
    if (!currentWallet.qr_image_uri) return;
    try {
      hapticLight();
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        showAlert('Không hỗ trợ', 'Tính năng chia sẻ không khả dụng trên thiết bị này.');
        return;
      }
      await Sharing.shareAsync(currentWallet.qr_image_uri, {
        dialogTitle: `Mã QR ${currentWallet.name}`,
        mimeType: 'image/jpeg',
      });
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
            <View style={{ flex: 1 }}>
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
            {/* QR Image Container */}
            {currentWallet.qr_image_uri ? (
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
            ) : (
              <View style={styles.emptyBox}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="qr-code-outline" size={36} color="#000000" />
                </View>
                <Text style={styles.emptyTitle}>Chưa có ảnh mã QR</Text>
                <Text style={styles.emptyDesc}>
                  Tải lên ảnh chụp màn hình mã QR nhận tiền (từ app ngân hàng, MoMo, ZaloPay, Cake...) để hiển thị nhanh khi cần bạn bè quét tiền.
                </Text>

                <Pressable style={styles.uploadBtn} onPress={handlePickQRImage}>
                  <Ionicons name="cloud-upload-outline" size={18} color="#000000" />
                  <Text style={styles.uploadBtnText}>TẢI LÊN ẢNH MÃ QR</Text>
                </Pressable>
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
          {currentWallet.qr_image_uri ? (
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
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
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
});
