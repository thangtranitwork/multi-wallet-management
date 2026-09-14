import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction } from '../types';
import { THEME, formatVND } from '../constants';
import { hapticLight, hapticSuccess, hapticError } from '../utils/haptics';

export interface DeleteConfirmModalProps {
  visible: boolean;
  transaction: Transaction | null;
  isBalanceHidden?: boolean;
  onClose: () => void;
  onConfirmDelete: (tx: Transaction) => Promise<void> | void;
  onRecreate?: (tx: Transaction) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  visible,
  transaction,
  isBalanceHidden = false,
  onClose,
  onConfirmDelete,
  onRecreate,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!transaction) return null;

  const isIncome =
    transaction.type === 'income' ||
    transaction.type === 'debt_collect' ||
    transaction.type === 'debt_borrow';
  const isExpense =
    transaction.type === 'expense' ||
    transaction.type === 'debt_lend' ||
    transaction.type === 'debt_repay';

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    hapticLight();
    try {
      await onConfirmDelete(transaction);
      hapticSuccess();
      onClose();
    } catch (err) {
      hapticError();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRecreate = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    hapticLight();
    try {
      await onConfirmDelete(transaction);
      hapticSuccess();
      onClose();
      if (onRecreate) {
        onRecreate(transaction);
      }
    } catch (err) {
      hapticError();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.confirmBackdrop}>
        <View style={styles.confirmSheet}>
          {/* Warning Icon Badge */}
          <View style={styles.confirmIconBox}>
            <Ionicons name="trash" size={26} color="#EF4444" />
          </View>

          <Text style={styles.confirmTitle}>Xác nhận xóa giao dịch</Text>
          <Text style={styles.confirmDesc}>
            Số dư ví sẽ được tự động hoàn tác. Ngài có thể chọn xóa vĩnh viễn hoặc chuyển sang bộ tạo để điền nhanh lại.
          </Text>

          {/* Transaction Preview Card */}
          <View style={styles.confirmPreviewCard}>
            <View style={styles.confirmPreviewRow}>
              <Text style={styles.confirmPreviewLabel}>Số tiền:</Text>
              <Text
                style={[
                  styles.confirmPreviewAmount,
                  isIncome && styles.incomeColor,
                  isExpense && styles.expenseColor,
                ]}
              >
                {isBalanceHidden
                  ? '••••••'
                  : `${isIncome ? '+' : isExpense ? '-' : ''}${formatVND(transaction.amount)}`}
              </Text>
            </View>
            <View style={styles.confirmPreviewRow}>
              <Text style={styles.confirmPreviewLabel}>Ví:</Text>
              <Text style={styles.confirmPreviewVal} numberOfLines={1}>
                {transaction.wallet_name || 'Ví không xác định'}
              </Text>
            </View>
            {(transaction.category_name || transaction.note) && (
              <View style={styles.confirmPreviewRow}>
                <Text style={styles.confirmPreviewLabel}>
                  {transaction.category_name ? 'Danh mục:' : 'Ghi chú:'}
                </Text>
                <Text style={styles.confirmPreviewVal} numberOfLines={1}>
                  {transaction.category_name || transaction.note}
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons Group */}
          <View style={styles.confirmActionsGroup}>
            {/* Primary Delete Button */}
            <Pressable
              style={[styles.confirmDeletePrimaryBtn, isDeleting && { opacity: 0.7 }]}
              onPress={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="trash-bin-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.confirmDeletePrimaryText}>Xóa vĩnh viễn</Text>
                </>
              )}
            </Pressable>

            {/* Recreate & Quick Fill Button */}
            {onRecreate && (
              <Pressable
                style={[styles.confirmRecreateBtn, isDeleting && { opacity: 0.7 }]}
                onPress={handleRecreate}
                disabled={isDeleting}
              >
                <Ionicons name="refresh-outline" size={20} color="#000000" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.confirmRecreateText}>Xóa & Tạo lại (Điền nhanh)</Text>
                  <Text style={styles.confirmRecreateSub}>
                    Xóa GD này và mở lại bộ tạo với thông tin điền sẵn
                  </Text>
                </View>
              </Pressable>
            )}

            {/* Cancel Button */}
            <Pressable
              style={styles.confirmCancelBtn}
              onPress={onClose}
              disabled={isDeleting}
            >
              <Text style={styles.confirmCancelText}>Hủy bỏ</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  confirmSheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#000000',
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 5, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  confirmIconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    borderWidth: 2.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 6,
    textAlign: 'center',
  },
  confirmDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  confirmPreviewCard: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 12,
    marginBottom: 18,
    gap: 7,
  },
  confirmPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmPreviewLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#6B7280',
  },
  confirmPreviewVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
    maxWidth: '65%',
  },
  confirmPreviewAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
  },
  incomeColor: {
    color: '#15803D',
  },
  expenseColor: {
    color: '#E11D48',
  },
  confirmActionsGroup: {
    width: '100%',
    gap: 10,
  },
  confirmDeletePrimaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  confirmDeletePrimaryText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  confirmRecreateBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF08A',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  confirmRecreateText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
  confirmRecreateSub: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 1,
  },
  confirmCancelBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4B5563',
  },
});
