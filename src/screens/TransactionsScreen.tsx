import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  RefreshControl,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import dayjs from 'dayjs';
import { useWallet } from '../context/WalletContext';
import { TransactionItem } from '../components/TransactionItem';
import { QuickAddModal } from '../components/QuickAddModal';
import { SplitTransactionModal } from '../components/SplitTransactionModal';
import { TransactionDetailModal } from '../components/TransactionDetailModal';
import { NeoDropdown } from '../components/NeoDropdown';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { Transaction } from '../types';
import { THEME, formatVND } from '../constants';
import * as queries from '../database/queries';

export const TransactionsScreen: React.FC = () => {
  const db = useSQLiteContext();
  const PAGE_SIZE = 30;

  const {
    wallets,
    transactions,
    isBalanceHidden,
    toggleHideBalance,
    activeWalletFilter,
    setActiveWalletFilter,
    refreshData,
    removeTransaction,
  } = useWallet();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [splitTargetTx, setSplitTargetTx] = useState<Transaction | null>(null);
  const [selectedDetailTx, setSelectedDetailTx] = useState<Transaction | null>(null);
  const [recreateTx, setRecreateTx] = useState<{
    defaultType?: 'expense' | 'income' | 'transfer';
    amount?: number;
    categoryId?: string;
    walletId?: string;
    toWalletId?: string;
    note?: string;
    date?: Date;
  } | null>(null);

  // Pagination & SQLite Filter States
  const [displayedTransactions, setDisplayedTransactions] = useState<Transaction[]>([]);
  const [totalFilteredCount, setTotalFilteredCount] = useState<number>(0);
  const [isLoadingFirstPage, setIsLoadingFirstPage] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Debounce search query to avoid frequent SQLite calls while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch initial page directly from SQLite database
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoadingFirstPage(true);
      const filterOpts: queries.GetTransactionsOptions = {
        walletId: activeWalletFilter,
        type: selectedTypeFilter,
        searchQuery: debouncedSearch,
        limit: PAGE_SIZE,
        offset: 0,
      };

      const [firstPage, totalCount] = await Promise.all([
        queries.getTransactions(db, filterOpts),
        queries.countTransactions(db, filterOpts),
      ]);

      setDisplayedTransactions(firstPage);
      setTotalFilteredCount(totalCount);
      setHasMore(firstPage.length < totalCount);
    } catch (err) {
      console.error('Error loading transactions page 0:', err);
    } finally {
      setIsLoadingFirstPage(false);
    }
  }, [db, activeWalletFilter, selectedTypeFilter, debouncedSearch]);

  // Reload when filters change or when global transactions change
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData, transactions]);

  // Load more on infinite scroll reach end
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || isLoadingFirstPage || isRefreshing) return;
    try {
      setIsLoadingMore(true);
      const nextOffset = displayedTransactions.length;
      const filterOpts: queries.GetTransactionsOptions = {
        walletId: activeWalletFilter,
        type: selectedTypeFilter,
        searchQuery: debouncedSearch,
        limit: PAGE_SIZE,
        offset: nextOffset,
      };

      const nextPage = await queries.getTransactions(db, filterOpts);
      if (nextPage && nextPage.length > 0) {
        setDisplayedTransactions(prev => [...prev, ...nextPage]);
        setHasMore(nextOffset + nextPage.length < totalFilteredCount);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more transactions:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    await loadInitialData();
    setIsRefreshing(false);
  };

  // Group displayed transactions by date
  const groupedTransactions: { [dateStr: string]: Transaction[] } = {};
  displayedTransactions.forEach(t => {
    const d = dayjs(t.transacted_at).format('YYYY-MM-DD');
    if (!groupedTransactions[d]) {
      groupedTransactions[d] = [];
    }
    groupedTransactions[d].push(t);
  });

  // Sort within same day by time desc
  Object.keys(groupedTransactions).forEach(d => {
    groupedTransactions[d].sort((a, b) => {
      const timeA = new Date(a.transacted_at).getTime() || 0;
      const timeB = new Date(b.transacted_at).getTime() || 0;
      return timeB - timeA;
    });
  });

  const dateKeys = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

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

  const formatVietnameseDateHeader = (date: dayjs.Dayjs) => {
    const raw = date.locale('vi').format('dddd, DD/MM/YYYY');
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const renderDateGroup = ({ item: dateKey }: { item: string }) => {
    const dayTxs = groupedTransactions[dateKey];
    if (!dayTxs || dayTxs.length === 0) return null;

    const d = dayjs(dateKey);
    const isToday = d.isSame(dayjs(), 'day');
    const isYesterday = d.isSame(dayjs().subtract(1, 'day'), 'day');

    const dateLabel = isToday
      ? 'Hôm nay'
      : isYesterday
      ? 'Hôm qua'
      : formatVietnameseDateHeader(d);

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
            <Text style={styles.dateBadgeText} numberOfLines={1}>{dateLabel}</Text>
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
            numberOfLines={1}
            adjustsFontSizeToFit
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
            onPress={() => setSelectedDetailTx(tx)}
            onDelete={() => setTxToDelete(tx)}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>Sổ Giao Dịch</Text>
          <Text style={styles.screenSubtitle}>
            {totalFilteredCount} giao dịch{transactions.length > totalFilteredCount ? ` / ${transactions.length}` : ''}
          </Text>
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
            placeholder="Tìm theo mô tả, danh mục, số tiền, ngày..."
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
          title="Lọc theo nguồn tiền"
          triggerLabel={selectedWalletLabel}
          triggerIcon="wallet-outline"
          isActive={activeWalletFilter !== null}
          options={walletFilterOptions}
          selectedValue={activeWalletFilter}
          onSelect={val => setActiveWalletFilter(val)}
          style={{ flex: 1 }}
        />
      </View>

      {/* Transactions Infinite Scroll List */}
      <FlatList
        data={dateKeys}
        keyExtractor={item => item}
        renderItem={renderDateGroup}
        style={styles.listArea}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#000000"
          />
        }
        ListEmptyComponent={
          isLoadingFirstPage ? (
            <View style={styles.emptyCardInner}>
              <ActivityIndicator size="large" color="#000000" style={{ marginVertical: 24 }} />
              <Text style={styles.emptySub}>Đang tải giao dịch...</Text>
            </View>
          ) : (
            <View style={styles.emptyCardShadow}>
              <View style={styles.emptyCardInner}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="receipt-outline" size={32} color="#000000" />
                </View>
                <Text style={styles.emptyTitle}>Chưa có giao dịch nào!</Text>
                <Text style={styles.emptySub}>
                  {debouncedSearch || selectedTypeFilter !== 'all' || activeWalletFilter
                    ? 'Không tìm thấy giao dịch phù hợp với bộ lọc hiện tại.'
                    : 'Bấm nút "Ghi chép" ở góc trên hoặc nút (+) vàng để lưu lại chi tiêu đầu tiên'}
                </Text>
              </View>
            </View>
          )
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.listFooterLoading}>
              <ActivityIndicator size="small" color="#000000" />
              <Text style={styles.listFooterText}>Đang tải thêm giao dịch cũ hơn...</Text>
            </View>
          ) : !hasMore && displayedTransactions.length > 0 ? (
            <View style={styles.listFooterEnd}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#6B7280" />
              <Text style={styles.listFooterText}>
                Đã tải hết toàn bộ {totalFilteredCount} giao dịch
              </Text>
            </View>
          ) : (
            <View style={{ height: 100 }} />
          )
        }
      />

      {/* Quick Add Modal */}
      <QuickAddModal
        visible={quickAddVisible}
        onClose={() => {
          setQuickAddVisible(false);
          setRecreateTx(null);
        }}
        defaultType={recreateTx?.defaultType || 'expense'}
        prefillAmount={recreateTx?.amount}
        prefillCategoryId={recreateTx?.categoryId}
        prefillWalletId={recreateTx?.walletId}
        prefillToWalletId={recreateTx?.toWalletId}
        prefillNote={recreateTx?.note}
        prefillDate={recreateTx?.date}
      />

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        visible={!!selectedDetailTx}
        onClose={() => setSelectedDetailTx(null)}
        transaction={
          selectedDetailTx
            ? transactions.find(t => t.id === selectedDetailTx.id) || selectedDetailTx
            : null
        }
        onSplit={tx => {
          setSelectedDetailTx(null);
          setSplitTargetTx(tx);
        }}
        onRecreate={tx => {
          setSelectedDetailTx(null);
          const tType = tx.type === 'expense' || tx.type === 'income' || tx.type === 'transfer'
            ? tx.type
            : 'expense';
          setRecreateTx({
            defaultType: tType,
            amount: tx.amount,
            categoryId: tx.category_id || undefined,
            walletId: tx.wallet_id,
            toWalletId: tx.to_wallet_id || undefined,
            note: tx.note || undefined,
            date: new Date(tx.transacted_at),
          });
          setQuickAddVisible(true);
        }}
      />

      {/* Split Transaction Modal */}
      <SplitTransactionModal
        visible={!!splitTargetTx}
        onClose={() => setSplitTargetTx(null)}
        transaction={splitTargetTx}
      />

      {/* Delete Confirmation Modal (NO system Alert) */}
      <DeleteConfirmModal
        visible={!!txToDelete}
        transaction={txToDelete}
        isBalanceHidden={isBalanceHidden}
        onClose={() => setTxToDelete(null)}
        onConfirmDelete={async tx => {
          await removeTransaction(tx.id);
          setTxToDelete(null);
        }}
        onRecreate={tx => {
          setTxToDelete(null);
          const tType =
            tx.type === 'expense' || tx.type === 'income' || tx.type === 'transfer'
              ? tx.type
              : 'expense';
          setRecreateTx({
            defaultType: tType,
            amount: tx.amount,
            categoryId: tx.category_id || undefined,
            walletId: tx.wallet_id,
            toWalletId: tx.to_wallet_id || undefined,
            note: tx.note || undefined,
            date: new Date(tx.transacted_at),
          });
          setQuickAddVisible(true);
        }}
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
    flexShrink: 1,
    marginRight: 8,
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
    flexShrink: 0,
    maxWidth: '50%',
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
  listFooterLoading: {
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  listFooterEnd: {
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  listFooterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
});
