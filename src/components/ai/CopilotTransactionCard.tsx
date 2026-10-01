import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import {
  CopilotParsedTransaction,
  CopilotParsedTransfer,
  CopilotParsedDebtSettlement,
  CopilotParsedPlannedExpense,
  CopilotParsedDebt,
  CopilotParsedBalanceAdjustment,
  CopilotParsedDeleteTransaction,
  CopilotParsedUpdateTransaction,
} from '../../services/aiCopilotService';
import { THEME, formatVND } from '../../constants';
import { hapticLight, hapticSuccess } from '../../utils/haptics';

/**
 * Hàm định dạng ngày giờ an toàn cho phản hồi Copilot AI (chống lỗi "Invalid Date")
 * Xử lý được cả chuỗi ISO, chuỗi tiếng Việt "HH:mm DD/MM/YYYY", "DD/MM/YYYY HH:mm", v.v.
 */
export const formatCopilotDate = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();

  // 1. Thử native dayjs trước (hỗ trợ ISO, RFC standard)
  const d = dayjs(trimmed);
  if (d.isValid()) {
    return d.format('HH:mm DD/MM');
  }

  // 2. Định dạng "HH:mm DD/MM/YYYY" hoặc "HH:mm DD/MM" (Gemini hay trích xuất)
  const timeDateMatch = trimmed.match(/(\d{1,2}):(\d{1,2})\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (timeDateMatch) {
    const [, h, m, day, month] = timeDateMatch;
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')} ${day.padStart(2, '0')}/${month.padStart(2, '0')}`;
  }

  // 3. Định dạng "DD/MM/YYYY HH:mm"
  const dateTimeMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+(\d{1,2}):(\d{1,2})/);
  if (dateTimeMatch) {
    const [, day, month, , h, m] = dateTimeMatch;
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')} ${day.padStart(2, '0')}/${month.padStart(2, '0')}`;
  }

  // 4. Định dạng "YYYY-MM-DD HH:mm:ss" hoặc "YYYY-MM-DD"
  const isoMatch = trimmed.match(/(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const [, , month, day, h, m] = isoMatch;
    if (h && m) {
      return `${h}:${m} ${day}/${month}`;
    }
    return `${day}/${month}`;
  }

  // 5. Nếu chuỗi đã là dạng ngắn "10:32 30/09"
  if (trimmed.length <= 14) {
    return trimmed;
  }

  return dayjs().format('HH:mm DD/MM');
};

export interface CopilotActionData {
  transaction?: CopilotParsedTransaction;
  transactions?: CopilotParsedTransaction[];
  transfer?: CopilotParsedTransfer;
  debt?: CopilotParsedDebt;
  debtSettlement?: CopilotParsedDebtSettlement;
  plannedExpense?: CopilotParsedPlannedExpense;
  adjustBalance?: CopilotParsedBalanceAdjustment;
  deleteTransaction?: CopilotParsedDeleteTransaction;
  updateTransaction?: CopilotParsedUpdateTransaction;
  imageUri?: string | null;
  imageUris?: string[] | null;
}

interface CopilotTransactionCardProps {
  transaction?: CopilotParsedTransaction;
  transactions?: CopilotParsedTransaction[];
  transfer?: CopilotParsedTransfer;
  debt?: CopilotParsedDebt;
  debtSettlement?: CopilotParsedDebtSettlement;
  plannedExpense?: CopilotParsedPlannedExpense;
  adjustBalance?: CopilotParsedBalanceAdjustment;
  deleteTransaction?: CopilotParsedDeleteTransaction;
  updateTransaction?: CopilotParsedUpdateTransaction;
  imageUri?: string | null;
  imageUris?: string[] | null;
  isSaved?: boolean;
  onConfirm: (data: CopilotActionData) => Promise<void>;
}

