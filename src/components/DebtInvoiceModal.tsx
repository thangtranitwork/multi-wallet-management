import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import { Debt, Wallet } from '../types';
import { THEME, formatVND } from '../constants';
import { hapticLight, hapticSuccess, hapticError, hapticMedium } from '../utils/haptics';
import {
  getAvailableQrOptions,
  buildDebtInvoiceData,
  generateInvoiceHTML,
  generateInvoiceText,
  InvoiceQrOption,
} from '../utils/invoiceGenerator';
import dayjs from 'dayjs';

export interface DebtInvoiceModalProps {
  visible: boolean;
  onClose: () => void;
  debts: Debt[];
  initialDebtId?: string;
  wallets?: Wallet[];
}

export const DebtInvoiceModal: React.FC<DebtInvoiceModalProps> = ({
  visible,
  onClose,
  debts = [],
  initialDebtId,
  wallets = [],
}) => {
  // Lọc các khoản nợ còn hiệu lực
  const activeDebtsList = useMemo(() => {
    return debts.filter((d) => d && d.remaining_amount > 0);
  }, [debts]);

  const hasMultipleDebts = activeDebtsList.length > 1;

  // Tùy chọn xem: 'combined' (gộp tất cả) hoặc id của khoản nợ riêng lẻ
  const [selectedDebtOption, setSelectedDebtOption] = useState<string>(() => {
    if (initialDebtId && activeDebtsList.some((d) => d.id === initialDebtId)) {
      return initialDebtId;
    }
    return hasMultipleDebts ? 'combined' : activeDebtsList[0]?.id || 'combined';
  });

  useEffect(() => {
    if (visible) {
      if (initialDebtId && activeDebtsList.some((d) => d.id === initialDebtId)) {
        setSelectedDebtOption(initialDebtId);
      } else {
        setSelectedDebtOption(hasMultipleDebts ? 'combined' : activeDebtsList[0]?.id || 'combined');
      }
    }
  }, [visible, initialDebtId, hasMultipleDebts, activeDebtsList]);

  const [selectedQrId, setSelectedQrId] = useState<string>('');
  const [customQrUri, setCustomQrUri] = useState<string | null>(null);
  const [resolvedQrDataUri, setResolvedQrDataUri] = useState<string | null>(null);

  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isSharingPdf, setIsSharingPdf] = useState<boolean>(false);
  const [isExportingImage, setIsExportingImage] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  const receiptRef = useRef<View>(null);

  // Danh sách các khoản nợ được chọn để hiển thị trên bill
  const currentDebtsForInvoice = useMemo(() => {
    if (selectedDebtOption === 'combined') {
      return activeDebtsList;
    }
    const single = activeDebtsList.find((d) => d.id === selectedDebtOption);
    return single ? [single] : activeDebtsList;
  }, [selectedDebtOption, activeDebtsList]);

  // Danh sách mã QR khả dụng
  const qrOptions = useMemo(() => {
    return getAvailableQrOptions(wallets, customQrUri);
  }, [wallets, customQrUri]);

  // Thiết lập mã QR mặc định
  useEffect(() => {
    if (!selectedQrId && qrOptions.length > 0) {
      const defaultQr = qrOptions.find((q) => q.type === 'vietqr' || q.type === 'wallet_image') || qrOptions[0];
      setSelectedQrId(defaultQr.id);
    }
  }, [qrOptions, selectedQrId]);

  const activeQrOption = useMemo(() => {
    return qrOptions.find((q) => q.id === selectedQrId) || qrOptions[0] || null;
  }, [qrOptions, selectedQrId]);

  const defaultWallet = useMemo(() => {
    const targetWalletId = currentDebtsForInvoice[0]?.wallet_id;
    return wallets.find((w) => w.id === targetWalletId) || wallets[0] || null;
  }, [wallets, currentDebtsForInvoice]);

  // Xây dựng dữ liệu hóa đơn chi tiết
  const invoiceData = useMemo(() => {
    if (currentDebtsForInvoice.length === 0) return null;
    return buildDebtInvoiceData(currentDebtsForInvoice, activeQrOption, defaultWallet);
  }, [currentDebtsForInvoice, activeQrOption, defaultWallet]);

  // Chuyển đổi mã QR sang base64 data URI cho PDF/Print nếu là file cục bộ
  useEffect(() => {
    let isMounted = true;
    const convertQr = async () => {
      if (!invoiceData?.paymentInfo?.qrUrl || activeQrOption?.type === 'none') {
        if (isMounted) setResolvedQrDataUri(null);
        return;
      }
      const rawUrl = invoiceData.paymentInfo.qrUrl;
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        if (isMounted) setResolvedQrDataUri(rawUrl);
        return;
      }
      try {
        const base64 = await FileSystem.readAsStringAsync(rawUrl, { encoding: 'base64' });
        if (isMounted) {
          setResolvedQrDataUri(`data:image/png;base64,${base64}`);
        }
      } catch {
        if (isMounted) setResolvedQrDataUri(rawUrl);
      }
    };

    convertQr();
    return () => {
      isMounted = false;
    };
  }, [invoiceData?.paymentInfo?.qrUrl, activeQrOption?.type]);

  if (!visible || !invoiceData || currentDebtsForInvoice.length === 0) {
    return null;
  }

  // Chọn ảnh QR từ thiết bị
  const handlePickCustomQr = async () => {
    hapticLight();
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền thư viện ảnh để chọn mã QR.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setCustomQrUri(uri);
        setSelectedQrId('custom');
        hapticSuccess();
      }
    } catch (err: any) {
      hapticError();
      Alert.alert('Lỗi', err?.message || 'Không thể chọn ảnh từ máy');
    }
  };

  // 1. In hóa đơn trực tiếp
  const handlePrint = async () => {
    if (isPrinting) return;
    hapticMedium();
    setIsPrinting(true);
    try {
      const html = generateInvoiceHTML(invoiceData, resolvedQrDataUri || undefined);
      await Print.printAsync({ html });
      hapticSuccess();
    } catch (err: any) {
      if (!err?.message?.includes('cancelled') && !err?.message?.includes('canceled')) {
        hapticError();
        Alert.alert('Lỗi in hóa đơn', err?.message || 'Không thể kết nối với máy in');
      }
    } finally {
      setIsPrinting(false);
    }
  };

  // 2. Xuất file PDF & chia sẻ
  const handleSharePdf = async () => {
    if (isSharingPdf) return;
    hapticMedium();
    setIsSharingPdf(true);
    try {
      const html = generateInvoiceHTML(invoiceData, resolvedQrDataUri || undefined);
      const { uri } = await Print.printToFileAsync({ html });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Chia sẻ ${invoiceData.title}`,
          UTI: 'com.adobe.pdf',
        });
        hapticSuccess();
      } else {
        Alert.alert('Thành công', `Đã lưu file PDF tại:\n${uri}`);
      }
    } catch (err: any) {
      hapticError();
      Alert.alert('Lỗi xuất PDF', err?.message || 'Không thể tạo file PDF');
    } finally {
      setIsSharingPdf(false);
    }
  };

  // 3. Xuất hóa đơn dạng ảnh chụp
  const handleExportImage = async () => {
    if (isExportingImage || !receiptRef.current) return;
    hapticMedium();
    setIsExportingImage(true);
    try {
      const uri = await captureRef(receiptRef, {
        format: 'png',
        quality: 1,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `Gửi ảnh phiếu nợ: ${invoiceData.targetName}`,
        });
        hapticSuccess();
      } else {
        Alert.alert('Đã tạo ảnh', `Đã lưu ảnh phiếu nợ tại:\n${uri}`);
      }
    } catch (err: any) {
      hapticError();
      Alert.alert('Lỗi xuất ảnh', err?.message || 'Không thể xuất ảnh phiếu nợ');
    } finally {
      setIsExportingImage(false);
    }
  };

  // 4. Sao chép nội dung văn bản
  const handleCopyText = async () => {
    hapticLight();
    try {
      const plainText = generateInvoiceText(invoiceData);
      await Clipboard.setStringAsync(plainText);
      setCopiedToast(true);
      hapticSuccess();
      setTimeout(() => setCopiedToast(false), 2500);
    } catch (err: any) {
      hapticError();
      Alert.alert('Lỗi', 'Không thể sao chép văn bản');
    }
  };

  const combinedTotal = activeDebtsList.reduce((s, d) => s + d.remaining_amount, 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCardShadow}>
          <View style={styles.modalCardInner}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.headerTitleRow}>
                <Ionicons name="document-text" size={20} color="#000000" />
                <Text style={styles.modalTitle}>Phiếu Báo Nợ & Thanh Toán</Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={20} color="#000000" />
              </Pressable>
            </View>

            {/* Selector: Gộp tất cả nợ hoặc chọn từng khoản nợ */}
            {hasMultipleDebts && (
              <View style={styles.optionSelectorBox}>
                <Text style={styles.sectionSubtitle}>Chọn hình thức xuất bill:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                  {/* Tab Gộp tất cả */}
                  <Pressable
                    style={[
                      styles.tabChip,
                      selectedDebtOption === 'combined' && styles.tabChipActive,
                    ]}
                    onPress={() => {
                      hapticLight();
                      setSelectedDebtOption('combined');
                    }}
                  >
                    <Ionicons
                      name="layers-outline"
                      size={14}
                      color={selectedDebtOption === 'combined' ? '#000000' : '#4B5563'}
                    />
                    <Text
                      style={[
                        styles.tabChipText,
                        selectedDebtOption === 'combined' && styles.tabChipTextActive,
                      ]}
                    >
                      Gộp tất cả ({activeDebtsList.length} khoản) • {formatVND(combinedTotal)}
                    </Text>
                  </Pressable>

                  {/* Từng khoản nợ riêng lẻ */}
                  {activeDebtsList.map((d, idx) => {
                    const isSelected = selectedDebtOption === d.id;
                    const dateStr = dayjs(d.created_at).format('DD/MM');
                    return (
                      <Pressable
                        key={d.id}
                        style={[styles.tabChip, isSelected && styles.tabChipActive]}
                        onPress={() => {
                          hapticLight();
                          setSelectedDebtOption(d.id);
                        }}
                      >
                        <Text style={[styles.tabChipText, isSelected && styles.tabChipTextActive]}>
                          Khoản {idx + 1} ({dateStr}): {formatVND(d.remaining_amount)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Chọn nguồn mã QR */}
            <View style={styles.qrSelectorBox}>
              <View style={styles.qrSelectorHeader}>
                <Ionicons name="qr-code-outline" size={14} color="#000000" />
                <Text style={styles.sectionSubtitle}>Chọn tài khoản nhận tiền:</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.qrScroll}>
                {qrOptions.map((q) => {
                  const isSelected = selectedQrId === q.id;
                  return (
                    <Pressable
                      key={q.id}
                      style={[styles.qrChip, isSelected && styles.qrChipActive]}
                      onPress={() => {
                        hapticLight();
                        setSelectedQrId(q.id);
                      }}
                    >
                      <Ionicons
                        name={
                          q.type === 'none'
                            ? 'eye-off-outline'
                            : q.type === 'vietqr'
                            ? 'qr-code-outline'
                            : 'image-outline'
                        }
                        size={13}
                        color={isSelected ? '#000000' : '#6B7280'}
                      />
                      <View>
                        <Text style={[styles.qrChipText, isSelected && styles.qrChipTextActive]}>
                          {q.label}
                        </Text>
                        {!!q.sublabel && (
                          <Text style={styles.qrChipSub} numberOfLines={1}>
                            {q.sublabel}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}

                <Pressable style={styles.qrChipUpload} onPress={handlePickCustomQr}>
                  <Ionicons name="cloud-upload-outline" size={13} color="#000000" />
                  <Text style={styles.qrChipUploadText}>Tải ảnh QR</Text>
                </Pressable>
              </ScrollView>
            </View>

            {/* Live Paper Receipt Preview */}
            <ScrollView
              style={styles.previewScroll}
              contentContainerStyle={styles.previewContent}
              showsVerticalScrollIndicator={false}
            >
              <View ref={receiptRef} collapsable={false} style={styles.receiptPaper}>
                {/* Header */}
                <View style={styles.receiptHeader}>
                  <View style={styles.receiptBadge}>
                    <Text style={styles.receiptBadgeText}>{invoiceData.title}</Text>
                  </View>
                  <Text style={styles.receiptTargetName}>{invoiceData.targetName}</Text>
                  <Text style={styles.receiptDate}>{invoiceData.dateStr}</Text>
                </View>

                {/* Meta details */}
                <View style={styles.receiptMetaRow}>
                  <Text style={styles.receiptMetaLabel}>Nội dung:</Text>
                  <Text style={styles.receiptMetaVal} numberOfLines={2}>
                    {invoiceData.subtitle || invoiceData.note}
                  </Text>
                </View>

                {/* Items Table */}
                <View style={styles.receiptDivider} />
                <View style={styles.receiptTableHeader}>
                  <Text style={[styles.receiptColHeader, { flex: 2 }]}>MÓN / KHOẢN NỢ</Text>
                  <Text style={[styles.receiptColHeader, { width: 36, textAlign: 'center' }]}>SL</Text>
                  <Text style={[styles.receiptColHeader, { width: 85, textAlign: 'right' }]}>TIỀN</Text>
                </View>
                <View style={styles.receiptDividerThin} />

                {invoiceData.items.map((it, idx) => (
                  <View key={idx} style={styles.receiptItemRow}>
                    <View style={{ flex: 2, paddingRight: 6 }}>
                      <Text style={styles.receiptItemName}>{it.name}</Text>
                      {!!it.note && <Text style={styles.receiptItemNote}>{it.note}</Text>}
                    </View>
                    <Text style={styles.receiptItemQty}>{it.quantity}</Text>
                    <Text style={styles.receiptItemPrice}>{formatVND(it.totalPrice)}</Text>
                  </View>
                ))}

                <View style={styles.receiptDivider} />

                {/* Total Box */}
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>CẦN CHUYỂN KHOẢN:</Text>
                  <Text style={styles.receiptTotalVal}>{formatVND(invoiceData.totalAmount)}</Text>
                </View>

                {/* QR Code Container */}
                {invoiceData.paymentInfo?.qrUrl && activeQrOption?.type !== 'none' ? (
                  <View style={styles.qrBox}>
                    <View style={styles.qrHeaderRow}>
                      <Ionicons name="qr-code-outline" size={13} color="#065F46" />
                      <Text style={styles.qrTitle}>Quét mã QR thanh toán nợ</Text>
                    </View>
                    {!!invoiceData.paymentInfo.bankName && (
                      <Text style={styles.qrSub}>
                        {invoiceData.paymentInfo.bankName}
                        {invoiceData.paymentInfo.accountNumber
                          ? ` • STK: ${invoiceData.paymentInfo.accountNumber}`
                          : ''}
                      </Text>
                    )}

                    <View style={styles.memberQrCard}>
                      {/* 1. Tên người và số tiền nằm cùng 1 dòng bên trên QR */}
                      <View style={styles.memberQrTopRow}>
                        <View style={styles.memberQrNameBadge}>
                          <Text style={styles.memberQrNameText} numberOfLines={1}>
                            {invoiceData.targetName}
                          </Text>
                        </View>
                        <Text style={styles.memberQrAmount}>{formatVND(invoiceData.totalAmount)}</Text>
                      </View>

                      {/* 2. Mã QR chiếm toàn bộ bề ngang */}
                      <View style={styles.memberQrImageContainer}>
                        <Image
                          source={{ uri: invoiceData.paymentInfo.qrUrl }}
                          style={styles.memberQrImage}
                          resizeMode="contain"
                        />
                      </View>

                      {/* 3. Nội dung chuyển khoản bên dưới */}
                      {!!invoiceData.paymentInfo?.transferNote && (
                        <View style={styles.memberQrNoteBox}>
                          <Text style={styles.memberQrNoteLabel}>Nội dung CK:</Text>
                          <Text style={styles.memberQrNoteText} numberOfLines={2}>
                            {invoiceData.paymentInfo.transferNote}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            {/* Copied Toast */}
            {copiedToast && (
              <View style={styles.toast}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.toastText}>Đã sao chép phiếu nợ để gửi tin nhắn!</Text>
              </View>
            )}

            {/* Actions Bar */}
            <View style={styles.actionsBar}>
              <Pressable style={styles.actionBtnSecondary} onPress={handleCopyText}>
                <Ionicons name="copy-outline" size={14} color="#000000" />
                <Text style={styles.actionBtnSecondaryText}>Sao chép</Text>
              </Pressable>

              <Pressable
                style={styles.actionBtnSecondary}
                onPress={handleExportImage}
                disabled={isExportingImage}
              >
                {isExportingImage ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={14} color="#000000" />
                    <Text style={styles.actionBtnSecondaryText}>Xuất ảnh</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={styles.actionBtnSecondary}
                onPress={handleSharePdf}
                disabled={isSharingPdf}
              >
                {isSharingPdf ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <>
                    <Ionicons name="document-text-outline" size={14} color="#000000" />
                    <Text style={styles.actionBtnSecondaryText}>PDF</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={[styles.actionBtnPrimary, { flex: 1.15 }]}
                onPress={handlePrint}
                disabled={isPrinting}
              >
                {isPrinting ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <>
                    <Ionicons name="print" size={15} color="#000000" />
                    <Text style={styles.actionBtnPrimaryText}>In phiếu</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCardShadow: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  modalCardInner: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionSelectorBox: {
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4B5563',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tabChipActive: {
    backgroundColor: '#FEF08A',
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 1.5, height: 1.5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  tabChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  tabChipTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  qrSelectorBox: {
    marginBottom: 8,
  },
  qrSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qrScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  qrChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  qrChipActive: {
    backgroundColor: '#D1FAE5',
    borderColor: '#059669',
  },
  qrChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#4B5563',
  },
  qrChipTextActive: {
    color: '#065F46',
    fontWeight: '900',
  },
  qrChipSub: {
    fontSize: 9,
    color: '#6B7280',
  },
  qrChipUpload: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  qrChipUploadText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#000000',
  },
  previewScroll: {
    maxHeight: 330,
    marginVertical: 4,
  },
  previewContent: {
    paddingVertical: 4,
  },
  receiptPaper: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  receiptBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  receiptBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#065F46',
  },
  receiptTargetName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111827',
    marginTop: 3,
  },
  receiptDate: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  receiptMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1.5,
  },
  receiptMetaLabel: {
    fontSize: 10.5,
    color: '#6B7280',
    fontWeight: '600',
  },
  receiptMetaVal: {
    fontSize: 10.5,
    color: '#111827',
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  receiptDivider: {
    height: 1.5,
    backgroundColor: '#000000',
    marginVertical: 6,
  },
  receiptDividerThin: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 3,
  },
  receiptTableHeader: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  receiptColHeader: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#000000',
  },
  receiptItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  receiptItemName: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#111827',
  },
  receiptItemNote: {
    fontSize: 9,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  receiptItemQty: {
    width: 36,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
  },
  receiptItemPrice: {
    width: 85,
    textAlign: 'right',
    fontSize: 10.5,
    fontWeight: '800',
    color: '#111827',
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEFCE8',
    borderWidth: 1.5,
    borderColor: '#000000',
    padding: 7,
    borderRadius: 6,
    marginVertical: 4,
  },
  receiptTotalLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
  },
  receiptTotalVal: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#B45309',
  },
  qrBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  qrHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 2,
  },
  qrTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  qrSub: {
    fontSize: 9.5,
    color: '#047857',
    textAlign: 'center',
    marginTop: 1,
    marginBottom: 8,
  },
  memberQrCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 1.5, height: 1.5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  memberQrTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  memberQrNameBadge: {
    backgroundColor: '#FEF08A',
    borderWidth: 1,
    borderColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: '55%',
  },
  memberQrNameText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  memberQrAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#059669',
  },
  memberQrImageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  memberQrImage: {
    width: '100%',
    height: '100%',
  },
  memberQrNoteBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    width: '100%',
  },
  memberQrNoteLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 1,
  },
  memberQrNoteText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 14,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 6,
  },
  toastText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 10,
  },
  actionBtnSecondaryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 4,
    backgroundColor: '#FFE600',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 1.5, height: 1.5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  actionBtnPrimaryText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#000000',
  },
});
