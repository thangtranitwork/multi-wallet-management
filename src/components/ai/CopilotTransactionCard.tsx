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
} from '../../services/aiCopilotService';
import { THEME, formatVND } from '../../constants';
import { hapticLight, hapticSuccess } from '../../utils/haptics';

export interface CopilotActionData {
  transaction?: CopilotParsedTransaction;
  transactions?: CopilotParsedTransaction[];
  transfer?: CopilotParsedTransfer;
  debt?: CopilotParsedDebt;
  debtSettlement?: CopilotParsedDebtSettlement;
  plannedExpense?: CopilotParsedPlannedExpense;
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
  imageUri,
  imageUris,
  isSaved = false,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(isSaved);

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
    Boolean(plannedExpense);

  if (!hasAnyData) return null;

  const handlePressConfirm = async () => {
    if (saved || loading) return;
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
        imageUri: allImages[0] || imageUri,
        imageUris: allImages.length > 0 ? allImages : imageUris,
      });
      setSaved(true);
      hapticSuccess();
    } catch {
      // lỗi xử lý ở parent
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
              <Text style={styles.batchTotalValue}>{formatVND(totalAmount)}</Text>
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
                          {dayjs(tx.transacted_at).format('HH:mm DD/MM')}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.batchItemAmount,
                        { color: isInc ? '#15803D' : '#E11D48' },
                      ]}
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
                <Text style={styles.savedBadgeText}>
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
                      <Text style={styles.confirmBtnText}>
                        Lưu tất cả {effectiveTransactions.length} giao dịch ({formatVND(totalAmount)})
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
            <Text style={[styles.amountText, { color: '#1D4ED8' }]}>
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
                <Text style={styles.savedBadgeText}>Đã hoàn tất chuyển tiền</Text>
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
                      <Text style={styles.confirmBtnText}>
                        Xác nhận chuyển ({formatVND(transfer.amount)})
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
            <Text style={[styles.amountText, { color: amountColor }]}>
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
                <Text style={styles.savedBadgeText}>
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
                      <Text style={styles.confirmBtnText}>
                        Xác nhận {isReceive ? 'thu nợ' : 'trả nợ'} ({formatVND(debtSettlement.amount)})
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
            <Text style={[styles.amountText, { color: '#7E22CE' }]}>
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
                <Text style={styles.savedBadgeText}>Đã lưu vào Kế hoạch dự chi</Text>
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
                      <Text style={styles.confirmBtnText}>
                        Xác nhận lên lịch ({formatVND(plannedExpense.amount)})
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
            <Text style={[styles.amountText, { color: amountColor }]}>
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
                  {dayjs(effectiveTransaction.transacted_at).format('HH:mm DD/MM')}
                </Text>
              </View>
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
                  <Text style={styles.receiptAttachedSub}>Sẽ tự động lưu vào giao dịch này</Text>
                </View>
                <Ionicons name="checkmark-circle" size={16} color="#0D9488" />
              </View>
            )}

            {saved ? (
              <View style={styles.savedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                <Text style={styles.savedBadgeText}>Đã ghi sổ thành công</Text>
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
                      <Text style={styles.confirmBtnText}>
                        Xác nhận ghi sổ ({formatVND(effectiveTransaction.amount)})
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
            <Text style={[styles.amountText, { color: amountColor }]}>
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
                <Text style={styles.savedBadgeText}>Đã lưu vào Sổ nợ</Text>
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
                      <Text style={styles.confirmBtnText}>
                        Xác nhận ghi nợ ({formatVND(debt.amount)})
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
  },
  walletText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
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
    maxWidth: '42%',
  },
  transferRouteText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
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
  },
  batchTotalLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  batchTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
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
  },
  confirmBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 8,
  },
  confirmBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#86EFAC',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    paddingVertical: 9,
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
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
    paddingVertical: 8,
  },
  savedBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
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
});
