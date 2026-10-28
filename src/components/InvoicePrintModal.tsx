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
import { Transaction, Wallet, BillItem, BillAdjustment, BillMember } from '../types';
import { THEME, formatVND } from '../constants';
import { hapticLight, hapticSuccess, hapticError, hapticMedium } from '../utils/haptics';
import {
  getInvoiceOptions,
  getAvailableQrOptions,
  buildInvoiceData,
  generateInvoiceHTML,
  generateInvoiceText,
  InvoiceMemberOption,
  InvoiceQrOption,
} from '../utils/invoiceGenerator';

export interface InvoicePrintModalProps {
  visible: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  parsedBill: { items?: BillItem[]; adjustments?: BillAdjustment[]; members?: BillMember[] } | null;
  wallets?: Wallet[];
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  visible,
  onClose,
  transaction,
  parsedBill,
  wallets = [],
}) => {
  const [selectedOptionId, setSelectedOptionId] = useState<string>('total');
  const [selectedQrId, setSelectedQrId] = useState<string>('');
  const [customQrUri, setCustomQrUri] = useState<string | null>(null);
  const [resolvedQrDataUri, setResolvedQrDataUri] = useState<string | null>(null);
  const [qrDisplayMode, setQrDisplayMode] = useState<'members' | 'total'>('members');

  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isSharingPdf, setIsSharingPdf] = useState<boolean>(false);
  const [isExportingImage, setIsExportingImage] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  const receiptRef = useRef<View>(null);

  // Danh sách các tùy chọn hóa đơn: Tổng, Của tôi, Của từng người khác
  const options = useMemo(() => {
    if (!transaction) return [];
    return getInvoiceOptions(transaction, parsedBill);
  }, [transaction, parsedBill]);

  // Tùy chọn hóa đơn đang chọn
  const activeOption = useMemo(() => {
    return options.find((o) => o.id === selectedOptionId) || options[0] || null;
  }, [options, selectedOptionId]);

  // Danh sách các mã QR khả dụng
  const qrOptions = useMemo(() => {
    return getAvailableQrOptions(wallets, customQrUri);
  }, [wallets, customQrUri]);

  // Thiết lập mã QR mặc định khi mở modal hoặc khi wallets thay đổi
  useEffect(() => {
    if (!selectedQrId && qrOptions.length > 0) {
      // Ưu tiên chọn VietQR đầu tiên hoặc ảnh QR đầu tiên nếu có
      const defaultQr = qrOptions.find((q) => q.type === 'vietqr' || q.type === 'wallet_image') || qrOptions[0];
      setSelectedQrId(defaultQr.id);
    }
  }, [qrOptions, selectedQrId]);

  const activeQrOption = useMemo(() => {
    return qrOptions.find((q) => q.id === selectedQrId) || qrOptions[0] || null;
  }, [qrOptions, selectedQrId]);

  const defaultWallet = useMemo(() => {
    return wallets.find((w) => w.id === transaction?.wallet_id) || wallets[0] || null;
  }, [wallets, transaction?.wallet_id]);

  // Dữ liệu hóa đơn chi tiết
  const invoiceData = useMemo(() => {
    if (!transaction || !activeOption) return null;
    return buildInvoiceData(activeOption, transaction, parsedBill, activeQrOption, defaultWallet);
  }, [transaction, activeOption, parsedBill, activeQrOption, defaultWallet]);

  const hasMemberQrs = useMemo(() => {
    return (
      activeOption?.type === 'total' &&
      Array.isArray(invoiceData?.memberPaymentQrs) &&
      invoiceData.memberPaymentQrs.length > 0
    );
  }, [activeOption?.type, invoiceData?.memberPaymentQrs]);

  // Chuyển đổi mã QR cục bộ (file://) sang base64 để expo-print render chuẩn xác 100% trong PDF/Print
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
      // Đọc file cục bộ sang base64 data URI
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

  if (!transaction || !visible || !activeOption || !invoiceData) {
    return null;
  }

  // Chọn ảnh QR từ thư viện máy
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

  // 1. In trực tiếp qua máy in (AirPrint / Google Cloud Print / Thermal)
  const handlePrint = async () => {
    if (isPrinting) return;
    hapticMedium();
    setIsPrinting(true);
    try {
      const html = generateInvoiceHTML(invoiceData, resolvedQrDataUri || undefined, qrDisplayMode);
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

  // 2. Xuất file PDF và mở menu chia sẻ (Zalo, Messenger, Mail, AirDrop...)
  const handleSharePdf = async () => {
    if (isSharingPdf) return;
    hapticMedium();
    setIsSharingPdf(true);
    try {
      const html = generateInvoiceHTML(invoiceData, resolvedQrDataUri || undefined, qrDisplayMode);
      const { uri } = await Print.printToFileAsync({ html });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `Gửi hóa đơn: ${invoiceData.targetName}`,
        });
        hapticSuccess();
      } else {
        Alert.alert('Thông báo', `Đã lưu file PDF tại:\n${uri}`);
      }
    } catch (err: any) {
      if (!err?.message?.includes('cancelled') && !err?.message?.includes('canceled')) {
        hapticError();
        Alert.alert('Lỗi xuất PDF', err?.message || 'Không thể tạo file PDF');
      }
    } finally {
      setIsSharingPdf(false);
    }
  };

  // 3. Xuất hóa đơn dạng ảnh (PNG) và mở menu chia sẻ (Zalo, Messenger, Lưu ảnh...)
  const handleExportImage = async () => {
    if (isExportingImage || !receiptRef.current) return;
    hapticMedium();
    setIsExportingImage(true);
    try {
      const uri = await captureRef(receiptRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          UTI: 'public.png',
          mimeType: 'image/png',
          dialogTitle: `Gửi ảnh hóa đơn: ${invoiceData.targetName}`,
        });
        hapticSuccess();
      } else {
        Alert.alert('Thông báo', `Đã lưu ảnh tại:\n${uri}`);
      }
    } catch (err: any) {
      if (!err?.message?.includes('cancelled') && !err?.message?.includes('canceled')) {
        hapticError();
        Alert.alert('Lỗi xuất ảnh', err?.message || 'Không thể tạo ảnh hóa đơn');
      }
    } finally {
      setIsExportingImage(false);
    }
  };

  // 4. Sao chép nội dung tin nhắn hóa đơn vào Clipboard
  const handleCopyText = async () => {
    hapticLight();
    const text = generateInvoiceText(invoiceData);
    await Clipboard.setStringAsync(text);
    hapticSuccess();
    setCopiedToast(true);
    setTimeout(() => {
      setCopiedToast(false);
    }, 2500);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCardShadow}>
          <View style={styles.modalCardInner}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={styles.headerIconBox}>
                  <Ionicons name="print-outline" size={20} color="#000000" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>In & Xuất Hóa Đơn</Text>
                  <Text style={styles.modalSubtitle}>
                    Chọn loại hóa đơn & mã QR thanh toán
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  hapticLight();
                  onClose();
                }}
                style={styles.closeBtn}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color="#000000" />
              </Pressable>
            </View>

            {/* Filter Chips: Hóa đơn tổng / Của tôi / Của từng người */}
            <View style={styles.tabsContainer}>
              <Text style={styles.sectionLabel}>1. Chọn hóa đơn:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsScroll}
              >
                {options.map((opt) => {
                  const isSelected = opt.id === selectedOptionId;
                  const isTotal = opt.type === 'total';
                  const isMe = opt.type === 'my_share';

                  return (
                    <Pressable
                      key={opt.id}
                      style={[
                        styles.tabChip,
                        isSelected && styles.tabChipSelected,
                        isSelected && isTotal && { backgroundColor: '#FFE600' },
                        isSelected && isMe && { backgroundColor: '#EEF2FF', borderColor: '#4F46E5' },
                        isSelected && !isTotal && !isMe && { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
                      ]}
                      onPress={() => {
                        hapticLight();
                        setSelectedOptionId(opt.id);
                      }}
                    >
                      <Ionicons
                        name={isTotal ? 'receipt-outline' : isMe ? 'person-outline' : 'people-outline'}
                        size={14}
                        color={
                          isSelected
                            ? isTotal
                              ? '#000000'
                              : isMe
                              ? '#4338CA'
                              : '#065F46'
                            : '#4B5563'
                        }
                      />
                      <View>
                        <Text
                          style={[
                            styles.tabChipText,
                            isSelected && {
                              color: isTotal ? '#000000' : isMe ? '#4338CA' : '#065F46',
                              fontWeight: '900',
                            },
                          ]}
                        >
                          {opt.name}
                        </Text>
                        <Text style={styles.tabChipSub}>{formatVND(opt.totalAmount)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* QR Code Picker Bar */}
            <View style={styles.qrSelectorContainer}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionLabel}>2. Mã QR dán cuối bill:</Text>
                <Pressable
                  style={styles.pickCustomQrBtn}
                  onPress={handlePickCustomQr}
                >
                  <Ionicons name="image-outline" size={13} color="#4338CA" />
                  <Text style={styles.pickCustomQrBtnText}>Tải ảnh QR từ máy</Text>
                </Pressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsScroll}
              >
                {qrOptions.map((qr) => {
                  const isSelected = qr.id === selectedQrId;
                  const isNone = qr.type === 'none';

                  return (
                    <Pressable
                      key={qr.id}
                      style={[
                        styles.qrChip,
                        isSelected && styles.qrChipSelected,
                        isSelected && isNone && { backgroundColor: '#F3F4F6' },
                        isSelected && !isNone && { backgroundColor: '#ECFDF5', borderColor: '#059669' },
                      ]}
                      onPress={() => {
                        hapticLight();
                        setSelectedQrId(qr.id);
                      }}
                    >
                      <Ionicons
                        name={
                          isNone
                            ? 'close-circle-outline'
                            : qr.type === 'vietqr'
                            ? 'qr-code-outline'
                            : 'image-outline'
                        }
                        size={14}
                        color={isSelected ? (isNone ? '#000000' : '#047857') : '#6B7280'}
                      />
                      <View>
                        <Text
                          style={[
                            styles.qrChipLabel,
                            isSelected && {
                              color: isNone ? '#000000' : '#047857',
                              fontWeight: '800',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {qr.label}
                        </Text>
                        {!!qr.sublabel && (
                          <Text style={styles.qrChipSub} numberOfLines={1}>
                            {qr.sublabel}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Chế độ mã QR khi hóa đơn tổng có nhiều người */}
            {hasMemberQrs && (
              <View style={styles.qrModeToggleContainer}>
                <Pressable
                  style={[
                    styles.qrModeToggleBtn,
                    qrDisplayMode === 'members' && styles.qrModeToggleBtnActive,
                  ]}
                  onPress={() => {
                    hapticLight();
                    setQrDisplayMode('members');
                  }}
                >
                  <Ionicons
                    name="people"
                    size={14}
                    color={qrDisplayMode === 'members' ? '#000000' : '#4B5563'}
                  />
                  <Text
                    style={[
                      styles.qrModeToggleBtnText,
                      qrDisplayMode === 'members' && styles.qrModeToggleBtnTextActive,
                    ]}
                  >
                    Mã từng người ({invoiceData.memberPaymentQrs!.length})
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.qrModeToggleBtn,
                    qrDisplayMode === 'total' && styles.qrModeToggleBtnActive,
                  ]}
                  onPress={() => {
                    hapticLight();
                    setQrDisplayMode('total');
                  }}
                >
                  <Ionicons
                    name="qr-code"
                    size={14}
                    color={qrDisplayMode === 'total' ? '#000000' : '#4B5563'}
                  />
                  <Text
                    style={[
                      styles.qrModeToggleBtnText,
                      qrDisplayMode === 'total' && styles.qrModeToggleBtnTextActive,
                    ]}
                  >
                    Mã tổng bill
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Live Paper Receipt Preview */}
            <ScrollView
              style={styles.previewScroll}
              contentContainerStyle={styles.previewContent}
              showsVerticalScrollIndicator={false}
            >
              <View ref={receiptRef} collapsable={false} style={styles.receiptPaper}>
                {/* Paper Header */}
                <View style={styles.receiptHeader}>
                  <View
                    style={[
                      styles.receiptBadge,
                      activeOption.type === 'member_share' && { backgroundColor: '#ECFDF5' },
                      activeOption.type === 'my_share' && { backgroundColor: '#EEF2FF' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.receiptBadgeText,
                        activeOption.type === 'member_share' && { color: '#065F46' },
                        activeOption.type === 'my_share' && { color: '#3730A3' },
                      ]}
                    >
                      {invoiceData.title}
                    </Text>
                  </View>
                  <Text style={styles.receiptTargetName}>{invoiceData.targetName}</Text>
                  <Text style={styles.receiptDate}>{invoiceData.dateStr}</Text>
                </View>

                {/* Meta details */}
                <View style={styles.receiptMetaRow}>
                  <Text style={styles.receiptMetaLabel}>Nội dung:</Text>
                  <Text style={styles.receiptMetaVal} numberOfLines={1}>
                    {invoiceData.subtitle || invoiceData.note}
                  </Text>
                </View>

                {/* Items Table */}
                <View style={styles.receiptDivider} />
                <View style={styles.receiptTableHeader}>
                  <Text style={[styles.receiptColHeader, { flex: 2 }]}>MÓN / DỊCH VỤ</Text>
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

                {/* Adjustments */}
                {invoiceData.adjustments.map((adj, idx) => (
                  <View key={`adj_${idx}`} style={styles.receiptItemRow}>
                    <Text style={[styles.receiptItemNote, { flex: 2, fontStyle: 'italic' }]}>
                      {adj.name}
                    </Text>
                    <Text style={styles.receiptItemQty}>-</Text>
                    <Text
                      style={[
                        styles.receiptItemPrice,
                        { color: adj.type === 'discount' ? '#059669' : '#D97706' },
                      ]}
                    >
                      {adj.type === 'discount' ? '-' : '+'}
                      {formatVND(adj.amount)}
                    </Text>
                  </View>
                ))}

                <View style={styles.receiptDivider} />

                {/* Total Box */}
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>
                    {activeOption.type === 'member_share'
                      ? 'CẦN CHUYỂN KHOẢN:'
                      : activeOption.type === 'my_share'
                      ? 'BẠN CHI TRẢ:'
                      : 'TỔNG HÓA ĐƠN:'}
                  </Text>
                  <Text style={styles.receiptTotalVal}>{formatVND(invoiceData.totalAmount)}</Text>
                </View>

                {/* Member Allocations breakdown if Total Bill */}
                {invoiceData.memberAllocations && invoiceData.memberAllocations.length > 0 && (
                  <View style={styles.allocationsBox}>
                    <View style={styles.allocationsHeaderRow}>
                      <Ionicons name="people-outline" size={13} color="#374151" />
                      <Text style={styles.allocationsTitle}>Phân bổ theo thành viên:</Text>
                    </View>
                    {invoiceData.memberAllocations.map((m, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.allocationMemberBlock,
                          idx > 0 && styles.allocationMemberBorder,
                        ]}
                      >
                        <View style={styles.allocationRow}>
                          <Text style={[styles.allocationName, m.isPayer && styles.allocationPayerName]}>
                            {m.name} {m.isPayer ? '(Chủ chi)' : ''}
                          </Text>
                          <Text style={[styles.allocationVal, m.isPayer && styles.allocationPayerVal]}>
                            {formatVND(m.amount)}
                          </Text>
                        </View>
                        {m.items && m.items.length > 0 ? (
                          <View style={styles.allocationItemsList}>
                            {m.items.map((it, itemIdx) => (
                              <View key={itemIdx} style={styles.allocationItemSubRow}>
                                <Text style={styles.allocationItemSubText} numberOfLines={1}>
                                  • {it.name} (x{it.quantity}){it.note ? ` [${it.note}]` : ''}
                                </Text>
                                <Text style={styles.allocationItemSubPrice}>
                                  {formatVND(it.totalPrice)}
                                </Text>
                              </View>
                            ))}
                            {!!m.adjustmentShare && m.adjustmentShare !== 0 && (
                              <View style={styles.allocationItemSubRow}>
                                <Text
                                  style={[
                                    styles.allocationItemSubText,
                                    {
                                      fontStyle: 'italic',
                                      color: m.adjustmentShare > 0 ? '#D97706' : '#059669',
                                    },
                                  ]}
                                >
                                  • {m.adjustmentShare > 0 ? 'Phụ phí chia đều' : 'Giảm giá / Voucher'}
                                </Text>
                                <Text
                                  style={[
                                    styles.allocationItemSubPrice,
                                    { color: m.adjustmentShare > 0 ? '#D97706' : '#059669' },
                                  ]}
                                >
                                  {m.adjustmentShare > 0 ? '+' : ''}
                                  {formatVND(m.adjustmentShare)}
                                </Text>
                              </View>
                            )}
                          </View>
                        ) : (
                          <View style={styles.allocationItemsList}>
                            <Text style={styles.allocationNoItemsText}>
                              (Không có món riêng)
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {/* VietQR or Custom QR code preview */}
                {hasMemberQrs && qrDisplayMode === 'members' ? (
                  <View style={styles.memberQrsPaperBox}>
                    <View style={styles.qrHeaderRow}>
                      <Ionicons name="people-outline" size={14} color="#065F46" />
                      <Text style={styles.qrTitle}>Mã QR thanh toán theo từng người</Text>
                    </View>
                    {!!invoiceData.paymentInfo?.bankName && (
                      <Text style={styles.qrSub}>
                        {invoiceData.paymentInfo.bankName}
                        {invoiceData.paymentInfo.accountNumber
                          ? ` • STK: ${invoiceData.paymentInfo.accountNumber}`
                          : ''}
                      </Text>
                    )}
                    <View style={styles.memberQrsList}>
                      {invoiceData.memberPaymentQrs!.map((mqr, idx) => (
                        <View key={idx} style={styles.memberQrCard}>
                          {/* 1. Tên người và số tiền nằm cùng 1 dòng bên trên QR */}
                          <View style={styles.memberQrTopRow}>
                            <View style={styles.memberQrNameBadge}>
                              <Text style={styles.memberQrNameText} numberOfLines={1}>
                                {mqr.name}
                              </Text>
                            </View>
                            <Text style={styles.memberQrAmount}>{formatVND(mqr.amount)}</Text>
                          </View>

                          {/* 2. Mã QR chiếm toàn bộ bề ngang */}
                          {mqr.qrUrl ? (
                            <View style={styles.memberQrImageContainer}>
                              <Image
                                source={{ uri: mqr.qrUrl }}
                                style={styles.memberQrImage}
                                resizeMode="contain"
                              />
                            </View>
                          ) : (
                            <View style={styles.memberQrPlaceholder}>
                              <Text style={styles.memberQrPlaceholderText}>Không có QR</Text>
                            </View>
                          )}

                          {/* 3. Nội dung chuyển khoản bên dưới */}
                          {!!mqr.transferNote && (
                            <View style={styles.memberQrNoteBox}>
                              <Text style={styles.memberQrNoteLabel}>Nội dung CK:</Text>
                              <Text style={styles.memberQrNoteText} numberOfLines={2}>
                                {mqr.transferNote}
                              </Text>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                ) : invoiceData.paymentInfo?.qrUrl && activeQrOption?.type !== 'none' ? (
                  <View style={styles.qrBox}>
                    <View style={styles.qrHeaderRow}>
                      <Ionicons name="qr-code-outline" size={13} color="#065F46" />
                      <Text style={styles.qrTitle}>Quét mã QR thanh toán</Text>
                    </View>
                    {!!invoiceData.paymentInfo.bankName && (
                      <Text style={styles.qrSub}>
                        {invoiceData.paymentInfo.bankName}
                        {invoiceData.paymentInfo.accountNumber ? ` • STK: ${invoiceData.paymentInfo.accountNumber}` : ''}
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

                      {/* 3. Nội dung chuyển khoản bên dưới (nếu có) */}
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

            {/* Copied Toast Alert */}
            {copiedToast && (
              <View style={styles.toast}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.toastText}>Đã sao chép hóa đơn để gửi tin nhắn!</Text>
              </View>
            )}

            {/* Bottom Actions */}
            <View style={styles.actionsBar}>
              {/* Copy text button */}
              <Pressable style={styles.actionBtnSecondary} onPress={handleCopyText}>
                <Ionicons name="copy-outline" size={14} color="#000000" />
                <Text style={styles.actionBtnSecondaryText}>Sao chép</Text>
              </Pressable>

              {/* Export image button */}
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

              {/* Share PDF button */}
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

              {/* Print directly button */}
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
                    <Text style={styles.actionBtnPrimaryText}>In hóa đơn</Text>
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
  },
  modalCardInner: {
    backgroundColor: '#FAF8F5',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 16,
    paddingBottom: 24,
    transform: [{ translateY: -3 }],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFE600',
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  tabsContainer: {
    marginBottom: 8,
  },
  tabsScroll: {
    gap: 8,
    paddingVertical: 3,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
  },
  tabChipSelected: {
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 1.5, height: 1.5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  tabChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#374151',
  },
  tabChipSub: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
  },
  qrSelectorContainer: {
    marginBottom: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  pickCustomQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#6366F1',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pickCustomQrBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#4338CA',
  },
  qrChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 8,
  },
  qrChipSelected: {
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 1.5, height: 1.5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  qrChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  qrChipSub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#6B7280',
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
  receiptBrand: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1,
  },
  receiptBadge: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  receiptBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#000000',
  },
  receiptTargetName: {
    fontSize: 12.5,
    fontWeight: '800',
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
    marginBottom: 4,
  },
  receiptTableHeader: {
    flexDirection: 'row',
    paddingVertical: 3,
  },
  receiptColHeader: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#6B7280',
  },
  receiptItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2.5,
  },
  receiptItemName: {
    fontSize: 11,
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
    fontSize: 10.5,
    fontWeight: '700',
    color: '#374151',
  },
  receiptItemPrice: {
    width: 85,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '800',
    color: '#111827',
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    backgroundColor: '#FEFCE8',
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  receiptTotalLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#92400E',
  },
  receiptTotalVal: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#B45309',
  },
  allocationsBox: {
    marginTop: 8,
    padding: 7,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  allocationsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  allocationsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#374151',
  },
  allocationMemberBlock: {
    paddingVertical: 2,
  },
  allocationMemberBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 4,
    paddingTop: 4,
  },
  allocationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 1,
  },
  allocationName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1F2937',
  },
  allocationPayerName: {
    color: '#059669',
  },
  allocationVal: {
    fontSize: 10,
    fontWeight: '800',
    color: '#111827',
  },
  allocationPayerVal: {
    color: '#059669',
  },
  allocationItemsList: {
    paddingLeft: 8,
    marginTop: 2,
    gap: 1.5,
  },
  allocationItemSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  allocationItemSubText: {
    fontSize: 9.5,
    color: '#4B5563',
    flex: 1,
    paddingRight: 6,
  },
  allocationItemSubPrice: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#4B5563',
  },
  allocationNoItemsText: {
    fontSize: 9.5,
    fontStyle: 'italic',
    color: '#9CA3AF',
  },
  qrBox: {
    marginTop: 14,
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
  qrImage: {
    width: 120,
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  qrFootnote: {
    fontSize: 9.5,
    color: '#065F46',
    marginTop: 4,
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
  qrModeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  qrModeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  qrModeToggleBtnActive: {
    backgroundColor: '#FEF08A',
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 1.5, height: 1.5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  qrModeToggleBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4B5563',
  },
  qrModeToggleBtnTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  memberQrsPaperBox: {
    marginTop: 18,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
  },
  memberQrsList: {
    gap: 12,
    marginTop: 10,
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
  memberQrPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  memberQrPlaceholderText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
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
});
