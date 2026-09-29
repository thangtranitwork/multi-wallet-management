import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import {
  RangeAnalytics,
  AdvancedAnalyticsMetrics,
  DailyAssetPoint,
} from '../../database/queries';
import { Wallet } from '../../types';
import { THEME, formatVND } from '../../constants';
import { DailyCashFlowChart } from '../DailyCashFlowChart';
import { SpendingVelocityChart } from './SpendingVelocityChart';
import { CategoryBudgetCard } from './CategoryBudgetCard';

interface AnalyticsOverviewTabProps {
  rangeData: RangeAnalytics | null;
  advancedData: AdvancedAnalyticsMetrics | null;
  assetTrajectory?: DailyAssetPoint[];
  loadingRange: boolean;
  selectedRange: string;
  daysCount: number;
  wallets: Wallet[];
  totalAssets: number;
  isBalanceHidden?: boolean;
  isFullMonth?: boolean;
  onToggleFullMonth?: () => void;
}

export const AnalyticsOverviewTab: React.FC<AnalyticsOverviewTabProps> = ({
  rangeData,
  advancedData,
  assetTrajectory = [],
  loadingRange,
  selectedRange,
  daysCount,
  wallets,
  totalAssets,
  isBalanceHidden = false,
  isFullMonth = false,
  onToggleFullMonth,
}) => {
  if (loadingRange) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>Đang tổng hợp báo cáo...</Text>
      </View>
    );
  }

  const totalExpense = rangeData?.expense || 0;
  const totalIncome = rangeData?.income || 0;
  const netSavings = rangeData?.net || 0;
  const savingsRate = rangeData?.savingsRate || 0;
  const dailyAverage = Math.round(totalExpense / daysCount);

  // Tỷ lệ thu/chi
  const cashFlowSum = totalIncome + totalExpense;
  const incomePercent =
    cashFlowSum > 0 ? Math.round((totalIncome / cashFlowSum) * 100) : 50;
  const expensePercent = 100 - incomePercent;

  // Tính tỷ trọng tài sản của từng ví
  const effectiveTotalAssets = totalAssets > 0 ? totalAssets : 1;
  const walletAllocations = wallets.map(w => {
    const bal = Math.max(0, w.balance);
    const percent = Math.round((bal / effectiveTotalAssets) * 100);
    return {
      ...w,
      percent,
    };
  });

  const rankColors = ['#E11D48', '#FB7185', '#FB923C', '#FACC15', '#A3A3A3'];

  return (
    <>
      {/* 1. Cash Flow Summary Card */}
      <View style={styles.cardShadow}>
        <View style={styles.cardInner}>
          <View style={[styles.folderTab, { backgroundColor: THEME.primary }]}>
            <Text style={styles.folderTabText}>DÒNG TIỀN THEO KỲ</Text>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cashFlowRow}>
              <View style={styles.cashFlowCol}>
                <Text style={styles.cfLabel}>TỔNG THU</Text>
                <Text
                  style={[styles.cfVal, { color: '#15803D' }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {isBalanceHidden ? '••••••' : formatVND(totalIncome)}
                </Text>
              </View>

              <View style={styles.cfDivider} />

              <View style={styles.cashFlowCol}>
                <Text style={styles.cfLabel}>TỔNG CHI</Text>
                <Text
                  style={[styles.cfVal, { color: '#E11D48' }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
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
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {isBalanceHidden ? '••••••' : formatVND(netSavings)}
                </Text>
              </View>
            </View>

            {/* Meter: Thu vs Chi */}
            <View style={styles.ratioSection}>
              <View style={styles.ratioHeader}>
                <Text style={styles.ratioLabel}>
                  Tương quan Thu ({incomePercent}%) - Chi ({expensePercent}%)
                </Text>
              </View>
              <View style={styles.ratioTrack}>
                <View
                  style={[styles.ratioIncomeFill, { width: `${incomePercent}%` }]}
                />
                <View
                  style={[styles.ratioExpenseFill, { width: `${expensePercent}%` }]}
                />
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
                <Text
                  style={styles.subMetricValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {isBalanceHidden ? '••••••' : formatVND(dailyAverage)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 2. Biến động Tổng Tài Sản & Tốc độ Tiêu tiền (Daily Balance Trajectory) */}
      <View style={styles.cardShadow}>
        <View style={styles.cardInner}>
          <View style={[styles.folderTab, { backgroundColor: '#38BDF8' }]}>
            <Text style={styles.folderTabText}>BIẾN ĐỘNG TÀI SẢN & TỐC ĐỘ TIÊU</Text>
          </View>
          <View style={styles.cardBody}>
            <SpendingVelocityChart
              assetPoints={assetTrajectory}
              isBalanceHidden={isBalanceHidden}
            />
          </View>
        </View>
      </View>

      {/* 3. Daily Cash Flow Chart */}
      <View style={styles.cardShadow}>
        <View style={styles.cardInner}>
          <View style={[styles.folderTab, { backgroundColor: THEME.popBlue }]}>
            <Text style={styles.folderTabText}>BIỂU ĐỒ THU CHI THEO NGÀY</Text>
          </View>
          <View style={styles.cardBody}>
            <DailyCashFlowChart
              dailyStats={advancedData?.dailyStats ?? []}
              isBalanceHidden={isBalanceHidden}
              avgDailyExpense={dailyAverage}
              isMonthRange={selectedRange === 'month'}
              isFullMonth={isFullMonth}
              onToggleFullMonth={onToggleFullMonth}
            />
          </View>
        </View>
      </View>

      {/* 4. Smart Insights */}
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
                  <View
                    style={[styles.insightIconBox, { backgroundColor: '#FFE4E6' }]}
                  >
                    <Ionicons name="trending-up" size={16} color="#E11D48" />
                  </View>
                  <Text style={styles.insightLabel}>NGÀY CHI NHIỀU NHẤT</Text>
                  {advancedData.peakExpenseDay ? (
                    <>
                      <Text
                        style={[styles.insightValue, { color: '#E11D48' }]}
                      >
                        {isBalanceHidden
                          ? '••••••'
                          : formatVND(advancedData.peakExpenseDay.expense)}
                      </Text>
                      <Text style={styles.insightSub}>
                        {dayjs(advancedData.peakExpenseDay.date).format(
                          'DD/MM/YYYY'
                        )}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.insightValueEmpty}>—</Text>
                  )}
                </View>

                {/* Peak Income Day */}
                <View style={[styles.insightCard, styles.insightCardBorder]}>
                  <View
                    style={[styles.insightIconBox, { backgroundColor: '#DCFCE7' }]}
                  >
                    <Ionicons name="trending-down" size={16} color="#15803D" />
                  </View>
                  <Text style={styles.insightLabel}>NGÀY THU NHIỀU NHẤT</Text>
                  {advancedData.peakIncomeDay ? (
                    <>
                      <Text
                        style={[styles.insightValue, { color: '#15803D' }]}
                      >
                        {isBalanceHidden
                          ? '••••••'
                          : formatVND(advancedData.peakIncomeDay.income)}
                      </Text>
                      <Text style={styles.insightSub}>
                        {dayjs(advancedData.peakIncomeDay.date).format(
                          'DD/MM/YYYY'
                        )}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.insightValueEmpty}>—</Text>
                  )}
                </View>

                {/* No-spend days */}
                <View style={[styles.insightCard, styles.insightCardBorder]}>
                  <View
                    style={[styles.insightIconBox, { backgroundColor: '#E0E7FF' }]}
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={16}
                      color="#4338CA"
                    />
                  </View>
                  <Text style={styles.insightLabel}>NGÀY KHÔNG CHI</Text>
                  <Text style={[styles.insightValue, { color: '#059669' }]}>
                    {advancedData.noSpendDays}
                  </Text>
                  <Text style={styles.insightSub}>ngày trong kỳ</Text>
                </View>

                {/* Avg on spend days */}
                <View style={[styles.insightCard, styles.insightCardBorder]}>
                  <View
                    style={[styles.insightIconBox, { backgroundColor: '#FEF3C7' }]}
                  >
                    <Ionicons
                      name="calculator-outline"
                      size={16}
                      color="#B45309"
                    />
                  </View>
                  <Text style={styles.insightLabel}>TB NGÀY CÓ CHI</Text>
                  <Text style={styles.insightValue}>
                    {isBalanceHidden
                      ? '••••••'
                      : formatVND(advancedData.avgExpenseOnSpendDays)}
                  </Text>
                  <Text style={styles.insightSub}>mỗi ngày có chi</Text>
                </View>
              </View>

              {/* Largest transaction */}
              {advancedData.largestExpense && (() => {
                const rawNote = advancedData.largestExpense.note || '';
                const splitMatch = rawNote.match(/\[Đã tách cho ([^\]]+)\]/);
                const cleanNote = rawNote
                  .replace(/\[Đã tách cho [^\]]+\]/, '')
                  .trim();
                const displayTitle =
                  cleanNote ||
                  advancedData.largestExpense.category_name ||
                  'Khoản chi tiêu';
                const splitText = splitMatch ? splitMatch[1] : null;

                return (
                  <View style={styles.largestTxCard}>
                    <View style={styles.largestTxHeader}>
                      <View style={styles.largestTxBadge}>
                        <Ionicons
                          name="receipt-outline"
                          size={12}
                          color="#991B1B"
                        />
                        <Text style={styles.largestTxBadgeText}>
                          Khoản chi lớn nhất
                        </Text>
                      </View>
                      <Text
                        style={[styles.largestTxAmount, { color: '#E11D48' }]}
                      >
                        {isBalanceHidden
                          ? '••••••'
                          : formatVND(advancedData.largestExpense.amount)}
                      </Text>
                    </View>

                    <View style={styles.largestTxBody}>
                      <View
                        style={[
                          styles.largestTxIcon,
                          {
                            backgroundColor:
                              advancedData.largestExpense.category_color ||
                              THEME.popPink,
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            (advancedData.largestExpense
                              .category_icon as any) || 'pricetag-outline'
                          }
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
                            <Ionicons
                              name="people-outline"
                              size={11}
                              color="#4338CA"
                            />
                            <Text
                              style={styles.largestTxSplitText}
                              numberOfLines={1}
                            >
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
                            {dayjs(
                              advancedData.largestExpense.transacted_at
                            ).format('DD/MM/YYYY')}
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

      {/* 5. Top Spending Days */}
      {advancedData && advancedData.topSpendingDays.length > 0 && (
        <View style={styles.cardShadow}>
          <View style={styles.cardInner}>
            <View
              style={[styles.folderTab, { backgroundColor: THEME.popOrange }]}
            >
              <Text style={styles.folderTabText}>TOP NGÀY CHI NHIỀU NHẤT</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.sectionHeaderTitle}>
                5 ngày chi tiêu tốn kém nhất
              </Text>
              {advancedData.topSpendingDays.map((day, idx) => {
                const maxSpend = advancedData.topSpendingDays[0].expense;
                const pct =
                  maxSpend > 0 ? Math.round((day.expense / maxSpend) * 100) : 0;
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
                        <Text
                          style={[styles.topDayAmount, { color: '#E11D48' }]}
                        >
                          {isBalanceHidden
                            ? '••••••'
                            : formatVND(day.expense)}
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

      {/* 6. Category Spending & Budget Breakdown */}
      <CategoryBudgetCard
        categorySpendings={rangeData?.categorySpendings ?? []}
        totalExpense={totalExpense}
        isBalanceHidden={isBalanceHidden}
      />

      {/* 7. Asset Allocation Breakdown */}
      <View style={styles.cardShadow}>
        <View style={styles.cardInner}>
          <View style={[styles.folderTab, { backgroundColor: THEME.popBlue }]}>
            <Text style={styles.folderTabText}>PHÂN BỔ TÀI SẢN</Text>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.sectionHeaderTitle}>
              Tỷ trọng số dư các nguồn tiền
            </Text>

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
  );
};

const styles = StyleSheet.create({
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  cardShadow: {
    backgroundColor: '#000000',
    borderRadius: 12,
    marginBottom: 16,
  },
  cardInner: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    transform: [{ translateX: -3 }, { translateY: -3 }],
    overflow: 'hidden',
  },
  folderTab: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderBottomRightRadius: 8,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#000000',
  },
  folderTabText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: 14,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cashFlowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  cashFlowCol: {
    flex: 1,
    alignItems: 'center',
  },
  cfLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  cfVal: {
    fontSize: 13,
    fontWeight: '900',
  },
  cfDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },
  ratioSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1.5,
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
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#000000',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  ratioIncomeFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  ratioExpenseFill: {
    height: '100%',
    backgroundColor: '#FB7185',
  },
  subMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 10,
  },
  subMetricBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  subMetricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 3,
  },
  subMetricValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  insightCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
  },
  insightCardBorder: {
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  insightIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  insightLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 4,
  },
  insightValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  insightValueEmpty: {
    fontSize: 13,
    fontWeight: '900',
    color: '#9CA3AF',
  },
  insightSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '600',
  },
  largestTxCard: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    padding: 10,
  },
  largestTxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  largestTxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  largestTxBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#991B1B',
  },
  largestTxAmount: {
    fontSize: 13,
    fontWeight: '900',
  },
  largestTxBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  largestTxIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largestTxInfo: {
    flex: 1,
  },
  largestTxNote: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  largestTxSplitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  largestTxSplitText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4338CA',
  },
  largestTxMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  largestTxCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  largestTxMetaDot: {
    marginHorizontal: 4,
    color: '#9CA3AF',
    fontSize: 10,
  },
  largestTxDate: {
    fontSize: 10,
    color: '#6B7280',
  },
  topDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  topDayRankBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topDayRankText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  topDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  topDayDate: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  topDayAmount: {
    fontSize: 11,
    fontWeight: '900',
  },
  topDayTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#000000',
    overflow: 'hidden',
  },
  topDayFill: {
    height: '100%',
    borderRadius: 2,
  },
  allocationRow: {
    marginBottom: 10,
    gap: 4,
  },
  allocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  allocLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allocDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#000000',
  },
  allocName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  allocRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allocAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  percentBadge: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  allocPercent: {
    fontSize: 10,
    fontWeight: '900',
    color: '#374151',
  },
  allocTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#000000',
    overflow: 'hidden',
  },
  allocFill: {
    height: '100%',
    borderRadius: 2,
  },
});