export const CopilotTransactionCard: React.FC<CopilotTransactionCardProps> = ({
  transaction,
  transactions,
  transfer,
  debt,
  debtSettlement,
  plannedExpense,
  adjustBalance,
  deleteTransaction,
  updateTransaction,
  imageUri,
  imageUris,
  isSaved = false,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(isSaved);
  const [showItems, setShowItems] = useState(true);
  const isSubmittingRef = React.useRef(false);

  const effectiveTransaction =
    transaction ||
    (transactions && transactions.length === 1 ? transactions[0] : undefined);
  const effectiveTransactions =
    transactions && transactions.length > 1 ? transactions : undefined;

  const allImages: string[] = [];
  if (Array.isArray(imageUris) && imageUris.length > 0) {
    allImages.push(...imageUris.filter(Boolean));
  } else if (imageUri) {
    allImages.push(imageUri);
  }

  const hasAnyData =
    Boolean(effectiveTransaction) ||
    Boolean(effectiveTransactions) ||
    Boolean(transfer) ||
    Boolean(debt) ||
    Boolean(debtSettlement) ||
    Boolean(plannedExpense) ||
    Boolean(adjustBalance) ||
    Boolean(deleteTransaction) ||
    Boolean(updateTransaction);

  if (!hasAnyData) return null;

  const handlePressConfirm = async () => {
    if (saved || loading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    hapticLight();
    setLoading(true);
    try {
      await onConfirm({
        transaction: effectiveTransaction,
        transactions: effectiveTransactions,
        transfer,
        debt,
        debtSettlement,
        plannedExpense,
        adjustBalance,
        deleteTransaction,
        updateTransaction,
        imageUri: allImages[0] || imageUri,
        imageUris: allImages.length > 0 ? allImages : imageUris,
      });
      setSaved(true);
      hapticSuccess();
    } catch {
      // lỗi xử lý ở parent
      isSubmittingRef.current = false;
    } finally {
      setLoading(false);
    }
  };
  // 1. BATCH TRANSACTIONS (GHI NHIỀU GIAO DỊCH CÙNG LÚC)
  if (effectiveTransactions && effectiveTransactions.length > 1) {
    const totalAmount = effectiveTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    return (
      <View style={styles.cardShadow}>
        <View style={styles.cardInner}>
          <View style={[styles.cardHeaderTag, { backgroundColor: '#E0E7FF' }]}>
            <Ionicons name="layers-outline" size={13} color="#4338CA" />
            <Text style={[styles.cardHeaderTagText, { color: '#4338CA' }]}>
              BỘ GIAO DỊCH HÀNG LOẠT ({effectiveTransactions.length} KHOẢN)
            </Text>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.batchTotalBanner}>
              <Text style={styles.batchTotalLabel}>TỔNG CỘNG</Text>
              <Text
                style={styles.batchTotalValue}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatVND(totalAmount)}
              </Text>
            </View>

            <View style={styles.batchListContainer}>
              {effectiveTransactions.map((tx, idx) => {
                const isInc = tx.type === 'income';
                return (
                  <View
                    key={idx}
                    style={[
                      styles.batchItemRow,
                      idx < effectiveTransactions.length - 1 && styles.batchItemDivider,
                    ]}
                  >
                    <View
                      style={[
                        styles.batchIconBox,
                        { backgroundColor: tx.category_color || THEME.popPink },
                      ]}
                    >
                      <Ionicons
                        name={(tx.category_icon as any) || 'pricetag-outline'}
                        size={13}
                        color="#FFFFFF"
                      />
                    </View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.batchItemTitle} numberOfLines={1}>
                        {tx.note || tx.category_name || 'Giao dịch'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.batchItemSub}>
                          {tx.wallet_name || 'Ví mặc định'}
                        </Text>
                        <Text style={styles.batchItemDot}>•</Text>
                        <Text style={styles.batchItemSub}>
                          {formatCopilotDate(tx.transacted_at)}
                        </Text>
                        {tx.items && tx.items.length > 0 && (
                          <>
                            <Text style={styles.batchItemDot}>•</Text>
                            <Text style={[styles.batchItemSub, { color: '#0F766E', fontWeight: '800' }]}>
                              {tx.items.length} món
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.batchItemAmount,
                        { color: isInc ? '#15803D' : '#E11D48' },
                      ]}
                      numberOfLines={1}
                    >
                      {isInc ? '+' : '-'}
                      {formatVND(tx.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>

            {allImages.length > 0 && (
              <View style={styles.receiptPreviewRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {allImages.slice(0, 3).map((img, idx) => (
                    <Image
                      key={idx}
                      source={{ uri: img }}
                      style={[
                        styles.receiptMiniThumb,
                        idx > 0 && { marginLeft: -14 },
                      ]}
                      resizeMode="cover"
                    />
                  ))}
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.receiptAttachedTitle}>
                    {allImages.length === 1 ? 'Ảnh hóa đơn đính kèm' : `${allImages.length} ảnh hóa đơn đính kèm`}
                  </Text>
                  <Text style={styles.receiptAttachedSub}>Sẽ tự động lưu vào tất cả các giao dịch này</Text>
                </View>
                <Ionicons name="checkmark-circle" size={16} color="#0D9488" />
              </View>
            )}

            {saved ? (
              <View style={styles.savedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                <Text style={styles.savedBadgeText} numberOfLines={2}>
                  Đã lưu tất cả {effectiveTransactions.length} giao dịch thành công
                </Text>
              </View>
            ) : (
              <Pressable
                style={styles.confirmBtnShadow}
                onPress={handlePressConfirm}
                disabled={loading}
              >
                <View style={[styles.confirmBtnInner, { backgroundColor: '#86EFAC' }]}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done" size={18} color="#000000" />
                      <Text
                        style={styles.confirmBtnText}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        Lưu {effectiveTransactions.length} giao dịch • {formatVND(totalAmount)}
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  // 2. CHUYỂN TIỀN LIÊN VÍ (TRANSFER MONEY)
  if (transfer) {
    return (
      <View style={styles.cardShadow}>
        <View style={styles.cardInner}>
          <View style={[styles.cardHeaderTag, { backgroundColor: '#DBEAFE' }]}>
            <Ionicons name="swap-horizontal" size={14} color="#1D4ED8" />
            <Text style={[styles.cardHeaderTagText, { color: '#1D4ED8' }]}>
              CHUYỂN TIỀN LIÊN VÍ
            </Text>
          </View>

          <View style={styles.cardBody}>
            <Text
              style={[styles.amountText, { color: '#1D4ED8' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatVND(transfer.amount)}
            </Text>

            {/* From Wallet -> To Wallet Route */}
            <View style={styles.transferRouteContainer}>
              <View style={styles.transferRouteBox}>
                <Ionicons name="wallet-outline" size={12} color="#000000" />
                <Text style={styles.transferRouteText} numberOfLines={1}>
                  {transfer.from_wallet_name || 'Ví nguồn'}
                </Text>
              </View>

              <Ionicons name="arrow-forward" size={16} color="#4B5563" />

              <View style={[styles.transferRouteBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="wallet-outline" size={12} color="#1D4ED8" />
                <Text style={[styles.transferRouteText, { color: '#1D4ED8' }]} numberOfLines={1}>
                  {transfer.to_wallet_name || 'Ví đích'}
                </Text>
              </View>
            </View>

            {transfer.note && (
              <View style={styles.noteBox}>
                <Ionicons name="document-text-outline" size={13} color="#4B5563" />
                <Text style={styles.noteText}>{transfer.note}</Text>
              </View>
            )}

            {saved ? (
              <View style={styles.savedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                <Text style={styles.savedBadgeText} numberOfLines={2}>
                  Đã hoàn tất chuyển tiền
                </Text>
              </View>
            ) : (
              <Pressable
                style={styles.confirmBtnShadow}
                onPress={handlePressConfirm}
                disabled={loading}
              >
                <View style={[styles.confirmBtnInner, { backgroundColor: '#93C5FD' }]}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#000000" />
                      <Text
                        style={styles.confirmBtnText}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        Xác nhận chuyển • {formatVND(transfer.amount)}
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  // 3. TRẢ NỢ / THU NỢ CŨ (DEBT SETTLEMENT)
  if (debtSettlement) {
    const isReceive = debtSettlement.type === 'receive';
    const amountColor = isReceive ? '#15803D' : '#D97706';

    return (
      <View style={styles.cardShadow}>
        <View style={styles.cardInner}>
          <View
            style={[
              styles.cardHeaderTag,
              { backgroundColor: isReceive ? '#DCFCE7' : '#FEF3C7' },
            ]}
          >
            <Ionicons
              name={isReceive ? 'cash-outline' : 'card-outline'}
              size={13}
              color={amountColor}
            />
            <Text style={[styles.cardHeaderTagText, { color: amountColor }]}>
              {isReceive ? 'THU NỢ (TẤT TOÁN KHOẢN CHO VAY)' : 'TRẢ NỢ (TẤT TOÁN KHOẢN VAY)'}
            </Text>
          </View>

          <View style={styles.cardBody}>
            <Text
              style={[styles.amountText, { color: amountColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {isReceive ? '+' : '-'}
              {formatVND(debtSettlement.amount)}
            </Text>

            <View style={styles.detailRow}>
              <View
                style={[
                  styles.categoryIconBox,
                  { backgroundColor: isReceive ? '#15803D' : '#D97706' },
                ]}
              >
                <Ionicons name="person" size={15} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryNameText}>
                  {isReceive ? 'Người trả:' : 'Chủ nợ:'} {debtSettlement.person_name}
                </Text>
                {debtSettlement.note && (
                  <Text style={styles.noteText} numberOfLines={2}>
                    {debtSettlement.note}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.walletPill}>
                <Ionicons name="wallet-outline" size={12} color="#000000" />
                <Text style={styles.walletText}>
                  {isReceive ? 'Vào ví:' : 'Từ ví:'}{' '}
                  {debtSettlement.wallet_name || 'Ví mặc định'}
                </Text>
              </View>
            </View>

            {saved ? (
              <View style={styles.savedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                <Text style={styles.savedBadgeText} numberOfLines={2}>
                  {isReceive ? 'Đã thu nợ thành công' : 'Đã trả nợ thành công'}
                </Text>
              </View>
            ) : (
              <Pressable
                style={styles.confirmBtnShadow}
                onPress={handlePressConfirm}
                disabled={loading}
              >
                <View
                  style={[
                    styles.confirmBtnInner,
                    { backgroundColor: isReceive ? '#86EFAC' : THEME.popYellow },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#000000" />
                      <Text
                        style={styles.confirmBtnText}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        Xác nhận {isReceive ? 'thu nợ' : 'trả nợ'} • {formatVND(debtSettlement.amount)}
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  // 4. KẾ HOẠCH DỰ CHI (PLANNED EXPENSE)
  if (plannedExpense) {
    return (
      <View style={styles.cardShadow}>
        <View style={styles.cardInner}>
          <View style={[styles.cardHeaderTag, { backgroundColor: '#F3E8FF' }]}>
            <Ionicons name="calendar-outline" size={13} color="#7E22CE" />
            <Text style={[styles.cardHeaderTagText, { color: '#7E22CE' }]}>
              KẾ HOẠCH DỰ CHI TƯƠNG LAI
            </Text>
          </View>

          <View style={styles.cardBody}>
            <Text
              style={[styles.amountText, { color: '#7E22CE' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatVND(plannedExpense.amount)}
            </Text>

            <View style={styles.detailRow}>
              <View
                style={[
                  styles.categoryIconBox,
                  { backgroundColor: '#A855F7' },
                ]}
              >
                <Ionicons name="bookmark-outline" size={15} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryNameText}>{plannedExpense.title}</Text>
                {plannedExpense.note && (
                  <Text style={styles.noteText} numberOfLines={2}>
                    {plannedExpense.note}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={[styles.datePill, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF', borderWidth: 1 }]}>
                <Ionicons name="alarm-outline" size={12} color="#7E22CE" />
                <Text style={[styles.dateText, { color: '#7E22CE', fontWeight: '800' }]}>
                  Hạn: {dayjs(plannedExpense.target_date).format('DD/MM/YYYY')}
                </Text>
              </View>

              {plannedExpense.wallet_name && (
                <View style={styles.walletPill}>
                  <Ionicons name="wallet-outline" size={12} color="#000000" />
                  <Text style={styles.walletText}>{plannedExpense.wallet_name}</Text>
                </View>
              )}
            </View>

            {saved ? (
              <View style={styles.savedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                <Text style={styles.savedBadgeText} numberOfLines={2}>
                  Đã lưu vào Kế hoạch dự chi
                </Text>
              </View>
            ) : (
              <Pressable
                style={styles.confirmBtnShadow}
                onPress={handlePressConfirm}
                disabled={loading}
              >
                <View style={[styles.confirmBtnInner, { backgroundColor: '#D8B4FE' }]}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <Ionicons name="calendar" size={18} color="#000000" />
                      <Text
                        style={styles.confirmBtnText}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        Xác nhận lên lịch • {formatVND(plannedExpense.amount)}
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  // 5. GIAO DỊCH ĐƠN LẺ (SINGLE TRANSACTION)
  if (effectiveTransaction) {
    const isIncome = effectiveTransaction.type === 'income';
    const amountColor = isIncome ? '#15803D' : '#E11D48';

    return (
      <View style={styles.cardShadow}>
        <View style={styles.cardInner}>
          <View
            style={[
              styles.cardHeaderTag,
              { backgroundColor: isIncome ? '#DCFCE7' : '#FEE2E2' },
            ]}
          >
            <Ionicons
              name={isIncome ? 'arrow-down-circle' : 'arrow-up-circle'}
              size={13}
              color={amountColor}
            />
            <Text style={[styles.cardHeaderTagText, { color: amountColor }]}>
              {isIncome ? 'KHOẢN THU NHẬP' : 'KHOẢN CHI TIÊU'}
            </Text>
          </View>

          <View style={styles.cardBody}>
            <Text
              style={[styles.amountText, { color: amountColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {isIncome ? '+' : '-'}
              {formatVND(effectiveTransaction.amount)}
            </Text>

            <View style={styles.detailRow}>
              <View
                style={[
                  styles.categoryIconBox,
                  {
                    backgroundColor:
                      effectiveTransaction.category_color || THEME.popPink,
                  },
                ]}
              >
                <Ionicons
                  name={(effectiveTransaction.category_icon as any) || 'pricetag-outline'}
                  size={15}
                  color="#FFFFFF"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryNameText}>
                  {effectiveTransaction.category_name || 'Khác'}
                </Text>
                {effectiveTransaction.note && (
                  <Text style={styles.noteText} numberOfLines={2}>
                    {effectiveTransaction.note}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.walletPill}>
                <Ionicons name="wallet-outline" size={12} color="#000000" />
                <Text style={styles.walletText}>
                  {effectiveTransaction.wallet_name || 'Ví mặc định'}
                </Text>
              </View>

              <View style={styles.datePill}>
                <Ionicons name="time-outline" size={12} color="#6B7280" />
                <Text style={styles.dateText}>
                  {formatCopilotDate(effectiveTransaction.transacted_at)}
                </Text>
              </View>
            </View>

            {effectiveTransaction.items && effectiveTransaction.items.length > 0 && (
              <View style={styles.receiptItemsBox}>
                <Pressable
                  style={styles.receiptItemsHeader}
                  onPress={() => setShowItems(!showItems)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="receipt-outline" size={13} color="#000000" />
                    <Text style={styles.receiptItemsHeaderTitle}>
                      Chi tiết hóa đơn ({effectiveTransaction.items.length} món)
                    </Text>
                  </View>
                  <Ionicons
                    name={showItems ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="#4B5563"
                  />
                </Pressable>

                {showItems && (
                  <View style={styles.receiptItemsList}>
                    {effectiveTransaction.items.map((it, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.receiptItemRow,
                          idx < (effectiveTransaction.items?.length || 0) - 1 &&
                            styles.receiptItemDivider,
                        ]}
                      >
                        <Text style={styles.receiptItemName} numberOfLines={1}>
                          {it.name} {it.quantity && it.quantity > 1 ? `× ${it.quantity}` : ''}
                        </Text>
                        <Text style={styles.receiptItemPrice}>
                          {it.price && it.price > 0
                            ? formatVND(it.price * (it.quantity || 1))
                            : '---'}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {allImages.length > 0 && (
              <View style={styles.receiptPreviewRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {allImages.slice(0, 3).map((img, idx) => (
                    <Image
                      key={idx}
                      source={{ uri: img }}
                      style={[
                        styles.receiptMiniThumb,
                        idx > 0 && { marginLeft: -14 },
                      ]}
                      resizeMode="cover"
                    />
                  ))}
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.receiptAttachedTitle}>
                    {allImages.length === 1 ? 'Ảnh hóa đơn đính kèm' : `${allImages.length} ảnh hóa đơn đính kèm`}
                  </Text>
                  <Text style={styles.receiptAttachedSub}>Sẽ tự động lưu vào giao dịch này</Text>
                </View>
                <Ionicons name="checkmark-circle" size={16} color="#0D9488" />
              </View>
            )}

            {saved ? (
              <View style={styles.savedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                <Text style={styles.savedBadgeText} numberOfLines={2}>
                  Đã ghi sổ thành công
                </Text>
              </View>
            ) : (
              <Pressable
                style={styles.confirmBtnShadow}
                onPress={handlePressConfirm}
                disabled={loading}
              >
                <View style={styles.confirmBtnInner}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#000000" />
                      <Text
                        style={styles.confirmBtnText}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        Xác nhận ghi sổ • {formatVND(effectiveTransaction.amount)}
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  // 6. GHI NỢ MỚI (NEW DEBT)
  if (debt) {
    const isLend = debt.type === 'lend';
    const amountColor = isLend ? '#D97706' : '#2563EB';

    return (
      <View style={styles.cardShadow}>
        <View style={styles.cardInner}>
          <View
            style={[
              styles.cardHeaderTag,
              { backgroundColor: isLend ? '#FEF3C7' : '#DBEAFE' },
            ]}
          >
            <Ionicons
              name={isLend ? 'arrow-redo' : 'arrow-undo'}
              size={13}
              color={amountColor}
            />
            <Text style={[styles.cardHeaderTagText, { color: amountColor }]}>
              {isLend ? 'CHO VAY (SỔ NỢ)' : 'ĐI VAY (SỔ NỢ)'}
            </Text>
          </View>

          <View style={styles.cardBody}>
            <Text
              style={[styles.amountText, { color: amountColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatVND(debt.amount)}
            </Text>

            <View style={styles.detailRow}>
              <View
                style={[
                  styles.categoryIconBox,
                  { backgroundColor: isLend ? '#F59E0B' : '#3B82F6' },
                ]}
              >
                <Ionicons name="person" size={15} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryNameText}>{debt.person_name}</Text>
                {debt.note && (
                  <Text style={styles.noteText} numberOfLines={2}>
                    {debt.note}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.walletPill}>
                <Ionicons name="wallet-outline" size={12} color="#000000" />
                <Text style={styles.walletText}>
                  {debt.wallet_name || 'Ví mặc định'}
                </Text>
              </View>
            </View>

            {saved ? (
              <View style={styles.savedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                <Text style={styles.savedBadgeText} numberOfLines={2}>
                  Đã lưu vào Sổ nợ
                </Text>
              </View>
            ) : (
              <Pressable
                style={styles.confirmBtnShadow}
                onPress={handlePressConfirm}
                disabled={loading}
              >
                <View style={[styles.confirmBtnInner, { backgroundColor: THEME.popYellow }]}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#000000" />
                      <Text
                        style={styles.confirmBtnText}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        Xác nhận ghi nợ • {formatVND(debt.amount)}
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  // 7. CÂN ĐỐI / ĐIỀU CHỈNH SỐ DƯ VÍ (ADJUST BALANCE)
  if (adjustBalance) {
    const isIncrease = adjustBalance.diff > 0;
    const diffColor = isIncrease ? '#15803D' : '#E11D48';

    return (
      <View style={styles.cardShadow}>
        <View style={styles.cardInner}>
          <View style={[styles.cardHeaderTag, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="scale-outline" size={13} color="#D97706" />
            <Text style={[styles.cardHeaderTagText, { color: '#D97706' }]}>
              ĐIỀU CHỈNH SỐ DƯ VÍ
            </Text>
          </View>

          <View style={styles.cardBody}>
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#1F2937' }}>
                Ví: {adjustBalance.wallet_name}
              </Text>
            </View>

            <View style={styles.balanceCompareBox}>
              <View style={styles.balanceCol}>
                <Text style={styles.balanceColLabel}>SỐ DƯ HIỆN TẠI</Text>
                <Text
                  style={styles.balanceColOld}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatVND(adjustBalance.current_balance)}
                </Text>
              </View>

              <Ionicons name="arrow-forward" size={16} color="#6B7280" />

              <View style={styles.balanceCol}>
                <Text style={styles.balanceColLabel}>SỐ DƯ THỰC TẾ</Text>
                <Text
                  style={styles.balanceColNew}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatVND(adjustBalance.new_balance)}
                </Text>
              </View>
            </View>

            <View style={[styles.diffBadge, { backgroundColor: isIncrease ? '#DCFCE7' : '#FEE2E2' }]}>
              <Ionicons
                name={isIncrease ? 'trending-up' : 'trending-down'}
                size={14}
                color={diffColor}
              />
              <Text style={[styles.diffBadgeText, { color: diffColor }]}>
                {isIncrease ? 'Cộng thêm' : 'Trừ bớt'}: {formatVND(Math.abs(adjustBalance.diff))}
              </Text>
            </View>

            {saved ? (
              <View style={styles.savedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                <Text style={styles.savedBadgeText} numberOfLines={2}>
                  Đã cập nhật số dư ví thành công
                </Text>
              </View>
            ) : (
              <Pressable
                style={styles.confirmBtnShadow}
                onPress={handlePressConfirm}
                disabled={loading}
              >
                <View style={[styles.confirmBtnInner, { backgroundColor: THEME.popYellow }]}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#000000" />
                      <Text
                        style={styles.confirmBtnText}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        Xác nhận chỉnh số dư • {formatVND(adjustBalance.new_balance)}
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  // 8. XÓA GIAO DỊCH (DELETE TRANSACTION)
  if (deleteTransaction) {
    return (
      <View style={styles.cardShadow}>
        <View style={styles.cardInner}>
          <View style={[styles.cardHeaderTag, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="trash-outline" size={13} color="#DC2626" />
            <Text style={[styles.cardHeaderTagText, { color: '#DC2626' }]}>
              XÁC NHẬN XÓA GIAO DỊCH
            </Text>
          </View>

          <View style={styles.cardBody}>
            <Text
              style={[styles.amountText, { color: '#DC2626' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatVND(deleteTransaction.amount)}
            </Text>

            <View style={styles.detailRow}>
              <View style={[styles.categoryIconBox, { backgroundColor: '#EF4444' }]}>
                <Ionicons name="trash" size={15} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryNameText}>
                  {deleteTransaction.note || 'Giao dịch không có ghi chú'}
                </Text>
                <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                  Mã giao dịch: {deleteTransaction.transaction_id}
                </Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              {deleteTransaction.wallet_name && (
                <View style={styles.walletPill}>
                  <Ionicons name="wallet-outline" size={12} color="#000000" />
                  <Text style={styles.walletText}>{deleteTransaction.wallet_name}</Text>
                </View>
              )}

              {deleteTransaction.transacted_at && (
                <View style={styles.datePill}>
                  <Ionicons name="time-outline" size={12} color="#6B7280" />
                  <Text style={styles.dateText}>
                    {formatCopilotDate(deleteTransaction.transacted_at)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.deleteWarningBox}>
              <Ionicons name="alert-circle-outline" size={14} color="#B91C1C" />
              <Text style={styles.deleteWarningText}>
                Số tiền này sẽ được tự động hoàn lại vào số dư ví của bạn.
              </Text>
            </View>

            {saved ? (
              <View style={styles.savedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                <Text style={styles.savedBadgeText} numberOfLines={2}>
                  Đã xóa giao dịch thành công
                </Text>
              </View>
            ) : (
              <Pressable
                style={styles.confirmBtnShadow}
                onPress={handlePressConfirm}
                disabled={loading}
              >
                <View style={[styles.confirmBtnInner, { backgroundColor: '#FCA5A5' }]}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <Ionicons name="trash-bin-outline" size={18} color="#000000" />
                      <Text
                        style={[styles.confirmBtnText, { color: '#991B1B' }]}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        Xác nhận xóa khoản này
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  // 9. CẬP NHẬT GIAO DỊCH (UPDATE TRANSACTION)
  if (updateTransaction) {
    return (
      <View style={styles.cardShadow}>
        <View style={styles.cardInner}>
          <View style={[styles.cardHeaderTag, { backgroundColor: '#EDE9FE' }]}>
            <Ionicons name="create-outline" size={13} color="#6D28D9" />
            <Text style={[styles.cardHeaderTagText, { color: '#6D28D9' }]}>
              CẬP NHẬT GIAO DỊCH
            </Text>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.updateChangesList}>
              {updateTransaction.new_amount !== undefined && (
                <View style={styles.updateChangeRow}>
                  <Text style={styles.updateChangeLabel}>Số tiền:</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {updateTransaction.old_amount !== undefined && (
                      <>
                        <Text style={styles.updateOldValue}>{formatVND(updateTransaction.old_amount)}</Text>
                        <Ionicons name="arrow-forward" size={12} color="#6B7280" />
                      </>
                    )}
                    <Text style={styles.updateNewValue}>{formatVND(updateTransaction.new_amount)}</Text>
                  </View>
                </View>
              )}

              {updateTransaction.new_note !== undefined && (
                <View style={styles.updateChangeRow}>
                  <Text style={styles.updateChangeLabel}>Ghi chú:</Text>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.updateNewValue}>{updateTransaction.new_note}</Text>
                  </View>
                </View>
              )}

              {updateTransaction.new_wallet_name !== undefined && (
                <View style={styles.updateChangeRow}>
                  <Text style={styles.updateChangeLabel}>Ví:</Text>
                  <Text style={styles.updateNewValue}>{updateTransaction.new_wallet_name}</Text>
                </View>
              )}

              {updateTransaction.new_category_name !== undefined && (
                <View style={styles.updateChangeRow}>
                  <Text style={styles.updateChangeLabel}>Danh mục:</Text>
                  <Text style={styles.updateNewValue}>{updateTransaction.new_category_name}</Text>
                </View>
              )}
            </View>

            {saved ? (
              <View style={styles.savedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                <Text style={styles.savedBadgeText} numberOfLines={2}>
                  Đã cập nhật giao dịch thành công
                </Text>
              </View>
            ) : (
              <Pressable
                style={styles.confirmBtnShadow}
                onPress={handlePressConfirm}
                disabled={loading}
              >
                <View style={[styles.confirmBtnInner, { backgroundColor: '#C4B5FD' }]}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done" size={18} color="#000000" />
                      <Text
                        style={styles.confirmBtnText}
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        Xác nhận cập nhật
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  cardShadow: {
    backgroundColor: '#000000',
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  cardInner: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  cardHeaderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
  },
  cardHeaderTagText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  cardBody: {
    padding: 12,
  },
  amountText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  categoryIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  categoryNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  noteText: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  walletText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
    flexShrink: 1,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  dateText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 10,
  },
  transferRouteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    gap: 6,
  },
  transferRouteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flex: 1,
    minWidth: 0,
  },
  transferRouteText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
    flexShrink: 1,
  },
  batchTotalBanner: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    gap: 8,
  },
  batchTotalLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  batchTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
    flexShrink: 1,
    textAlign: 'right',
  },
  batchListContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 12,
  },
  batchItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  batchItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  batchIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  batchItemTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  batchItemSub: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  batchItemDot: {
    fontSize: 10,
    color: '#94A3B8',
  },
  batchItemAmount: {
    fontSize: 12,
    fontWeight: '900',
    flexShrink: 0,
    marginLeft: 6,
  },
  confirmBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 8,
  },
  confirmBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#86EFAC',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 46,
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    flexShrink: 1,
    textAlign: 'center',
    lineHeight: 18,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#15803D',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    minHeight: 42,
  },
  savedBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
    flexShrink: 1,
    textAlign: 'center',
    lineHeight: 16,
  },
  receiptPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    borderRadius: 8,
    padding: 6,
    marginBottom: 10,
  },
  receiptMiniThumb: {
    width: 34,
    height: 34,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#000000',
  },
  receiptAttachedTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F766E',
  },
  receiptAttachedSub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#115E59',
    marginTop: 1,
  },
  receiptItemsBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  receiptItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F1F5F9',
  },
  receiptItemsHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  receiptItemsList: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  receiptItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  receiptItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  receiptItemName: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 8,
  },
  receiptItemPrice: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#000000',
  },
  balanceCompareBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  balanceCol: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  balanceColLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 2,
    flexShrink: 1,
    textAlign: 'center',
  },
  balanceColOld: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textDecorationLine: 'line-through',
    textAlign: 'center',
  },
  balanceColNew: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
  },
  diffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 10,
  },
  diffBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 1,
    textAlign: 'center',
  },
  deleteWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
  },
  deleteWarningText: {
    fontSize: 11,
    color: '#B91C1C',
    fontWeight: '600',
    flex: 1,
  },
  updateChangesList: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    gap: 6,
  },
  updateChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  updateChangeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4B5563',
  },
  updateOldValue: {
    fontSize: 11,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  updateNewValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
});
