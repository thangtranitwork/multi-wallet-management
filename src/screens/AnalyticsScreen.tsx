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
import { RangeAnalytics, AdvancedAnalyticsMetrics } from '../database/queries';
import { hapticLight } from '../utils/haptics';
import { DailyCashFlowChart } from '../components/DailyCashFlowChart';

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
  const [advancedData, setAdvancedData] = useState<AdvancedAnalyticsMetrics | null>(null);
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
      const [data, advanced] = await Promise.all([
        queries.getAnalyticsByRange(db, start, end),
        queries.getAdvancedAnalyticsMetrics(db, start, end),
      ]);
      setRangeData(data);
      setAdvancedData(advanced);
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

            {/* Daily Cash Flow Chart */}
            <View style={styles.cardShadow}>
              <View style={styles.cardInner}>
                <View style={[styles.folderTab, { backgroundColor: THEME.popBlue }]}>
                  <Text style={styles.folderTabText}>BIỂU ĐỒ THEO NGÀY</Text>
                </View>
                <View style={styles.cardBody}>
                  <DailyCashFlowChart
                    dailyStats={advancedData?.dailyStats ?? []}
                    isBalanceHidden={isBalanceHidden}
                    avgDailyExpense={dailyAverage}
                  />
                </View>
              </View>
            </View>

            {/* Smart Insights */}
            {advancedData && (
              <View style={styles.cardShadow}>
                <View style={styles.cardInner}>
                  <View style={[styles.folderTab, { backgroundColor: THEME.popPink }]}>
                    <Text style={styles.folderTabText}>INSIGHTS CHI TIÊU</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.insightGrid}>
                      {/* Peak Expense Day */}
                      <View style={[styles.insightCard, styles.insightCardBorder]}>
                        <View style={[styles.insightIconBox, { backgroundColor: '#FFE4E6' }]}>
                          <Ionicons name="trending-up" size={16} color="#E11D48" />
                        </View>
                        <Text style={styles.insightLabel}>NGÀY CHI NHIỀU NHẤT</Text>
                        {advancedData.peakExpenseDay ? (
                          <>
                            <Text style={[styles.insightValue, { color: '#E11D48' }]}>
                              {isBalanceHidden ? '••••••' : formatVND(advancedData.peakExpenseDay.expense)}
                            </Text>
                            <Text style={styles.insightSub}>
                              {dayjs(advancedData.peakExpenseDay.date).format('DD/MM/YYYY')}
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.insightValueEmpty}>—</Text>
                        )}
                      </View>

                      {/* Peak Income Day */}
                      <View style={[styles.insightCard, styles.insightCardBorder]}>
                        <View style={[styles.insightIconBox, { backgroundColor: '#DCFCE7' }]}>
                          <Ionicons name="trending-down" size={16} color="#15803D" />
                        </View>
                        <Text style={styles.insightLabel}>NGÀY THU NHIỀU NHẤT</Text>
                        {advancedData.peakIncomeDay ? (
                          <>
                            <Text style={[styles.insightValue, { color: '#15803D' }]}>
                              {isBalanceHidden ? '••••••' : formatVND(advancedData.peakIncomeDay.income)}
                            </Text>
                            <Text style={styles.insightSub}>
                              {dayjs(advancedData.peakIncomeDay.date).format('DD/MM/YYYY')}
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.insightValueEmpty}>—</Text>
                        )}
                      </View>

                      {/* No-spend days */}
                      <View style={[styles.insightCard, styles.insightCardBorder]}>
                        <View style={[styles.insightIconBox, { backgroundColor: '#E0E7FF' }]}>
                          <Ionicons name="shield-checkmark-outline" size={16} color="#4338CA" />
                        </View>
                        <Text style={styles.insightLabel}>NGÀY KHÔNG CHI</Text>
                        <Text style={[styles.insightValue, { color: '#059669' }]}>
                          {advancedData.noSpendDays}
                        </Text>
                        <Text style={styles.insightSub}>ngày trong kỳ</Text>
                      </View>

                      {/* Avg on spend days */}
                      <View style={[styles.insightCard, styles.insightCardBorder]}>
                        <View style={[styles.insightIconBox, { backgroundColor: '#FEF3C7' }]}>
                          <Ionicons name="calculator-outline" size={16} color="#B45309" />
                        </View>
                        <Text style={styles.insightLabel}>TB NGÀY CÓ CHI</Text>
                        <Text style={styles.insightValue}>
                          {isBalanceHidden ? '••••••' : formatVND(advancedData.avgExpenseOnSpendDays)}
                        </Text>
                        <Text style={styles.insightSub}>mỗi ngày có chi</Text>
                      </View>
                    </View>

                    {/* Largest transaction */}
                    {advancedData.largestExpense && (() => {
                      const rawNote = advancedData.largestExpense.note || '';
                      const splitMatch = rawNote.match(/\[Đã tách cho ([^\]]+)\]/);
                      const cleanNote = rawNote.replace(/\[Đã tách cho [^\]]+\]/, '').trim();
                      const displayTitle = cleanNote || advancedData.largestExpense.category_name || 'Khoản chi tiêu';
                      const splitText = splitMatch ? splitMatch[1] : null;

                      return (
                        <View style={styles.largestTxCard}>
                          <View style={styles.largestTxHeader}>
                            <View style={styles.largestTxBadge}>
                              <Ionicons name="receipt-outline" size={12} color="#991B1B" />
                              <Text style={styles.largestTxBadgeText}>Khoản chi lớn nhất</Text>
                            </View>
                            <Text style={[styles.largestTxAmount, { color: '#E11D48' }]}>
                              {isBalanceHidden ? '••••••' : formatVND(advancedData.largestExpense.amount)}
                            </Text>
                          </View>

                          <View style={styles.largestTxBody}>
                            <View
                              style={[
                                styles.largestTxIcon,
                                { backgroundColor: advancedData.largestExpense.category_color || THEME.popPink },
                              ]}
                            >
                              <Ionicons
                                name={(advancedData.largestExpense.category_icon as any) || 'pricetag-outline'}
                                size={18}
                                color="#FFFFFF"
                              />
                            </View>
                            <View style={styles.largestTxInfo}>
                              <Text style={styles.largestTxNote} numberOfLines={2}>
                                {displayTitle}
                              </Text>

                              {splitText && (
                                <View style={styles.largestTxSplitBadge}>
                                  <Ionicons name="people-outline" size={11} color="#4338CA" />
                                  <Text style={styles.largestTxSplitText} numberOfLines={1}>
                                    Đã tách: {splitText}
                                  </Text>
                                </View>
                              )}

                              <View style={styles.largestTxMetaRow}>
                                {advancedData.largestExpense.category_name && (
                                  <>
                                    <Text style={styles.largestTxCategory}>
                                      {advancedData.largestExpense.category_name}
                                    </Text>
                                    <Text style={styles.largestTxMetaDot}>•</Text>
                                  </>
                                )}
                                <Text style={styles.largestTxDate}>
                                  {dayjs(advancedData.largestExpense.transacted_at).format('DD/MM/YYYY')}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })()}
                  </View>
                </View>
              </View>
            )}

            {/* Top Spending Days */}
            {advancedData && advancedData.topSpendingDays.length > 0 && (
              <View style={styles.cardShadow}>
                <View style={styles.cardInner}>
                  <View style={[styles.folderTab, { backgroundColor: THEME.popOrange }]}>
                    <Text style={styles.folderTabText}>TOP NGÀY CHI NHIỀU NHẤT</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.sectionHeaderTitle}>5 ngày chi tiêu tốn kém nhất</Text>
                    {advancedData.topSpendingDays.map((day, idx) => {
                      const maxSpend = advancedData.topSpendingDays[0].expense;
                      const pct = maxSpend > 0 ? Math.round((day.expense / maxSpend) * 100) : 0;
                      const rankColors = ['#E11D48', '#FB7185', '#FB923C', '#FACC15', '#A3A3A3'];
                      return (
                        <View key={day.date} style={styles.topDayRow}>
                          <View
                            style={[
                              styles.topDayRankBadge,
                              { backgroundColor: rankColors[idx] ?? '#A3A3A3' },
                            ]}
                          >
                            <Text style={styles.topDayRankText}>#{idx + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.topDayHeader}>
                              <Text style={styles.topDayDate}>
                                {dayjs(day.date).format('DD/MM/YYYY')}
                              </Text>
                              <Text style={[styles.topDayAmount, { color: '#E11D48' }]}>
                                {isBalanceHidden ? '••••••' : formatVND(day.expense)}
                              </Text>
                            </View>
                            <View style={styles.topDayTrack}>
                              <View
                                style={[
                                  styles.topDayFill,
                                  {
                                    width: `${pct}%`,
                                    backgroundColor: rankColors[idx] ?? '#A3A3A3',
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}

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

  // Smart insights grid
  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  insightCard: {
    width: '48%',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    alignItems: 'flex-start',
  },
  insightCardBorder: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  insightIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.2,
  },
  insightValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    marginTop: 4,
  },
  insightValueEmpty: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D1D5DB',
    marginTop: 4,
  },
  insightSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Largest transaction card
  largestTxCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#FFF1F2',
    gap: 10,
  },
  largestTxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  largestTxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  largestTxBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#991B1B',
    textTransform: 'uppercase',
  },
  largestTxAmount: {
    fontSize: 15,
    fontWeight: '900',
  },
  largestTxBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  largestTxIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  largestTxInfo: {
    flex: 1,
    gap: 2,
  },
  largestTxNote: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
    lineHeight: 18,
  },
  largestTxSplitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  largestTxSplitText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4338CA',
  },
  largestTxMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  largestTxCategory: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  largestTxMetaDot: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  largestTxDate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },

  // Top spending days
  topDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  topDayRankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topDayRankText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  topDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  topDayDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  topDayAmount: {
    fontSize: 13,
    fontWeight: '900',
  },
  topDayTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  topDayFill: {
    height: '100%',
    borderRadius: 4,
  },
});
