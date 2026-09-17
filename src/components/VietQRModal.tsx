import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { QRCodeSvg } from './QRCodeSvg';
import { generateVietQRPayload } from '../utils/vietQr';
import { VIETNAMESE_BANKS, findBankByBin } from '../constants/banks';
import { THEME, formatVND } from '../constants';
import { hapticLight, hapticSuccess, hapticError } from '../utils/haptics';
import { useCustomAlert } from './CustomAlertModal';

interface VietQRModalProps {
  visible: boolean;
  onClose: () => void;
  defaultWalletId?: string | null;
  amount?: number;
  purpose?: string;
  title?: string;
  personName?: string;
  onConfigureWallet?: (walletId: string) => void;
}

export const VietQRModal: React.FC<VietQRModalProps> = ({
  visible,
  onClose,
  defaultWalletId,
  amount = 0,
  purpose = '',
  title = 'MÃ VIETQR THANH TOÁN',
  personName,
  onConfigureWallet,
}) => {
  const { wallets } = useWallet();
  const { showAlert, AlertModalComponent } = useCustomAlert(false);

  // Danh sách các ví loại bank hoặc các ví có cấu hình ngân hàng
  const eligibleWallets = useMemo(() => {
    return wallets.filter(w => w.type === 'bank' || (w.bank_bin && w.bank_account));
  }, [wallets]);

  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCopiedField(null);
      // Ưu tiên defaultWalletId nếu có tài khoản ngân hàng
      const target = eligibleWallets.find(w => w.id === defaultWalletId && w.bank_account && w.bank_bin);
      if (target) {
        setSelectedWalletId(target.id);
      } else {
        // Hoặc tìm ví đầu tiên đã cấu hình bank_account
        const configured = eligibleWallets.find(w => w.bank_account && w.bank_bin);
        if (configured) {
          setSelectedWalletId(configured.id);
        } else if (defaultWalletId && wallets.find(w => w.id === defaultWalletId)) {
          setSelectedWalletId(defaultWalletId);
        } else if (eligibleWallets.length > 0) {
          setSelectedWalletId(eligibleWallets[0].id);
        } else if (wallets.length > 0) {
          setSelectedWalletId(wallets[0].id);
        }
      }
    }
  }, [visible, defaultWalletId, eligibleWallets, wallets]);

  const currentWallet = wallets.find(w => w.id === selectedWalletId);
  const bankInfo = findBankByBin(currentWallet?.bank_bin);
  const hasBankConfig = !!(currentWallet?.bank_bin && currentWallet?.bank_account);

  // Sinh payload VietQR
  const qrPayload = useMemo(() => {
    if (!hasBankConfig || !currentWallet?.bank_bin || !currentWallet?.bank_account) {
      return '';
    }
    return generateVietQRPayload({
      bankBin: currentWallet.bank_bin,
      accountNumber: currentWallet.bank_account,
      amount: amount > 0 ? amount : undefined,
      purpose: purpose || (personName ? `TRA NO ${personName}` : 'CHUYEN KHOAN'),
    });
  }, [hasBankConfig, currentWallet, amount, purpose, personName]);

  const handleCopy = async (text: string, fieldName: string) => {
    hapticSuccess();
    await Clipboard.setStringAsync(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleShare = async () => {
    if (!currentWallet?.bank_account || !bankInfo) {
      hapticError();
      showAlert('Chưa cấu hình ngân hàng', 'Ví này chưa có thông tin ngân hàng thụ hưởng để chia sẻ.');
      return;
    }

    hapticLight();
    const cleanAmount = amount > 0 ? formatVND(amount) : 'Tùy chọn';
    const cleanPurpose = purpose || (personName ? `TRA NO ${personName}` : 'CHUYEN KHOAN');

    const message = [
      'THÔNG TIN CHUYỂN KHOẢN:',
      `- Ngân hàng: ${bankInfo.shortName} (${bankInfo.name})`,
      `- Số tài khoản: ${currentWallet.bank_account}`,
      `- Chủ tài khoản / Tên ví: ${currentWallet.name}`,
      amount > 0 ? `- Số tiền: ${cleanAmount}` : null,
      `- Nội dung CK: ${cleanPurpose}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await Share.share({
        message,
        title: 'Thông tin chuyển khoản VietQR',
      });
    } catch {
      // User cancelled or error
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSub}>Chuẩn NAPAS 247 - Quét nhận ngay tức thì</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color="#000000" />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Wallet Picker Row if multiple wallets */}
            {wallets.length > 1 && (
              <View style={styles.pickerSection}>
                <Text style={styles.sectionLabel}>VÍ NHẬN TIỀN:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                  {wallets.map(w => {
                    const isSelected = w.id === selectedWalletId;
                    const isConfigured = !!(w.bank_bin && w.bank_account);
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
                        <View style={[styles.walletDot, { backgroundColor: w.color || THEME.primary }]} />
                        <Text style={[styles.walletChipText, isSelected && styles.walletChipTextSelected]}>
                          {w.name}
                        </Text>
                        {!isConfigured && (
                          <View style={styles.warningDot}>
                            <Ionicons name="alert" size={10} color="#FFFFFF" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* If Wallet Not Configured */}
            {!hasBankConfig ? (
              <View style={styles.unconfiguredBox}>
                <Ionicons name="information-circle-outline" size={32} color="#000000" />
                <Text style={styles.unconfiguredTitle}>Chưa cấu hình tài khoản ngân hàng</Text>
                <Text style={styles.unconfiguredDesc}>
                  Ví "{currentWallet?.name || 'này'}" chưa được liên kết Mã ngân hàng và Số tài khoản thụ hưởng để sinh mã VietQR.
                </Text>
                {onConfigureWallet && currentWallet ? (
                  <Pressable
                    style={styles.configBtn}
                    onPress={() => {
                      onClose();
                      onConfigureWallet(currentWallet.id);
                    }}
                  >
                    <Ionicons name="settings-outline" size={16} color="#000000" />
                    <Text style={styles.configBtnText}>Cài đặt STK cho ví này</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <>
                {/* QR Display Card */}
                <View style={styles.qrCard}>
                  <View style={styles.qrFrame}>
                    <QRCodeSvg value={qrPayload} size={220} />
                  </View>

                  {/* NAPAS 247 / VietQR Banner */}
                  <View style={styles.napasBadgeRow}>
                    <View style={styles.napasBadge}>
                      <Text style={styles.napasText}>VIETQR</Text>
                    </View>
                    <View style={[styles.napasBadge, { backgroundColor: '#005baa' }]}>
                      <Text style={[styles.napasText, { color: '#FFFFFF' }]}>NAPAS 247</Text>
                    </View>
                  </View>
                </View>

                {/* Amount Highlight */}
                {amount > 0 && (
                  <View style={styles.amountBox}>
                    <Text style={styles.amountLabel}>SỐ TIỀN CẦN CHUYỂN</Text>
                    <Text style={styles.amountValue}>{formatVND(amount)}</Text>
                  </View>
                )}

                {/* Info Card */}
                <View style={styles.infoCard}>
                  {/* Bank Row */}
                  <View style={styles.infoRow}>
                    <View style={styles.infoLabelCol}>
                      <Ionicons name="business-outline" size={16} color="#6B7280" />
                      <Text style={styles.infoLabel}>Ngân hàng</Text>
                    </View>
                    <Text style={styles.infoValue}>
                      {bankInfo ? bankInfo.shortName : currentWallet?.bank_bin}
                    </Text>
                  </View>

                  {/* Account Number Row */}
                  <View style={styles.infoRowDivider} />
                  <View style={styles.infoRow}>
                    <View style={styles.infoLabelCol}>
                      <Ionicons name="card-outline" size={16} color="#6B7280" />
                      <Text style={styles.infoLabel}>Số tài khoản</Text>
                    </View>
                    <View style={styles.valueWithBtn}>
                      <Text style={styles.infoValueAcc}>{currentWallet?.bank_account}</Text>
                      <Pressable
                        style={[
                          styles.copyMiniBtn,
                          copiedField === 'acc' && styles.copyMiniBtnSuccess,
                        ]}
                        onPress={() => handleCopy(currentWallet?.bank_account || '', 'acc')}
                      >
                        <Ionicons
                          name={copiedField === 'acc' ? 'checkmark' : 'copy-outline'}
                          size={13}
                          color="#000000"
                        />
                        <Text style={styles.copyMiniText}>
                          {copiedField === 'acc' ? 'Đã chép' : 'Chép'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Account Name Row */}
                  <View style={styles.infoRowDivider} />
                  <View style={styles.infoRow}>
                    <View style={styles.infoLabelCol}>
                      <Ionicons name="person-outline" size={16} color="#6B7280" />
                      <Text style={styles.infoLabel}>Tên ví nhận</Text>
                    </View>
                    <Text style={styles.infoValue}>{currentWallet?.name}</Text>
                  </View>

                  {/* Purpose Row */}
                  <View style={styles.infoRowDivider} />
                  <View style={styles.infoRow}>
                    <View style={styles.infoLabelCol}>
                      <Ionicons name="chatbubble-ellipses-outline" size={16} color="#6B7280" />
                      <Text style={styles.infoLabel}>Nội dung</Text>
                    </View>
                    <View style={styles.valueWithBtn}>
                      <Text style={styles.infoValuePurpose} numberOfLines={1}>
                        {purpose || (personName ? `TRA NO ${personName}` : 'CHUYEN KHOAN')}
                      </Text>
                      <Pressable
                        style={[
                          styles.copyMiniBtn,
                          copiedField === 'purpose' && styles.copyMiniBtnSuccess,
                        ]}
                        onPress={() =>
                          handleCopy(
                            purpose || (personName ? `TRA NO ${personName}` : 'CHUYEN KHOAN'),
                            'purpose'
                          )
                        }
                      >
                        <Ionicons
                          name={copiedField === 'purpose' ? 'checkmark' : 'copy-outline'}
                          size={13}
                          color="#000000"
                        />
                        <Text style={styles.copyMiniText}>
                          {copiedField === 'purpose' ? 'Đã chép' : 'Chép'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* Instructions */}
                <View style={styles.tipBox}>
                  <Ionicons name="qr-code-outline" size={16} color="#000000" />
                  <Text style={styles.tipText}>
                    Bạn bè mở bất kỳ ứng dụng ngân hàng hoặc ví điện tử (VCB, TCB, MB, MoMo...) quét mã này là thông tin STK, số tiền và nội dung tự động điền trong 3 giây.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Action Footer */}
          {hasBankConfig && (
            <View style={styles.footer}>
              <Pressable
                style={styles.copyAccBtn}
                onPress={() => handleCopy(currentWallet?.bank_account || '', 'acc_full')}
              >
                <Ionicons
                  name={copiedField === 'acc_full' ? 'checkmark-circle' : 'copy-outline'}
                  size={16}
                  color="#000000"
                />
                <Text style={styles.copyAccBtnText}>
                  {copiedField === 'acc_full' ? 'ĐÃ SAO CHÉP STK' : 'SAO CHÉP STK'}
                </Text>
              </Pressable>

              <Pressable style={styles.shareBtn} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={16} color="#000000" />
                <Text style={styles.shareBtnText}>CHIA SẺ</Text>
              </Pressable>
            </View>
          )}

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
    paddingTop: 14,
  },
  pickerSection: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  pickerScroll: {
    flexDirection: 'row',
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginRight: 8,
  },
  walletChipSelected: {
    borderColor: '#000000',
    backgroundColor: '#00E599',
    borderWidth: 2,
  },
  walletDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#000000',
  },
  walletChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  walletChipTextSelected: {
    color: '#000000',
    fontWeight: '900',
  },
  warningDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unconfiguredBox: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    marginVertical: 16,
  },
  unconfiguredTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    marginTop: 10,
    marginBottom: 6,
    textAlign: 'center',
  },
  unconfiguredDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  configBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFE600',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
  },
  configBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  qrCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#000000',
    paddingVertical: 18,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
    marginBottom: 14,
  },
  qrFrame: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  napasBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  napasBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#E02424',
  },
  napasText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  amountBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#047857',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#047857',
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 14,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoRowDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 6,
  },
  infoLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  valueWithBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoValueAcc: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  infoValuePurpose: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
    maxWidth: 160,
  },
  copyMiniBtn: {
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
  copyMiniBtnSuccess: {
    backgroundColor: '#86EFAC',
  },
  copyMiniText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    padding: 10,
    marginBottom: 16,
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0',
  },
  copyAccBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFE600',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  copyAccBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  shareBtn: {
    flex: 0.8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#00E599',
    paddingVertical: 12,
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
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
});
