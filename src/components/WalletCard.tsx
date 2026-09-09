import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Wallet } from '../types';
import { THEME, formatVND } from '../constants';

interface WalletCardProps {
  wallet: Wallet;
  isBalanceHidden?: boolean;
  onPress?: () => void;
  onAdjustPress?: () => void;
  variant?: 'folder' | 'full';
}

export const WalletCard: React.FC<WalletCardProps> = ({
  wallet,
  isBalanceHidden = false,
  onPress,
  onAdjustPress,
  variant = 'folder',
}) => {
  const [pressed, setPressed] = useState(false);
  const isCredit = wallet.type === 'credit';
  const displayBalance = isBalanceHidden ? '•••••••• ₫' : formatVND(wallet.balance);

  const cardTabColor = wallet.color || THEME.primary;
  const shadowOffset = 4;
  const currentOffset = pressed ? 0 : shadowOffset;

  const getTypeName = () => {
    switch (wallet.type) {
      case 'cash':
        return 'Tiền mặt';
      case 'bank':
        return 'Ngân hàng';
      case 'e_wallet':
        return 'Ví điện tử';
      case 'credit':
        return 'Thẻ tín dụng';
      case 'savings':
        return 'Tiết kiệm';
      default:
        return 'Nguồn tiền';
    }
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.outerWrapper, { marginBottom: shadowOffset + 4 }]}
    >
      <View
        style={{
          transform: [{ translateX: -currentOffset }, { translateY: -currentOffset }],
        }}
      >
        {/* Top Folder Tab sticking out (Đúng như ảnh mẫu của Ngài) */}
        <View style={[styles.folderTab, { backgroundColor: cardTabColor }]}>
          <Text style={styles.folderTabText} numberOfLines={1}>
            {getTypeName()}
          </Text>
        </View>

        {/* Main Card Surface */}
        <View style={styles.cardBody}>
          {/* Top Row: Icon Squircle + Meta tag + Quick Adjust Button */}
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: cardTabColor }]}>
              <Ionicons
                name={(wallet.icon as any) || 'wallet-outline'}
                size={18}
                color="#000000"
              />
            </View>

            <View style={styles.headerRightActions}>
              {onAdjustPress && (
                <Pressable
                  style={styles.adjustBtn}
                  onPress={e => {
                    e.stopPropagation();
                    onAdjustPress();
                  }}
                >
                  <Ionicons name="swap-vertical" size={12} color="#000000" />
                </Pressable>
              )}
            </View>
          </View>

          {/* Wallet Name (In đậm to bản kiểu Neo-Brutalism) */}
          <Text style={styles.walletTitle} numberOfLines={1}>
            {wallet.name}
          </Text>

          {/* Balance Amount */}
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>
              {isCredit ? 'Dư nợ hiện tại' : 'Số dư'}
            </Text>
            <Text
              style={[
                styles.balanceValue,
                isCredit && wallet.balance > 0 && { color: THEME.danger },
              ]}
              numberOfLines={1}
            >
              {displayBalance}
            </Text>
          </View>

          {/* Credit Limit details if applicable */}
          {isCredit && wallet.credit_limit > 0 && (
            <View style={styles.creditInfoRow}>
              <Text style={styles.creditInfoText}>
                Hạn mức: {isBalanceHidden ? '•••' : formatVND(wallet.credit_limit)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    backgroundColor: '#000000',
    borderRadius: 18,
    marginRight: 4,
    marginTop: 12,
  },
  folderTab: {
    position: 'absolute',
    top: -12,
    left: 12,
    width: 86,
    height: 14,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 2.5,
    borderColor: '#000000',
    borderBottomWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  folderTabText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 14,
    minHeight: 125,
    justifyContent: 'space-between',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adjustBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 4,
  },
  balanceContainer: {
    marginTop: 2,
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.2,
  },
  creditInfoRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  creditInfoText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
});
