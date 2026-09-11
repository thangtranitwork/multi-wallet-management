import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { DailyStatItem } from '../database/queries';
import { THEME, formatVND } from '../constants';
import { hapticLight } from '../utils/haptics';

type ChartMode = 'both' | 'expense' | 'income';

interface DailyCashFlowChartProps {
  dailyStats: DailyStatItem[];
  isBalanceHidden?: boolean;
  avgDailyExpense?: number;
}

const CHART_HEIGHT = 120;
const BAR_MIN_WIDTH = 28;
const BAR_GAP = 6;

const VI_DAY_LABELS: Record<string, string> = {
  '0': 'CN',
  '1': 'T2',
  '2': 'T3',
  '3': 'T4',
  '4': 'T5',
  '5': 'T6',
  '6': 'T7',
};

const VI_DOW: Record<number, string> = {
  0: 'Chủ Nhật',
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
};

export const DailyCashFlowChart: React.FC<DailyCashFlowChartProps> = ({
  dailyStats,
  isBalanceHidden = false,
  avgDailyExpense = 0,
}) => {
  const [mode, setMode] = useState<ChartMode>('both');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  if (dailyStats.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Ionicons name="bar-chart-outline" size={32} color="#9CA3AF" />
        <Text style={styles.emptyText}>Chưa có giao dịch nào trong kỳ này</Text>
      </View>
    );
  }

  const maxExpense = Math.max(...dailyStats.map(d => d.expense), 1);
  const maxIncome = Math.max(...dailyStats.map(d => d.income), 1);
  const maxBoth = Math.max(maxExpense, maxIncome, 1);

  const getMax = () => {
    if (mode === 'expense') return maxExpense;
    if (mode === 'income') return maxIncome;
    return maxBoth;
  };

  const currentMax = getMax();

  const avgLinePercent =
    avgDailyExpense > 0 && currentMax > 0
      ? Math.min(avgDailyExpense / currentMax, 1)
      : 0;

  const totalBarWidth = BAR_MIN_WIDTH + BAR_GAP;
  const totalChartWidth = Math.max(
    containerWidth,
    dailyStats.length * totalBarWidth + 16
  );

  const selectedDay = selectedIndex !== null ? dailyStats[selectedIndex] : null;

  const renderModeToggle = () => (
    <View style={styles.modeToggleRow}>
      {([
        { key: 'both' as ChartMode, label: 'Thu & Chi' },
        { key: 'expense' as ChartMode, label: 'Chi tiêu' },
        { key: 'income' as ChartMode, label: 'Thu nhập' },
      ]).map(m => (
        <Pressable
          key={m.key}
          style={[styles.modeChip, mode === m.key && styles.modeChipActive]}
          onPress={() => {
            hapticLight();
            setMode(m.key);
            setSelectedIndex(null);
          }}
        >
          <Text style={[styles.modeChipText, mode === m.key && styles.modeChipTextActive]}>
            {m.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View onLayout={onLayout}>
      {renderModeToggle()}

      {selectedDay ? (
        <View style={styles.selectedPopup}>
          <View style={styles.popupHeader}>
            <Text style={styles.popupDow}>
              {VI_DOW[dayjs(selectedDay.date).day()]}
            </Text>
            <Text style={styles.popupDate}>
              {dayjs(selectedDay.date).format('DD/MM')}
            </Text>
            <Pressable
              hitSlop={8}
              onPress={() => setSelectedIndex(null)}
              style={styles.popupClose}
            >
              <Ionicons name="close" size={14} color="#6B7280" />
            </Pressable>
          </View>
          <View style={styles.popupMetrics}>
            <View style={styles.popupMetricItem}>
              <View style={[styles.popupDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.popupLabel}>Thu</Text>
              <Text style={[styles.popupValue, { color: '#15803D' }]}>
                {isBalanceHidden ? '••••••' : formatVND(selectedDay.income)}
              </Text>
            </View>
            <View style={styles.popupDivider} />
            <View style={styles.popupMetricItem}>
              <View style={[styles.popupDot, { backgroundColor: '#FB7185' }]} />
              <Text style={styles.popupLabel}>Chi</Text>
              <Text style={[styles.popupValue, { color: '#E11D48' }]}>
                {isBalanceHidden ? '••••••' : formatVND(selectedDay.expense)}
              </Text>
            </View>
            <View style={styles.popupDivider} />
            <View style={styles.popupMetricItem}>
              <Text style={styles.popupLabel}>Giao dịch</Text>
              <Text style={styles.popupValue}>{selectedDay.txCount}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.chartWrapper}>
        {(mode === 'expense' || mode === 'both') && avgLinePercent > 0 && (
          <View
            style={[
              styles.avgLineLabel,
              { bottom: 22 + avgLinePercent * CHART_HEIGHT },
            ]}
          >
            <Text style={styles.avgLabelText}>TB</Text>
          </View>
        )}

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { width: totalChartWidth }]}
        >
          <View style={styles.barsContainer}>
            {(mode === 'expense' || mode === 'both') && avgLinePercent > 0 && (
              <View
                style={[
                  styles.avgLine,
                  { bottom: 22 + avgLinePercent * CHART_HEIGHT, width: totalChartWidth },
                ]}
              />
            )}

            {dailyStats.map((day, idx) => {
              const isSelected = selectedIndex === idx;
              const expenseH = Math.max((day.expense / currentMax) * CHART_HEIGHT, day.expense > 0 ? 4 : 0);
              const incomeH = Math.max((day.income / currentMax) * CHART_HEIGHT, day.income > 0 ? 4 : 0);
              const dow = dayjs(day.date).day().toString();
              const dayLabel = VI_DAY_LABELS[dow] || '';
              const dayNum = dayjs(day.date).format('D');

              return (
                <Pressable
                  key={day.date}
                  style={[styles.barGroup, { width: BAR_MIN_WIDTH }]}
                  onPress={() => {
                    hapticLight();
                    setSelectedIndex(isSelected ? null : idx);
                  }}
                >
                  <View style={styles.barArea}>
                    {(mode === 'both' || mode === 'income') && (
                      <View
                        style={[
                          styles.bar,
                          styles.barIncome,
                          {
                            height: incomeH,
                            opacity: isSelected ? 1 : 0.85,
                          },
                        ]}
                      />
                    )}
                    {(mode === 'both' || mode === 'expense') && (
                      <View
                        style={[
                          styles.bar,
                          styles.barExpense,
                          {
                            height: expenseH,
                            borderWidth: isSelected ? 1.5 : 0,
                            borderColor: isSelected ? '#000000' : 'transparent',
                          },
                        ]}
                      />
                    )}
                  </View>

                  <Text
                    style={[
                      styles.barDayLabel,
                      isSelected && styles.barDayLabelSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {dayLabel}
                  </Text>
                  <Text
                    style={[
                      styles.barDateNum,
                      isSelected && styles.barDateNumSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {dayNum}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={styles.legend}>
        {(mode === 'both' || mode === 'income') && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>Thu nhập</Text>
          </View>
        )}
        {(mode === 'both' || mode === 'expense') && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FB7185' }]} />
            <Text style={styles.legendText}>Chi tiêu</Text>
          </View>
        )}
        {(mode === 'expense' || mode === 'both') && avgDailyExpense > 0 && (
          <View style={styles.legendItem}>
            <View style={styles.legendDash} />
            <Text style={styles.legendText}>TB ngày</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  emptyBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  modeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  modeChipActive: {
    backgroundColor: THEME.popYellow,
  },
  modeChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4B5563',
  },
  modeChipTextActive: {
    color: '#000000',
  },
  selectedPopup: {
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#FAFAFA',
    padding: 10,
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  popupDow: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  popupDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    flex: 1,
  },
  popupClose: {
    padding: 2,
  },
  popupMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  popupMetricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  popupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  popupLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  popupValue: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  popupDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E5E7EB',
  },
  chartWrapper: {
    position: 'relative',
    flexDirection: 'row',
  },
  avgLineLabel: {
    position: 'absolute',
    left: 0,
    zIndex: 2,
  },
  avgLabelText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#F59E0B',
  },
  scrollContent: {
    paddingHorizontal: 4,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT + 36,
    paddingTop: 4,
    position: 'relative',
  },
  avgLine: {
    position: 'absolute',
    left: 0,
    height: 1.5,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#F59E0B',
    zIndex: 1,
  },
  barGroup: {
    alignItems: 'center',
    marginRight: BAR_GAP,
  },
  barArea: {
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 2,
    flexDirection: 'row',
  },
  bar: {
    flex: 1,
    borderRadius: 4,
  },
  barIncome: {
    backgroundColor: '#10B981',
  },
  barExpense: {
    backgroundColor: '#FB7185',
  },
  barDayLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 3,
  },
  barDayLabelSelected: {
    color: '#000000',
    fontWeight: '900',
  },
  barDateNum: {
    fontSize: 9,
    fontWeight: '600',
    color: '#D1D5DB',
  },
  barDateNumSelected: {
    color: '#374151',
    fontWeight: '800',
  },
  legend: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#000000',
  },
  legendDash: {
    width: 14,
    height: 1.5,
    backgroundColor: '#F59E0B',
  },
  legendText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
  },
});
