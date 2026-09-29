import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PeriodComparisonResult } from '../../types';
import { THEME, formatVND } from '../../constants';
import { hapticLight } from '../../utils/haptics';

export type CategoryFilter = 'all' | 'increase' | 'decrease';

interface AnalyticsComparisonTabProps {
  comparisonData: PeriodComparisonResult | null;
  loadingComparison: boolean;
  categoryFilter: CategoryFilter;
  setCategoryFilter: (filter: CategoryFilter) => void;
  isBalanceHidden?: boolean;
}

export const AnalyticsComparisonTab: React.FC<AnalyticsComparisonTabProps> = ({
  comparisonData,
  loadingComparison,
  categoryFilter,
  setCategoryFilter,
  isBalanceHidden = false,
}) => {
  if (loadingComparison) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>Đang đối chiếu dữ liệu 2 kỳ...</Text>
      </View>
    );
  }

  if (!comparisonData) {
    return (
      <View style={styles.noDataBox}>
        <Ionicons name="git-compare-outline" size={32} color="#9CA3AF" />
        <Text style={styles.noDataText}>
          Chưa có dữ liệu so sánh cho khoảng thời gian này
        </Text>
      </View>
    );
  }

  const {
    period1,
    period2,
    diff,
    categories: compCategories,
    spiked_categories,
  } = comparisonData;

  const filteredCategories = compCategories.filter(cat => {
    if (categoryFilter === 'increase') return cat.diff_amount > 0;
    if (categoryFilter === 'decrease') return cat.diff_amount < 0;
    return true;
  });

  const incCount = compCategories.filter(c => c.diff_amount > 0).length;
  const decCount = compCategories.filter(c => c.diff_amount < 0).length;

  const topCompCategories = [...compCategories]
    .sort(
      (a, b) =>
        Math.max(b.p1_amount, b.p2_amount) - Math.max(a.p1_amount, a.p2_amount)
    )
    .slice(0, 5);
  const maxBarAmount = Math.max(
    ...topCompCategories.map(c => Math.max(c.p1_amount, c.p2_amount)),
    1
  );

  return (
    <>
      {/* 1. KPI Comparison Summary Card */}
      <View style={styles.cardShadow}>
        <View style={styles.cardInner}>
          <View style={[styles.folderTab, { backgroundColor: '#6366F1' }]}>
            <Text style={styles.folderTabText}>ĐỐI CHIẾU DÒNG TIỀN</Text>
          </View>

          <View style={styles.cardBody}>
            {/* Period Headers */}
            <View style={styles.compHeaderRow}>
              <View style={styles.compHeaderPill1}>
                <Text style={styles.compHeaderPillText1}>{period1.label}</Text>
              </View>
              <Text style={styles.compVsText}>VS</Text>
              <View style={styles.compHeaderPill2}>
                <Text style={styles.compHeaderPillText2}>{period2.label}</Text>
              </View>
            </View>

            {/* Metric 1: Total Expense */}
            <View style={styles.compMetricCard}>
              <View style={styles.compMetricHeader}>
                <Text style={styles.compMetricLabel}>TỔNG CHI TIÊU</Text>
                <View
                  style={[
                    styles.compDeltaBadge,
                    diff.expense_diff > 0
                      ? styles.compDeltaBadgeRed
                      : diff.expense_diff < 0
                      ? styles.compDeltaBadgeGreen
                      : styles.compDeltaBadgeGray,
                  ]}
                >
                  <Ionicons
                    name={
                      diff.expense_diff > 0
                        ? 'trending-up'
                        : diff.expense_diff < 0
                        ? 'trending-down'
                        : 'remove'
                    }
                    size={13}
                    color={
                      diff.expense_diff > 0
                        ? '#DC2626'
                        : diff.expense_diff < 0
                        ? '#15803D'
                        : '#4B5563'
                    }
                  />
                  <Text
                    style={[
                      styles.compDeltaBadgeText,
                      {
                        color:
                          diff.expense_diff > 0
                            ? '#DC2626'
                            : diff.expense_diff < 0
                            ? '#15803D'
                            : '#4B5563',
                      },
                    ]}
                  >
                    {diff.expense_diff > 0
                      ? `+${isBalanceHidden ? '•••' : formatVND(diff.expense_diff)} (+${diff.expense_diff_percent}%)`
                      : diff.expense_diff < 0
                      ? `-${isBalanceHidden ? '•••' : formatVND(Math.abs(diff.expense_diff))} (${diff.expense_diff_percent}%)`
                      : 'Không đổi'}
                  </Text>
                </View>
              </View>

              <View style={styles.compRowValues}>
                <View style={styles.compColVal}>
                  <Text style={styles.compSubPeriodLabel}>{period1.label}</Text>
                  <Text
                    style={[styles.compBigVal, { color: '#E11D48' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {isBalanceHidden ? '••••••' : formatVND(period1.expense)}
                  </Text>
                </View>
                <View style={styles.compValDivider} />
                <View style={styles.compColVal}>
                  <Text style={styles.compSubPeriodLabel}>{period2.label}</Text>
                  <Text
                    style={[styles.compBigVal, { color: '#6B7280' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {isBalanceHidden ? '••••••' : formatVND(period2.expense)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Metric 2: Total Income */}
            <View style={[styles.compMetricCard, { marginTop: 10 }]}>
              <View style={styles.compMetricHeader}>
                <Text style={styles.compMetricLabel}>TỔNG THU NHẬP</Text>
                <View
                  style={[
                    styles.compDeltaBadge,
                    diff.income_diff > 0
                      ? styles.compDeltaBadgeGreen
                      : diff.income_diff < 0
                      ? styles.compDeltaBadgeOrange
                      : styles.compDeltaBadgeGray,
                  ]}
                >
                  <Ionicons
                    name={
                      diff.income_diff > 0
                        ? 'trending-up'
                        : diff.income_diff < 0
                        ? 'trending-down'
                        : 'remove'
                    }
                    size={13}
                    color={
                      diff.income_diff > 0
                        ? '#15803D'
                        : diff.income_diff < 0
                        ? '#D97706'
                        : '#4B5563'
                    }
                  />
                  <Text
                    style={[
                      styles.compDeltaBadgeText,
                      {
                        color:
                          diff.income_diff > 0
                            ? '#15803D'
                            : diff.income_diff < 0
                            ? '#D97706'
                            : '#4B5563',
                      },
                    ]}
                  >
                    {diff.income_diff > 0
                      ? `+${isBalanceHidden ? '•••' : formatVND(diff.income_diff)} (+${diff.income_diff_percent}%)`
                      : diff.income_diff < 0
                      ? `-${isBalanceHidden ? '•••' : formatVND(Math.abs(diff.income_diff))} (${diff.income_diff_percent}%)`
                      : 'Không đổi'}
                  </Text>
                </View>
              </View>

              <View style={styles.compRowValues}>
                <View style={styles.compColVal}>
                  <Text style={styles.compSubPeriodLabel}>{period1.label}</Text>
                  <Text
                    style={[styles.compBigVal, { color: '#15803D' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {isBalanceHidden ? '••••••' : formatVND(period1.income)}
                  </Text>
                </View>
                <View style={styles.compValDivider} />
                <View style={styles.compColVal}>
                  <Text style={styles.compSubPeriodLabel}>{period2.label}</Text>
                  <Text
                    style={[styles.compBigVal, { color: '#6B7280' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {isBalanceHidden ? '••••••' : formatVND(period2.income)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Metric 3: Net Savings */}
            <View style={[styles.compMetricCard, { marginTop: 10 }]}>
              <View style={styles.compMetricHeader}>
                <Text style={styles.compMetricLabel}>THẶNG DƯ (TIẾT KIỆM)</Text>
                <Text
                  style={[
                    styles.compDeltaNetText,
                    {
                      color: diff.net_diff >= 0 ? '#059669' : '#DC2626',
                    },
                  ]}
                >
                  {diff.net_diff >= 0 ? '+' : ''}
                  {isBalanceHidden ? '•••' : formatVND(diff.net_diff)}
                </Text>
              </View>

              <View style={styles.compRowValues}>
                <View style={styles.compColVal}>
                  <Text style={styles.compSubPeriodLabel}>{period1.label}</Text>
                  <Text
                    style={[
                      styles.compBigVal,
                      { color: period1.net >= 0 ? '#0284C7' : '#D97706' },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {isBalanceHidden ? '••••••' : formatVND(period1.net)}
                  </Text>
                </View>
                <View style={styles.compValDivider} />
                <View style={styles.compColVal}>
                  <Text style={styles.compSubPeriodLabel}>{period2.label}</Text>
                  <Text
                    style={[styles.compBigVal, { color: '#6B7280' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {isBalanceHidden ? '••••••' : formatVND(period2.net)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 2. Spike Warning Card: Thủ phạm gây hao hụt ví */}
      <View style={styles.cardShadow}>
        <View
          style={[
            styles.cardInner,
            spiked_categories.length > 0 && styles.spikeCardInnerBorder,
          ]}
        >
          <View
            style={[
              styles.folderTab,
              {
                backgroundColor:
                  spiked_categories.length > 0 ? '#DC2626' : '#10B981',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons
                name={
                  spiked_categories.length > 0 ? 'flame' : 'checkmark-circle'
                }
                size={14}
                color="#FFFFFF"
              />
              <Text style={styles.folderTabText}>
                {spiked_categories.length > 0
                  ? 'THỦ PHẠM GÂY HAO HỤT VÍ'
                  : 'KIỂM SOÁT TỐT'}
              </Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            {spiked_categories.length > 0 ? (
              <>
                <Text style={styles.spikeHeadingText}>
                  Phát hiện{' '}
                  <Text style={{ fontWeight: '900', color: '#DC2626' }}>
                    {spiked_categories.length} danh mục
                  </Text>{' '}
                  có chi tiêu tăng vọt so với kỳ trước ({'>'}20% & {'>'}200k):
                </Text>

                {spiked_categories.map(cat => (
                  <View key={cat.category_id} style={styles.spikeItemContainer}>
                    <View style={styles.spikeItemTopRow}>
                      <View
                        style={[
                          styles.catIconBox,
                          {
                            backgroundColor:
                              cat.category_color || THEME.popPink,
                          },
                        ]}
                      >
                        <Ionicons
                          name={(cat.category_icon as any) || 'pricetag-outline'}
                          size={16}
                          color="#FFFFFF"
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.spikeItemName}>
                          {cat.category_name}
                        </Text>
                        <Text style={styles.spikeItemPeriods}>
                          Kỳ trước: {isBalanceHidden ? '•••' : formatVND(cat.p2_amount)}{' '}
                          → Kỳ này: {isBalanceHidden ? '•••' : formatVND(cat.p1_amount)}
                        </Text>
                      </View>
                      <View style={styles.spikeBadge}>
                        <Ionicons name="arrow-up" size={13} color="#FFFFFF" />
                        <Text style={styles.spikeBadgeText}>
                          +{cat.diff_percent}%
                        </Text>
                      </View>
                    </View>
                    <View style={styles.spikeBottomBar}>
                      <Text style={styles.spikeBottomLabel}>Tăng thêm:</Text>
                      <Text style={styles.spikeBottomAmount}>
                        +{isBalanceHidden ? '••••••' : formatVND(cat.diff_amount)}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <View style={styles.safeBox}>
                <Ionicons name="shield-checkmark" size={32} color="#10B981" />
                <Text style={styles.safeBoxTitle}>Tài chính ổn định!</Text>
                <Text style={styles.safeBoxDesc}>
                  Không có danh mục nào chi tiêu tăng đột biến quá 20% so với kỳ
                  trước. Bạn đang kiểm soát ngân sách rất tốt.
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* 3. Side-by-Side Category Comparative Bars */}
      {topCompCategories.length > 0 && (
        <View style={styles.cardShadow}>
          <View style={styles.cardInner}>
            <View style={[styles.folderTab, { backgroundColor: THEME.popYellow }]}>
              <Text style={styles.folderTabText}>BIỂU ĐỒ SO SÁNH DANH MỤC</Text>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.sectionHeaderTitle}>
                Top 5 danh mục có chi tiêu lớn nhất
              </Text>

              {/* Legend */}
              <View style={styles.chartLegendRow}>
                <View style={styles.legendDotItem}>
                  <View
                    style={[
                      styles.chartLegendSquare,
                      { backgroundColor: '#000000' },
                    ]}
                  />
                  <Text style={styles.chartLegendLabel}>{period1.label}</Text>
                </View>
                <View style={styles.legendDotItem}>
                  <View
                    style={[
                      styles.chartLegendSquare,
                      {
                        backgroundColor: '#E5E7EB',
                        borderColor: '#9CA3AF',
                        borderWidth: 1,
                      },
                    ]}
                  />
                  <Text style={styles.chartLegendLabel}>{period2.label}</Text>
                </View>
              </View>

              {topCompCategories.map(cat => {
                const p1Width = Math.max(
                  Math.round((cat.p1_amount / maxBarAmount) * 100),
                  4
                );
                const p2Width = Math.max(
                  Math.round((cat.p2_amount / maxBarAmount) * 100),
                  4
                );

                return (
                  <View key={cat.category_id} style={styles.sideBySideRow}>
                    <View style={styles.sideBySideHeader}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <View
                          style={[
                            styles.miniCatDot,
                            {
                              backgroundColor:
                                cat.category_color || THEME.primary,
                            },
                          ]}
                        />
                        <Text style={styles.sideBySideCatName}>
                          {cat.category_name}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.sideBySideDiff,
                          {
                            color:
                              cat.diff_amount > 0
                                ? '#DC2626'
                                : cat.diff_amount < 0
                                ? '#15803D'
                                : '#6B7280',
                          },
                        ]}
                      >
                        {cat.diff_amount > 0
                          ? `+${cat.diff_percent}%`
                          : cat.diff_amount < 0
                          ? `${cat.diff_percent}%`
                          : '0%'}
                      </Text>
                    </View>

                    {/* Bar 1: Period 1 */}
                    <View style={styles.barLineRow}>
                      <View style={[styles.barLineTrack]}>
                        <View
                          style={[
                            styles.barLineFillP1,
                            {
                              width: `${p1Width}%`,
                              backgroundColor:
                                cat.category_color || '#000000',
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLineAmtP1}>
                        {isBalanceHidden ? '•••' : formatVND(cat.p1_amount)}
                      </Text>
                    </View>

                    {/* Bar 2: Period 2 */}
                    <View style={[styles.barLineRow, { marginTop: 3 }]}>
                      <View style={[styles.barLineTrack]}>
                        <View
                          style={[
                            styles.barLineFillP2,
                            { width: `${p2Width}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLineAmtP2}>
                        {isBalanceHidden ? '•••' : formatVND(cat.p2_amount)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* 4. Detailed Category Delta Table */}
      <View style={styles.cardShadow}>
        <View style={styles.cardInner}>
          <View style={[styles.folderTab, { backgroundColor: THEME.popBlue }]}>
            <Text style={styles.folderTabText}>CHI TIẾT MỨC BIẾN ĐỘNG</Text>
          </View>

          <View style={styles.cardBody}>
            {/* Category Filter Chips */}
            <View style={styles.catFilterRow}>
              {(
                [
                  {
                    key: 'all' as CategoryFilter,
                    label: `Tất cả (${compCategories.length})`,
                  },
                  {
                    key: 'increase' as CategoryFilter,
                    label: `Tăng (${incCount})`,
                  },
                  {
                    key: 'decrease' as CategoryFilter,
                    label: `Giảm (${decCount})`,
                  },
                ] as const
              ).map(f => (
                <Pressable
                  key={f.key}
                  style={[
                    styles.catFilterChip,
                    categoryFilter === f.key && styles.catFilterChipActive,
                  ]}
                  onPress={() => {
                    hapticLight();
                    setCategoryFilter(f.key);
                  }}
                >
                  <Text
                    style={[
                      styles.catFilterChipText,
                      categoryFilter === f.key && styles.catFilterChipTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {filteredCategories.length > 0 ? (
              filteredCategories.map(cat => (
                <View
                  key={cat.category_id}
                  style={[
                    styles.catDeltaRow,
                    cat.is_spike && styles.catDeltaRowSpike,
                  ]}
                >
                  <View style={styles.catDeltaLeft}>
                    <View
                      style={[
                        styles.catIconBox,
                        {
                          backgroundColor: cat.category_color || THEME.popPink,
                        },
                      ]}
                    >
                      <Ionicons
                        name={(cat.category_icon as any) || 'pricetag-outline'}
                        size={15}
                        color="#FFFFFF"
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Text style={styles.catDeltaName}>
                          {cat.category_name}
                        </Text>
                        {cat.is_spike && (
                          <View style={styles.spikeTag}>
                            <Text style={styles.spikeTagText}>ĐỘT BIẾN</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.catDeltaSub}>
                        {isBalanceHidden ? '•••' : formatVND(cat.p1_amount)} vs{' '}
                        {isBalanceHidden ? '•••' : formatVND(cat.p2_amount)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.catDeltaRight}>
                    <Text
                      style={[
                        styles.catDeltaAmt,
                        {
                          color:
                            cat.diff_amount > 0
                              ? '#DC2626'
                              : cat.diff_amount < 0
                              ? '#15803D'
                              : '#6B7280',
                        },
                      ]}
                    >
                      {cat.diff_amount > 0
                        ? `+${isBalanceHidden ? '•••' : formatVND(cat.diff_amount)}`
                        : cat.diff_amount < 0
                        ? `-${isBalanceHidden ? '•••' : formatVND(Math.abs(cat.diff_amount))}`
                        : '0 ₫'}
                    </Text>
                    <View
                      style={[
                        styles.catDeltaPctBadge,
                        {
                          backgroundColor:
                            cat.diff_amount > 0
                              ? '#FFE4E6'
                              : cat.diff_amount < 0
                              ? '#DCFCE7'
                              : '#F3F4F6',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.catDeltaPctText,
                          {
                            color:
                              cat.diff_amount > 0
                                ? '#DC2626'
                                : cat.diff_amount < 0
                                ? '#15803D'
                                : '#4B5563',
                          },
                        ]}
                      >
                        {cat.diff_amount > 0
                          ? `+${cat.diff_percent}%`
                          : `${cat.diff_percent}%`}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.noDataBox}>
                <Text style={styles.noDataText}>
                  Không có danh mục nào trong nhóm này
                </Text>
              </View>
            )}
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
  noDataBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  noDataText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
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
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: 14,
  },
  compHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 14,
  },
  compHeaderPill1: {
    backgroundColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  compHeaderPillText1: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
  },
  compVsText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#9CA3AF',
  },
  compHeaderPill2: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  compHeaderPillText2: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 11,
  },
  compMetricCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    padding: 10,
  },
  compMetricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  compMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  compDeltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  compDeltaBadgeRed: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  compDeltaBadgeGreen: {
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  compDeltaBadgeOrange: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  compDeltaBadgeGray: {
    backgroundColor: '#F3F4F6',
    borderColor: '#9CA3AF',
  },
  compDeltaBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  compDeltaNetText: {
    fontSize: 11,
    fontWeight: '900',
  },
  compRowValues: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compColVal: {
    flex: 1,
  },
  compSubPeriodLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 2,
  },
  compBigVal: {
    fontSize: 13,
    fontWeight: '900',
  },
  compValDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 10,
  },
  spikeCardInnerBorder: {
    borderColor: '#DC2626',
  },
  spikeHeadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
    lineHeight: 16,
  },
  spikeItemContainer: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  spikeItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spikeItemName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  spikeItemPeriods: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  spikeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  spikeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  spikeBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#FECDD3',
  },
  spikeBottomLabel: {
    fontSize: 10,
    color: '#991B1B',
    fontWeight: '700',
  },
  spikeBottomAmount: {
    fontSize: 11,
    fontWeight: '900',
    color: '#DC2626',
  },
  safeBox: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  safeBoxTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#10B981',
  },
  safeBoxDesc: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 16,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  legendDotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chartLegendSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  chartLegendLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  sideBySideRow: {
    marginBottom: 12,
  },
  sideBySideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  miniCatDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sideBySideCatName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  sideBySideDiff: {
    fontSize: 11,
    fontWeight: '900',
  },
  barLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLineTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#000000',
    overflow: 'hidden',
  },
  barLineFillP1: {
    height: '100%',
    borderRadius: 2,
  },
  barLineFillP2: {
    height: '100%',
    backgroundColor: '#9CA3AF',
    borderRadius: 2,
  },
  barLineAmtP1: {
    width: 70,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
    color: '#000000',
  },
  barLineAmtP2: {
    width: 70,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'right',
    color: '#6B7280',
  },
  catFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  catFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  catFilterChipActive: {
    backgroundColor: THEME.popYellow,
    borderColor: '#000000',
    borderWidth: 1.5,
  },
  catFilterChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  catFilterChipTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  catDeltaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  catDeltaRowSpike: {
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  catDeltaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  catDeltaName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  spikeTag: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  spikeTagText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  catDeltaSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  catDeltaRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  catDeltaAmt: {
    fontSize: 12,
    fontWeight: '900',
  },
  catDeltaPctBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#000000',
  },
  catDeltaPctText: {
    fontSize: 10,
    fontWeight: '900',
  },
});
