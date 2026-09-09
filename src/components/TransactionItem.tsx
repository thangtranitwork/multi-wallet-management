import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { Transaction } from '../types';
import { THEME, formatVND } from '../constants';

interface TransactionItemProps {
  transaction: Transaction;
  isBalanceHidden?: boolean;
  onPress?: () => void;
  onDelete?: () => void;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  isBalanceHidden = false,
  onPress,
  onDelete,
}) => {
  const [pressed, setPressed] = useState(false);

  const isIncome =
    transaction.type === 'income' ||
    transaction.type === 'debt_collect' ||
    transaction.type === 'debt_borrow';

  const isExpense =
    transaction.type === 'expense' ||
    transaction.type === 'debt_lend' ||
    transaction.type === 'debt_repay';

  const isTransfer = transaction.type === 'transfer';

  // Neo-Brutalism pop icon colors matching the reference design
  let iconName: any = 'receipt-outline';
  let popBg = THEME.popPink;
  let title = 'Giao dịch';

  if (transaction.type === 'expense') {
    iconName = transaction.category_icon || 'cart-outline';
    popBg = transaction.category_color || THEME.popPink;
    title = transaction.category_name || 'Chi tiêu';
  } else if (transaction.type === 'income') {
    iconName = transaction.category_icon || 'wallet-outline';
    popBg = THEME.primary;
    title = transaction.category_name || 'Thu nhập';
  } else if (transaction.type === 'transfer') {
    iconName = 'swap-horizontal-outline';
    popBg = THEME.popBlue;
    title = `${transaction.wallet_name || 'Ví'} ➔ ${transaction.to_wallet_name || 'Ví'}`;
  } else if (transaction.type === 'debt_lend') {
    iconName = 'arrow-up-circle-outline';
    popBg = THEME.primary;
    title = `Cho ${transaction.person_name || 'người khác'} vay`;
  } else if (transaction.type === 'debt_borrow') {
    iconName = 'arrow-down-circle-outline';
    popBg = THEME.popYellow;
    title = `Vay từ ${transaction.person_name || 'người khác'}`;
  } else if (transaction.type === 'debt_collect') {
    iconName = 'checkmark-circle-outline';
    popBg = THEME.primary;
    title = `Thu nợ từ ${transaction.person_name || 'người khác'}`;
  } else if (transaction.type === 'debt_repay') {
    iconName = 'refresh-circle-outline';
    popBg = THEME.popPink;
    title = `Trả nợ cho ${transaction.person_name || 'người khác'}`;
  }

  const txDate = dayjs(transaction.transacted_at);
  const isToday = txDate.isSame(dayjs(), 'day');
  const dateStr = isToday
    ? `Hôm nay, ${txDate.format('HH:mm')}`
    : txDate.format('DD/MM, HH:mm');

  const shadowOffset = 3;
  const currentOffset = pressed ? 0 : shadowOffset;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.outerWrapper, { marginBottom: shadowOffset + 5 }]}
    >
      <View
        style={[
          styles.innerCard,
          {
            transform: [{ translateX: -currentOffset }, { translateY: -currentOffset }],
          },
        ]}
      >
        {/* Pop Color Squircle Icon */}
        <View style={[styles.iconBox, { backgroundColor: popBg }]}>
          <Ionicons name={iconName} size={20} color="#000000" />
        </View>

        {/* Transaction Text Details */}
        <View style={styles.textDetails}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.subRow}>
            {transaction.wallet_name && !isTransfer && (
              <View style={styles.walletBadge}>
                <Text style={styles.walletBadgeText} numberOfLines={1}>
                  {transaction.wallet_name}
                </Text>
              </View>
            )}
            <Text style={styles.note} numberOfLines={1}>
              {transaction.note || dateStr}
            </Text>
          </View>
        </View>

        {/* Amount */}
        <View style={styles.amountBox}>
          <Text
            style={[
              styles.amount,
              isIncome && styles.incomeColor,
              isExpense && styles.expenseColor,
              isTransfer && styles.transferColor,
            ]}
          >
            {isBalanceHidden
              ? '••••••'
              : `${isIncome ? '+' : isExpense ? '-' : ''}${formatVND(transaction.amount)}`}
          </Text>
          <Text style={styles.timeCaption}>{txDate.format('HH:mm')}</Text>
        </View>

        {/* Quick Delete */}
        {onDelete && (
          <Pressable
            style={styles.deleteBtn}
            onPress={e => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Ionicons name="trash-outline" size={15} color="#6B7280" />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    backgroundColor: '#000000',
    borderRadius: 16,
    marginRight: 3,
  },
  innerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textDetails: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 3,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
  },
  walletBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#000000',
  },
  note: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    flex: 1,
  },
  amountBox: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 14.5,
    fontWeight: '900',
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
  timeCaption: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '700',
    marginTop: 2,
  },
  deleteBtn: {
    marginLeft: 8,
    padding: 4,
  },
});
