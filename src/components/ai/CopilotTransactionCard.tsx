import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import {
  CopilotParsedTransaction,
  CopilotParsedDebt,
} from '../../services/aiCopilotService';
import { THEME, formatVND } from '../../constants';
import { hapticLight, hapticSuccess } from '../../utils/haptics';

interface CopilotTransactionCardProps {
  transaction?: CopilotParsedTransaction;
  debt?: CopilotParsedDebt;
  isSaved?: boolean;
  onConfirm: (data: {
    transaction?: CopilotParsedTransaction;
    debt?: CopilotParsedDebt;
  }) => Promise<void>;
}

export const CopilotTransactionCard: React.FC<CopilotTransactionCardProps> = ({
  transaction,
  debt,
  isSaved = false,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(isSaved);

  if (!transaction && !debt) return null;

  const handlePressConfirm = async () => {
    if (saved || loading) return;
    hapticLight();
    setLoading(true);
    try {
      await onConfirm({ transaction, debt });
      setSaved(true);
      hapticSuccess();
    } catch {
      // lỗi xử lý ở parent
    } finally {
      setLoading(false);
    }
  };

  if (transaction) {
    const isIncome = transaction.type === 'income';
    const amountColor = isIncome ? '#15803D' : '#E11D48';

    return (
      <View style={styles.cardShadow}>
        <View style={styles.cardInner}>
          {/* Card Tag */}
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
            {/* Amount */}
            <Text style={[styles.amountText, { color: amountColor }]}>
              {isIncome ? '+' : '-'}
              {formatVND(transaction.amount)}
            </Text>

            {/* Details */}
            <View style={styles.detailRow}>
              <View
                style={[
                  styles.categoryIconBox,
                  {
                    backgroundColor:
                      transaction.category_color || THEME.popPink,
                  },
                ]}
              >
                <Ionicons
                  name={(transaction.category_icon as any) || 'pricetag-outline'}
                  size={15}
                  color="#FFFFFF"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryNameText}>
                  {transaction.category_name || 'Khác'}
                </Text>
                {transaction.note && (
                  <Text style={styles.noteText} numberOfLines={2}>
                    {transaction.note}
                  </Text>
                )}
              </View>
            </View>

            {/* Meta (Wallet & Time) */}
            <View style={styles.metaRow}>
              <View style={styles.walletPill}>
                <Ionicons name="wallet-outline" size={12} color="#000000" />
                <Text style={styles.walletText}>
                  {transaction.wallet_name || 'Ví mặc định'}
                </Text>
              </View>

              <View style={styles.datePill}>
                <Ionicons name="time-outline" size={12} color="#6B7280" />
                <Text style={styles.dateText}>
                  {dayjs(transaction.transacted_at).format('HH:mm DD/MM')}
                </Text>
              </View>
            </View>

            {/* Confirm Button */}
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
                        Xác nhận ghi sổ ({formatVND(transaction.amount)})
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

  // Debt Card
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
});
