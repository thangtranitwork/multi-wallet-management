import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useWallet } from '../context/WalletContext';
import { TransactionItem } from '../components/TransactionItem';
import { QuickAddModal } from '../components/QuickAddModal';
import { SplitTransactionModal } from '../components/SplitTransactionModal';
import { NeoDropdown } from '../components/NeoDropdown';
import { Transaction } from '../types';
import { THEME, formatVND } from '../constants';

export const TransactionsScreen: React.FC = () => {
  const {
    wallets,
    transactions,
    isLoading,
    isBalanceHidden,
    toggleHideBalance,
    activeWalletFilter,
    setActiveWalletFilter,
    refreshData,
    removeTransaction,
  } = useWallet();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [splitTargetTx, setSplitTargetTx] = useState<Transaction | null>(null);

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    // Filter by type
    if (selectedTypeFilter === 'expense' && t.type !== 'expense' && t.type !== 'debt_lend' && t.type !== 'debt_repay') {
      return false;
    }
    if (selectedTypeFilter === 'income' && t.type !== 'income' && t.type !== 'debt_borrow' && t.type !== 'debt_collect') {
      return false;
    }
    if (selectedTypeFilter === 'transfer' && t.type !== 'transfer') {
      return false;
    }
    if (selectedTypeFilter === 'debt' && !t.type.startsWith('debt_')) {
      return false;
    }

    // Filter by wallet
    if (activeWalletFilter) {
      if (t.wallet_id !== activeWalletFilter && t.to_wallet_id !== activeWalletFilter) {
        return false;
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNote = (t.note || '').toLowerCase().includes(q);
      const matchCat = (t.category_name || '').toLowerCase().includes(q);
      const matchPerson = (t.person_name || '').toLowerCase().includes(q);
      const matchWallet = (t.wallet_name || '').toLowerCase().includes(q);
      const matchAmount = t.amount.toString().includes(q);
      return matchNote || matchCat || matchPerson || matchWallet || matchAmount;
    }

    return true;
  });

  // Group transactions by date
  const groupedTransactions: { [dateStr: string]: Transaction[] } = {};
  filteredTransactions.forEach(t => {
    const d = dayjs(t.transacted_at).format('YYYY-MM-DD');
    if (!groupedTransactions[d]) {
      groupedTransactions[d] = [];
    }
    groupedTransactions[d].push(t);
  });

  const dateKeys = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  const handleDelete = (tx: Transaction) => {
    Alert.alert(
      'Xóa giao dịch',
      `Ngài có chắc muốn xóa giao dịch ${formatVND(tx.amount)}? Số dư ví sẽ được hoàn tác tự động.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            await removeTransaction(tx.id);
          },
        },
      ]
    );
  };

  const typeFilterOptions = [
    { id: 'all', label: 'Tất cả loại', icon: 'apps-outline' },
    { id: 'expense', label: 'Chi tiêu', icon: 'arrow-down-circle-outline', color: '#E11D48' },
    { id: 'income', label: 'Thu nhập', icon: 'arrow-up-circle-outline', color: '#15803D' },
    { id: 'transfer', label: 'Chuyển tiền', icon: 'swap-horizontal-outline', color: '#0284C7' },
    { id: 'debt', label: 'Sổ nợ', icon: 'people-outline', color: '#D97706' },
  ];

  const walletFilterOptions = [
    { id: null, label: 'Tất cả ví', icon: 'wallet-outline' },
    ...wallets.map(w => ({
      id: w.id,
      label: w.name,
      color: w.color || THEME.primary,
      icon: (w.icon as any) || 'wallet-outline',
    })),
  ];

  const selectedTypeLabel =
    typeFilterOptions.find(o => o.id === selectedTypeFilter)?.label || 'Loại GD';

  const selectedWalletLabel =
    activeWalletFilter === null
      ? 'Tất cả ví'
      : wallets.find(w => w.id === activeWalletFilter)?.name || 'Tất cả ví';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>Sổ Giao Dịch</Text>
          <Text style={styles.screenSubtitle}>Lịch sử thu - chi - chuyển khoản</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            style={styles.eyeBtn}
            onPress={toggleHideBalance}
          >
            <Ionicons
              name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color="#000000"
            />
          </Pressable>

          <Pressable
            style={styles.addBtnShadow}
            onPress={() => setQuickAddVisible(true)}
          >
            <View style={styles.addBtnInner}>
              <Ionicons name="add" size={18} color="#000000" />
              <Text style={styles.addBtnText}>Ghi chép</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchShadow}>
        <View style={styles.searchInner}>
          <Ionicons name="search-outline" size={18} color="#000000" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm giao dịch, danh mục, số tiền..."
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#000000" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Dropdown Filters Row */}
      <View style={styles.dropdownFiltersRow}>
        <NeoDropdown
          title="Lọc theo loại giao dịch"
          triggerLabel={selectedTypeLabel}
          triggerIcon="funnel-outline"
          isActive={selectedTypeFilter !== 'all'}
          options={typeFilterOptions}
          selectedValue={selectedTypeFilter}
          onSelect={val => setSelectedTypeFilter(val || 'all')}
          style={{ flex: 1 }}
        />

        <NeoDropdown
          title="Lọc theo nguồn tiền (Ví)"
          triggerLabel={selectedWalletLabel}
          triggerIcon="wallet-outline"
          isActive={activeWalletFilter !== null}
          options={walletFilterOptions}
          selectedValue={activeWalletFilter}
          onSelect={val => setActiveWalletFilter(val)}
          style={{ flex: 1 }}
        />
      </View>

      {/* Transactions List */}
      <ScrollView
        style={styles.listArea}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshData}
            tintColor="#000000"
          />
        }
      >
        {dateKeys.length > 0 ? (
          dateKeys.map(dateKey => {
            const dayTxs = groupedTransactions[dateKey];
            const d = dayjs(dateKey);
            const isToday = d.isSame(dayjs(), 'day');
            const isYesterday = d.isSame(dayjs().subtract(1, 'day'), 'day');

            const dateLabel = isToday
              ? 'Hôm nay'
              : isYesterday
              ? 'Hôm qua'
              : d.format('dddd, DD/MM/YYYY');

            const dayTotal = dayTxs.reduce((sum, t) => {
              if (t.type === 'expense' || t.type === 'debt_lend' || t.type === 'debt_repay') {
                return sum - t.amount;
              }
              if (t.type === 'income' || t.type === 'debt_borrow' || t.type === 'debt_collect') {
                return sum + t.amount;
              }
              return sum;
            }, 0);

            return (
              <View key={dateKey} style={styles.dateGroup}>
                <View style={styles.dateGroupHeader}>
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeText}>{dateLabel}</Text>
                  </View>
                  <Text
                    style={[
                      styles.dayTotalText,
                      dayTotal > 0
                        ? { color: '#15803D' }
                        : dayTotal < 0
                        ? { color: '#E11D48' }
                        : { color: '#6B7280' },
                    ]}
                  >
                    {dayTotal !== 0
                      ? isBalanceHidden
                        ? '••••••'
                        : (dayTotal > 0 ? '+' : '') + formatVND(dayTotal)
                      : ''}
                  </Text>
                </View>

                {dayTxs.map(tx => (
                  <TransactionItem
                    key={tx.id}
                    transaction={tx}
                    isBalanceHidden={isBalanceHidden}
                    onPress={() => {
                      if (tx.type === 'expense') {
                        setSplitTargetTx(tx);
                      }
                    }}
                    onDelete={() => handleDelete(tx)}
                  />
                ))}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCardShadow}>
            <View style={styles.emptyCardInner}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="receipt-outline" size={32} color="#000000" />
              </View>
              <Text style={styles.emptyTitle}>Chưa có giao dịch nào!</Text>
              <Text style={styles.emptySub}>
                Bấm nút "Ghi chép" ở góc trên hoặc nút (+) vàng để lưu lại chi tiêu đầu tiên
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Quick Add Modal */}
      <QuickAddModal
        visible={quickAddVisible}
        onClose={() => setQuickAddVisible(false)}
      />

      {/* Split Transaction Modal */}
      <SplitTransactionModal
        visible={!!splitTargetTx}
        onClose={() => setSplitTargetTx(null)}
        transaction={splitTargetTx}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 2,
  },
  eyeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  addBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.popYellow,
    borderWidth: 2,
    borderColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  searchShadow: {
    backgroundColor: '#000000',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    height: 44,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    height: 44,
    paddingHorizontal: 12,
    transform: [{ translateX: -2.5 }, { translateY: -2.5 }],
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  dropdownFiltersRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  listArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  dateGroup: {
    marginBottom: 16,
  },
  dateGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  dateBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
  },
  dayTotalText: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptyCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 18,
    marginRight: 3,
    marginTop: 20,
  },
  emptyCardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 24,
    alignItems: 'center',
    transform: [{ translateX: -3.5 }, { translateY: -3.5 }],
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.popYellow,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 18,
  },
});
