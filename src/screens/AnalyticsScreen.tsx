import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import dayjs from 'dayjs';
import { useWallet } from '../context/WalletContext';
import { THEME, formatVND } from '../constants';
import * as queries from '../database/queries';
import { RangeAnalytics } from '../database/queries';
import { hapticLight } from '../utils/haptics';

type TimeRangeKey = 'week' | 'month' | 'last_month' | 'year' | 'all';

interface TimeRangeOption {
  key: TimeRangeKey;
  label: string;
}

const TIME_RANGES: TimeRangeOption[] = [
  { key: 'week', label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
  { key: 'last_month', label: 'Tháng trước' },
  { key: 'year', label: 'Năm nay' },
  { key: 'all', label: 'Tất cả' },
];

export const AnalyticsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const db = useSQLiteContext();
  const {
    wallets,
    transactions,
    debts,
    summary,
    isBalanceHidden,
  } = useWallet();

  const [selectedRange, setSelectedRange] = useState<TimeRangeKey>('month');
  const [rangeData, setRangeData] = useState<RangeAnalytics | null>(null);
  const [loadingRange, setLoadingRange] = useState<boolean>(true);

  // Tính khoảng ngày dựa trên filter
  const getDateBounds = useCallback((key: TimeRangeKey): { start: string | null; end: string | null; daysCount: number } => {
    const now = dayjs();
    switch (key) {
      case 'week': {
        const start = now.startOf('week');
        const end = now.endOf('week');
        return { start: start.toISOString(), end: end.toISOString(), daysCount: Math.max(1, now.diff(start, 'day') + 1) };
      }
      case 'month': {
        const start = now.startOf('month');
        const end = now.endOf('month');
        return { start: start.toISOString(), end: end.toISOString(), daysCount: Math.max(1, now.date()) };
      }
      case 'last_month': {
        const lastM = now.subtract(1, 'month');
        const start = lastM.startOf('month');
        const end = lastM.endOf('month');
        return { start: start.toISOString(), end: end.toISOString(), daysCount: start.daysInMonth() };
      }
      case 'year': {
        const start = now.startOf('year');
        const end = now.endOf('year');
        return { start: start.toISOString(), end: end.toISOString(), daysCount: Math.max(1, now.diff(start, 'day') + 1) };
      }
      case 'all':
      default:
        return { start: null, end: null, daysCount: 30 };
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoadingRange(true);
      const { start, end } = getDateBounds(selectedRange);
      const data = await queries.getAnalyticsByRange(db, start, end);
      setRangeData(data);
    } catch (err) {
      console.warn('Lỗi tải dữ liệu phân tích:', err);
    } finally {
      setLoadingRange(false);
    }
  }, [db, selectedRange, getDateBounds]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const { daysCount } = getDateBounds(selectedRange);
  const totalExpense = rangeData?.expense || 0;
  const totalIncome = rangeData?.income || 0;
  const netSavings = rangeData?.net || 0;
  const savingsRate = rangeData?.savingsRate || 0;
  const dailyAverage = Math.round(totalExpense / daysCount);

  // Tỷ lệ thu/chi
  const cashFlowSum = totalIncome + totalExpense;
  const incomePercent = cashFlowSum > 0 ? Math.round((totalIncome / cashFlowSum) * 100) : 50;
  const expensePercent = 100 - incomePercent;

  // Tính tỷ trọng tài sản của từng ví
  const totalAssets = summary?.totalAssets || 1;
  const walletAllocations = wallets.map(w => {
    const bal = Math.max(0, w.balance);
    const percent = Math.round((bal / totalAssets) * 100);
    return {
      ...w,
      percent,
    };
  });

  const handleExportBackup = async () => {
    try {
      const backupData = {
        exported_at: new Date().toISOString(),
        wallets,
        transactions,
        debts,
      };
      const jsonStr = JSON.stringify(backupData, null, 2);

      await Share.share({
        message: jsonStr,
        title: `MultiWallet_Backup_${new Date().toISOString().slice(0, 10)}.json`,
      });
    } catch (err: any) {
      Alert.alert('Lỗi xuất dữ liệu', err?.message || 'Không thể chia sẻ file sao lưu');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {navigation?.canGoBack() && (
            <Pressable
              style={styles.backBtn}
              onPress={() => {
                hapticLight();
                navigation.goBack();
              }}
            >
              <Ionicons name="chevron-back" size={24} color="#000000" />
            </Pressable>
          )}
          <View>
            <Text style={styles.screenTitle}>Báo Cáo & Phân Tích</Text>
            <Text style={styles.screenSubtitle}>Dòng tiền & Cơ cấu tài sản</Text>
          </View>
        </View>

        <Pressable style={styles.shareBtnShadow} onPress={handleExportBackup}>
          <View style={styles.shareBtnInner}>
            <Ionicons name="share-outline" size={16} color="#000000" />
            <Text style={styles.shareBtnText}>Sao lưu</Text>
          </View>
        </Pressable>
      </View>

      {/* Time Range Filter Bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
          {TIME_RANGES.map(item => {
            const isSelected = selectedRange === item.key;
            return (
              <Pressable
                key={item.key}
                style={[
                  styles.filterChipShadow,
                  isSelected && styles.filterChipShadowActive,
                ]}
                onPress={() => {
                  hapticLight();
                  setSelectedRange(item.key);
                }}
              >
                <View
                  style={[
                    styles.filterChipInner,
                    isSelected && styles.filterChipInnerActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loadingRange ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#000000" />
            <Text style={styles.loadingText}>Đang tổng hợp báo cáo...</Text>
          </View>
        ) : (
          <>
            {/* Cash Flow Summary Card */}
            <View style={styles.cardShadow}>
              <View style={styles.cardInner}>
                <View style={[styles.folderTab, { backgroundColor: THEME.primary }]}>
                  <Text style={styles.folderTabText}>DÒNG TIỀN THEO KỲ</Text>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cashFlowRow}>
                    <View style={styles.cashFlowCol}>
                      <Text style={styles.cfLabel}>TỔNG THU</Text>
                      <Text style={[styles.cfVal, { color: '#15803D' }]}>
                        {isBalanceHidden ? '••••••' : formatVND(totalIncome)}
                      </Text>
                    </View>

                    <View style={styles.cfDivider} />

                    <View style={styles.cashFlowCol}>
                      <Text style={styles.cfLabel}>TỔNG CHI</Text>
                      <Text style={[styles.cfVal, { color: '#E11D48' }]}>
                        {isBalanceHidden ? '••••••' : formatVND(totalExpense)}
                      </Text>
                    </View>

                    <View style={styles.cfDivider} />

                    <View style={styles.cashFlowCol}>
                      <Text style={styles.cfLabel}>THẶNG DƯ</Text>
                      <Text
                        style={[
                          styles.cfVal,
                          { color: netSavings >= 0 ? '#0284C7' : '#D97706' },
                        ]}
                      >
                        {isBalanceHidden ? '••••••' : formatVND(netSavings)}
                      </Text>
                    </View>
                  </View>

                  {/* Meter: Thu vs Chi */}
                  <View style={styles.ratioSection}>
                    <View style={styles.ratioHeader}>
                      <Text style={styles.ratioLabel}>Tương quan Thu ({incomePercent}%) - Chi ({expensePercent}%)</Text>
                    </View>
                    <View style={styles.ratioTrack}>
                      <View style={[styles.ratioIncomeFill, { width: `${incomePercent}%` }]} />
                      <View style={[styles.ratioExpenseFill, { width: `${expensePercent}%` }]} />
                    </View>
                  </View>

                  {/* Sub metrics: Tỷ lệ tiết kiệm & Chi tiêu TB ngày */}
                  <View style={styles.subMetricsRow}>
                    <View style={styles.subMetricBox}>
                      <Text style={styles.subMetricLabel}>TỶ LỆ TIẾT KIỆM</Text>
                      <Text style={[styles.subMetricValue, { color: '#059669' }]}>
                        {savingsRate}%
                      </Text>
                    </View>

                    <View style={styles.subMetricBox}>
                      <Text style={styles.subMetricLabel}>CHI TIÊU TB / NGÀY</Text>
                      <Text style={styles.subMetricValue}>
                        {isBalanceHidden ? '••••••' : formatVND(dailyAverage)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Category Spending Breakdown */}
            <View style={styles.cardShadow}>
              <View style={styles.cardInner}>
                <View style={[styles.folderTab, { backgroundColor: THEME.popYellow }]}>
                  <Text style={styles.folderTabText}>CƠ CẤU CHI TIÊU</Text>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.sectionHeaderTitle}>Chi tiết theo từng danh mục</Text>

                  {rangeData && rangeData.categorySpendings.length > 0 ? (
                    rangeData.categorySpendings.map(cat => (
                      <View key={cat.category_id} style={styles.categorySpendItem}>
                        <View style={styles.catSpendHeader}>
                          <View style={styles.catTitleLeft}>
                            <View
                              style={[
                                styles.catIconBox,
                                { backgroundColor: cat.category_color || THEME.popPink },
                              ]}
                            >
                              <Ionicons
                                name={(cat.category_icon as any) || 'pricetag-outline'}
                                size={15}
                                color="#FFFFFF"
                              />
                            </View>
                            <Text style={styles.catNameText}>{cat.category_name}</Text>
                          </View>

                          <View style={styles.catAmountRight}>
                            <Text style={styles.catAmountText}>
                              {isBalanceHidden ? '••••••' : formatVND(cat.total_amount)}
                            </Text>
                            <View style={styles.percentBadge}>
                              <Text style={styles.catPercentText}>{cat.percentage}%</Text>
                            </View>
                          </View>
                        </View>

                        {/* Progress bar */}
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                width: `${cat.percentage}%`,
                                backgroundColor: cat.category_color || THEME.primary,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.noDataBox}>
                      <Ionicons name="pie-chart-outline" size={32} color="#9CA3AF" />
                      <Text style={styles.noDataText}>Chưa có khoản chi tiêu nào trong kỳ này</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Asset Allocation Breakdown */}
            <View style={styles.cardShadow}>
              <View style={styles.cardInner}>
                <View style={[styles.folderTab, { backgroundColor: THEME.popBlue }]}>
                  <Text style={styles.folderTabText}>PHÂN BỔ TÀI SẢN</Text>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.sectionHeaderTitle}>Tỷ trọng số dư các nguồn tiền</Text>

                  {walletAllocations.map(w => (
                    <View key={w.id} style={styles.allocationRow}>
                      <View style={styles.allocHeader}>
                        <View style={styles.allocLeft}>
                          <View
                            style={[
                              styles.allocDot,
                              { backgroundColor: w.color || THEME.primary },
                            ]}
                          />
                          <Text style={styles.allocName}>{w.name}</Text>
                        </View>

                        <View style={styles.allocRight}>
                          <Text style={styles.allocAmount}>
                            {isBalanceHidden ? '••••••' : formatVND(w.balance)}
                          </Text>
                          <View style={styles.percentBadge}>
                            <Text style={styles.allocPercent}>{w.percent}%</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.allocTrack}>
                        <View
                          style={[
                            styles.allocFill,
                            {
                              width: `${w.percent}%`,
                              backgroundColor: w.color || THEME.primary,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    padding: 4,
    marginRight: 2,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  shareBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  shareBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  filterBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingVertical: 10,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  filterChipShadow: {
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  filterChipShadowActive: {
    backgroundColor: '#000000',
  },
  filterChipInner: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    transform: [{ translateX: -1.5 }, { translateY: -1.5 }],
  },
  filterChipInnerActive: {
    backgroundColor: THEME.popYellow,
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4B5563',
  },
  filterChipTextActive: {
    color: '#000000',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  cardShadow: {
    backgroundColor: '#000000',
    borderRadius: 16,
  },
  cardInner: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    transform: [{ translateX: -3 }, { translateY: -3 }],
    overflow: 'hidden',
  },
  folderTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    borderBottomRightRadius: 10,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#000000',
  },
  folderTabText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: 16,
  },
  cashFlowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cashFlowCol: {
    flex: 1,
    alignItems: 'center',
  },
  cfLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 4,
  },
  cfVal: {
    fontSize: 15,
    fontWeight: '900',
  },
  cfDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },
  ratioSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  ratioHeader: {
    marginBottom: 6,
  },
  ratioLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  ratioTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  ratioIncomeFill: {
    backgroundColor: '#10B981',
    height: '100%',
  },
  ratioExpenseFill: {
    backgroundColor: '#EF4444',
    height: '100%',
  },
  subMetricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  subMetricBox: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  subMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 2,
  },
  subMetricValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 14,
  },
  categorySpendItem: {
    marginBottom: 14,
  },
  catSpendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  catTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  catAmountRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catAmountText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  percentBadge: {
    backgroundColor: '#000000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catPercentText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#000000',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  noDataBox: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noDataText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  allocationRow: {
    marginBottom: 14,
  },
  allocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  allocLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allocDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  allocName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  allocRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allocAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  allocPercent: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  allocTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#000000',
    overflow: 'hidden',
  },
  allocFill: {
    height: '100%',
    borderRadius: 4,
  },
});
