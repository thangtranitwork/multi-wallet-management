import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useWallet } from '../context/WalletContext';
import { Transaction, Category } from '../types';
import { THEME, formatVND } from '../constants';
import { hapticLight, hapticSuccess, hapticError } from '../utils/haptics';

interface TransactionDetailModalProps {
  visible: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onSplit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  visible,
  onClose,
  transaction,
  onSplit,
  onDelete,
}) => {
  const { categories, updateTransactionCategory, removeTransaction, isBalanceHidden } = useWallet();
  const [isChangingCategory, setIsChangingCategory] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!transaction) return null;

  const isIncome =
    transaction.type === 'income' ||
    transaction.type === 'debt_collect' ||
    transaction.type === 'debt_borrow';

  const isExpense =
    transaction.type === 'expense' ||
    transaction.type === 'debt_lend' ||
    transaction.type === 'debt_repay';

  const isTransfer = transaction.type === 'transfer';
  const isDebt = transaction.type.startsWith('debt_');

  // Category change is eligible for expense & income transactions
  const canChangeCategory = transaction.type === 'expense' || transaction.type === 'income';
  const availableCategories = categories.filter(
    c => c.type === (transaction.type === 'income' ? 'income' : 'expense')
  );

  let typeLabel = 'Giao dịch';
  let typeBadgeBg = '#E5E7EB';
  let typeColor = '#000000';
  let typeIcon: any = 'receipt-outline';

  if (transaction.type === 'expense') {
    typeLabel = 'Khoản chi tiêu';
    typeBadgeBg = '#FFE4E6';
    typeColor = '#E11D48';
    typeIcon = 'arrow-down-circle';
  } else if (transaction.type === 'income') {
    typeLabel = 'Khoản thu nhập';
    typeBadgeBg = '#DCFCE7';
    typeColor = '#15803D';
    typeIcon = 'arrow-up-circle';
  } else if (transaction.type === 'transfer') {
    typeLabel = 'Chuyển tiền nội bộ';
    typeBadgeBg = '#E0F2FE';
    typeColor = '#0284C7';
    typeIcon = 'swap-horizontal';
  } else if (transaction.type === 'debt_lend') {
    typeLabel = 'Cho vay (Sổ nợ)';
    typeBadgeBg = '#FEF08A';
    typeColor = '#854D0E';
    typeIcon = 'send';
  } else if (transaction.type === 'debt_borrow') {
    typeLabel = 'Đi vay (Sổ nợ)';
    typeBadgeBg = '#FEF9C3';
    typeColor = '#A16207';
    typeIcon = 'download';
  } else if (transaction.type === 'debt_collect') {
    typeLabel = 'Thu hồi nợ (Sổ nợ)';
    typeBadgeBg = '#DCFCE7';
    typeColor = '#15803D';
    typeIcon = 'checkmark-circle';
  } else if (transaction.type === 'debt_repay') {
    typeLabel = 'Trả nợ vay (Sổ nợ)';
    typeBadgeBg = '#FCE7F3';
    typeColor = '#9D174D';
    typeIcon = 'refresh-circle';
  }

  const handleSelectCategory = async (cat: Category) => {
    if (isUpdating) return;
    hapticLight();
    setIsUpdating(true);
    try {
      await updateTransactionCategory(transaction.id, cat.id);
      hapticSuccess();
      setIsChangingCategory(false);
    } catch (err: any) {
      hapticError();
      Alert.alert('Lỗi', err?.message || 'Không thể cập nhật danh mục');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = () => {
    hapticLight();
    Alert.alert(
      'Xóa giao dịch',
      `Ngài có chắc muốn xóa giao dịch ${formatVND(transaction.amount)}? Số dư ví sẽ được hoàn tác tự động.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              if (onDelete) {
                onDelete(transaction);
              } else {
                await removeTransaction(transaction.id);
              }
              hapticSuccess();
              onClose();
            } catch (err: any) {
              hapticError();
              Alert.alert('Lỗi', err?.message || 'Không thể xóa giao dịch');
            }
          },
        },
      ]
    );
  };

  const txDate = dayjs(transaction.transacted_at);
  const formattedDate = txDate.format('dddd, DD/MM/YYYY');
  const formattedTime = txDate.format('HH:mm');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.titleBadge}>
                <Ionicons name="receipt-outline" size={16} color="#000000" />
                <Text style={styles.headerTitle}>Chi Tiết Giao Dịch</Text>
              </View>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={THEME.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Amount & Type Hero Card */}
            <View style={styles.heroCard}>
              <View style={[styles.typeBadge, { backgroundColor: typeBadgeBg }]}>
                <Ionicons name={typeIcon} size={14} color={typeColor} />
                <Text style={[styles.typeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
              </View>

              <Text
                style={[
                  styles.heroAmount,
                  isIncome && styles.incomeColor,
                  isExpense && styles.expenseColor,
                  isTransfer && styles.transferColor,
                ]}
              >
                {isBalanceHidden
                  ? '••••••'
                  : `${isIncome ? '+' : isExpense ? '-' : ''}${formatVND(transaction.amount)}`}
              </Text>

              <Text style={styles.heroSubDate}>
                {formattedDate} lúc {formattedTime}
              </Text>
            </View>

            {/* Info Table */}
            <View style={styles.infoSection}>
              {/* Wallet Row */}
              <View style={styles.infoRow}>
                <View style={styles.infoLabelGroup}>
                  <Ionicons name="wallet-outline" size={18} color="#000000" />
                  <Text style={styles.infoLabel}>
                    {isTransfer ? 'Ví gửi' : 'Nguồn tiền (Ví)'}
                  </Text>
                </View>
                <View style={styles.infoValueBadge}>
                  <Text style={styles.infoValueText}>
                    {transaction.wallet_name || 'Ví không xác định'}
                  </Text>
                </View>
              </View>

              {/* Destination Wallet if Transfer */}
              {isTransfer && (
                <View style={styles.infoRow}>
                  <View style={styles.infoLabelGroup}>
                    <Ionicons name="enter-outline" size={18} color="#0284C7" />
                    <Text style={styles.infoLabel}>Ví nhận</Text>
                  </View>
                  <View style={[styles.infoValueBadge, { backgroundColor: '#E0F2FE' }]}>
                    <Text style={[styles.infoValueText, { color: '#0369A1' }]}>
                      {transaction.to_wallet_name || 'Ví không xác định'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Person Name if Debt */}
              {isDebt && transaction.person_name && (
                <View style={styles.infoRow}>
                  <View style={styles.infoLabelGroup}>
                    <Ionicons name="person-outline" size={18} color="#D97706" />
                    <Text style={styles.infoLabel}>Đối tác / Người liên quan</Text>
                  </View>
                  <View style={[styles.infoValueBadge, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.infoValueText, { color: '#92400E', fontWeight: '800' }]}>
                      {transaction.person_name}
                    </Text>
                  </View>
                </View>
              )}

              {/* Note Row */}
              {transaction.note ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoLabelGroup}>
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color="#6B7280" />
                    <Text style={styles.infoLabel}>Ghi chú</Text>
                  </View>
                  <Text style={styles.noteValueText}>{transaction.note}</Text>
                </View>
              ) : null}
            </View>

            {/* Category Section with Change Category Feature */}
            {canChangeCategory && (
              <View style={styles.categorySection}>
                <View style={styles.categoryHeaderRow}>
                  <View style={styles.categoryTitleGroup}>
                    <Ionicons name="pricetags-outline" size={18} color="#000000" />
                    <Text style={styles.categorySectionTitle}>Danh mục</Text>
                  </View>
                  <Pressable
                    style={styles.changeCategoryToggleBtn}
                    onPress={() => {
                      hapticLight();
                      setIsChangingCategory(!isChangingCategory);
                    }}
                  >
                    <Ionicons
                      name={isChangingCategory ? 'chevron-up' : 'create-outline'}
                      size={15}
                      color="#000000"
                    />
                    <Text style={styles.changeCategoryToggleText}>
                      {isChangingCategory ? 'Thu gọn' : 'Đổi danh mục'}
                    </Text>
                  </Pressable>
                </View>

                {/* Current Category Card */}
                <View style={styles.currentCategoryCard}>
                  <View
                    style={[
                      styles.categoryIconBox,
                      { backgroundColor: transaction.category_color || THEME.popPink },
                    ]}
                  >
                    <Ionicons
                      name={(transaction.category_icon as any) || 'cart-outline'}
                      size={20}
                      color="#000000"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.currentCategoryName}>
                      {transaction.category_name || 'Chưa phân loại'}
                    </Text>
                    <Text style={styles.currentCategorySub}>
                      {isChangingCategory ? 'Chọn danh mục mới bên dưới:' : 'Chạm "Đổi danh mục" nếu muốn phân loại lại'}
                    </Text>
                  </View>
                </View>

                {/* Categories Picker Grid */}
                {isChangingCategory && (
                  <View style={styles.pickerContainer}>
                    <Text style={styles.pickerLabel}>Danh sách danh mục có sẵn:</Text>
                    <View style={styles.categoriesGrid}>
                      {availableCategories.map(cat => {
                        const isSelected = transaction.category_id === cat.id;
                        return (
                          <Pressable
                            key={cat.id}
                            style={[
                              styles.catChip,
                              isSelected && styles.catChipSelected,
                            ]}
                            onPress={() => handleSelectCategory(cat)}
                            disabled={isUpdating}
                          >
                            <View
                              style={[
                                styles.catChipIconBox,
                                { backgroundColor: cat.color || THEME.primary },
                              ]}
                            >
                              <Ionicons
                                name={(cat.icon as any) || 'pricetag-outline'}
                                size={16}
                                color="#000000"
                              />
                            </View>
                            <Text
                              style={[
                                styles.catChipText,
                                isSelected && styles.catChipTextSelected,
                              ]}
                              numberOfLines={1}
                            >
                              {cat.name}
                            </Text>
                            {isSelected && (
                              <Ionicons name="checkmark-circle" size={16} color="#000000" />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Actions: Split Bill (for expense) & Delete */}
            <View style={styles.actionsSection}>
              {transaction.type === 'expense' && onSplit && (
                <Pressable
                  style={styles.splitActionBtn}
                  onPress={() => {
                    hapticLight();
                    onClose();
                    onSplit(transaction);
                  }}
                >
                  <View style={styles.splitActionInner}>
                    <Ionicons name="people-outline" size={20} color="#000000" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.splitActionTitle}>Tách tiền (Chia hóa đơn)</Text>
                      <Text style={styles.splitActionSub}>
                        Chuyển một phần chi tiêu này thành khoản người khác nợ
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#000000" />
                  </View>
                </Pressable>
              )}

              <Pressable style={styles.deleteActionBtn} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={styles.deleteActionText}>Xóa giao dịch này</Text>
              </Pressable>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: THEME.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingHorizontal: 20,
    maxHeight: '90%',
    borderTopWidth: 3,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },
  scrollArea: {
    flexGrow: 1,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#000000',
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#000000',
    marginBottom: 10,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  incomeColor: {
    color: '#15803D',
  },
  expenseColor: {
    color: '#E11D48',
  },
  transferColor: {
    color: '#0284C7',
  },
  heroSubDate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  infoValueBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  infoValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  noteValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  categorySection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 14,
    marginBottom: 16,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categorySectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
  },
  changeCategoryToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  changeCategoryToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  currentCategoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  categoryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentCategoryName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  currentCategorySub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  pickerContainer: {
    marginTop: 14,
    borderTopWidth: 1.5,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  catChipSelected: {
    backgroundColor: '#FEF08A',
    borderColor: '#000000',
  },
  catChipIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  catChipTextSelected: {
    fontWeight: '900',
  },
  actionsSection: {
    gap: 10,
    marginTop: 4,
  },
  splitActionBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  splitActionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#FEF08A',
    borderRadius: 14,
  },
  splitActionTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#000000',
  },
  splitActionSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 2,
  },
  deleteActionBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  deleteActionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EF4444',
  },
});
