import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutChangeEvent,
  Dimensions,
} from 'react-native';
import Svg, {
  Path,
  Line,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { DailyAssetPoint } from '../../database/queries';
import { THEME, formatVND } from '../../constants';
import { hapticLight } from '../../utils/haptics';

interface SpendingVelocityChartProps {
  assetPoints: DailyAssetPoint[];
  isBalanceHidden?: boolean;
}

const CHART_HEIGHT = 160;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 28;
const PADDING_HORIZONTAL = 20;

export const SpendingVelocityChart: React.FC<SpendingVelocityChartProps> = ({
  assetPoints,
  isBalanceHidden = false,
}) => {
  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width - 48
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0) {
      setContainerWidth(width);
    }
  };

  const {
    points,
    minAsset,
    maxAsset,
    latestPoint,
    todayDelta,
    overallChange,
    avgDailyChange,
    trendType,
  } = useMemo(() => {
    if (assetPoints.length === 0) {
      return {
        points: [],
        minAsset: 0,
        maxAsset: 1,
        latestPoint: null,
        todayDelta: 0,
        overallChange: 0,
        avgDailyChange: 0,
        trendType: 'neutral' as const,
      };
    }

    const allAssets = assetPoints.map(p => p.totalAssets);
    const minVal = Math.min(...allAssets);
    const maxVal = Math.max(...allAssets);

    const latest = assetPoints[assetPoints.length - 1];
    const first = assetPoints[0];

    const todayChange = latest.delta;
    const totalChange = latest.totalAssets - first.previousAssets;
    const daysElapsed = Math.max(1, assetPoints.length);
    const avgChange = Math.round(totalChange / daysElapsed);

    let trend: 'down' | 'up' | 'neutral' = 'neutral';
    if (totalChange < -50000) {
      trend = 'down'; // Tài sản giảm (đang tiêu nhiều)
    } else if (totalChange > 50000) {
      trend = 'up'; // Tài sản tăng (thu nhiều hơn chi)
    }

    return {
      points: assetPoints,
      minAsset: minVal,
      maxAsset: maxVal,
      latestPoint: latest,
      todayDelta: todayChange,
      overallChange: totalChange,
      avgDailyChange: avgChange,
      trendType: trend,
    };
  }, [assetPoints]);

  if (points.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="trending-down-outline" size={32} color="#9CA3AF" />
        <Text style={styles.emptyText}>Chưa có dữ liệu biến động tài sản</Text>
      </View>
    );
  }

  // Toạ độ SVG
  const graphWidth = containerWidth - PADDING_HORIZONTAL * 2;
  const graphHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  // Tránh min === max khi số dư không đổi
  const assetRange = maxAsset - minAsset > 0 ? maxAsset - minAsset : Math.max(maxAsset * 0.1, 100000);
  const yBase = minAsset - assetRange * 0.1;
  const ySpan = assetRange * 1.2;

  const pointsCount = points.length;
  const stepX = pointsCount > 1 ? graphWidth / (pointsCount - 1) : graphWidth;

  const coordinates = points.map((p, idx) => {
    const x = PADDING_HORIZONTAL + idx * stepX;
    const ratio = Math.max(0, Math.min(1, (p.totalAssets - yBase) / ySpan));
    const y = PADDING_TOP + (1 - ratio) * graphHeight;
    return { x, y, data: p, index: idx };
  });

  const linePath = coordinates.reduce((acc, curr, idx) => {
    if (idx === 0) return `M ${curr.x} ${curr.y}`;
    return `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  const areaPath =
    coordinates.length > 0
      ? `${linePath} L ${coordinates[coordinates.length - 1].x} ${
          PADDING_TOP + graphHeight
        } L ${coordinates[0].x} ${PADDING_TOP + graphHeight} Z`
      : '';

  const selectedPoint =
    selectedIndex !== null && coordinates[selectedIndex]
      ? coordinates[selectedIndex]
      : null;

  const trendColor = trendType === 'down' ? '#E11D48' : trendType === 'up' ? '#10B981' : '#0284C7';

  return (
    <View style={styles.wrapper} onLayout={onLayout}>
      {/* KPI Status Row: Hôm nay vs Hôm qua & Tốc độ tiêu */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>TỔNG TÀI SẢN HIỆN TẠI</Text>
          <Text style={[styles.metricValue, { color: '#000000' }]} numberOfLines={1}>
            {isBalanceHidden
              ? '••••••'
              : formatVND(latestPoint?.totalAssets || 0)}
          </Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>SO VỚI HÔM QUA</Text>
          <View style={styles.deltaBadge}>
            <Ionicons
              name={
                todayDelta > 0
                  ? 'arrow-up'
                  : todayDelta < 0
                  ? 'arrow-down'
                  : 'remove'
              }
              size={12}
              color={
                todayDelta > 0
                  ? '#15803D'
                  : todayDelta < 0
                  ? '#DC2626'
                  : '#6B7280'
              }
            />
            <Text
              style={[
                styles.deltaText,
                {
                  color:
                    todayDelta > 0
                      ? '#15803D'
                      : todayDelta < 0
                      ? '#DC2626'
                      : '#6B7280',
                },
              ]}
              numberOfLines={1}
            >
              {isBalanceHidden
                ? '•••'
                : todayDelta > 0
                ? `+${formatVND(todayDelta)}`
                : todayDelta < 0
                ? `-${formatVND(Math.abs(todayDelta))}`
                : '0 ₫'}
            </Text>
          </View>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>TỐC ĐỘ BIẾN ĐỘNG TB</Text>
          <Text
            style={[
              styles.metricValue,
              {
                color:
                  avgDailyChange < 0
                    ? '#E11D48'
                    : avgDailyChange > 0
                    ? '#15803D'
                    : '#4B5563',
              },
            ]}
            numberOfLines={1}
          >
            {isBalanceHidden
              ? '••••••'
              : avgDailyChange < 0
              ? `-${formatVND(Math.abs(avgDailyChange))}/ngày`
              : avgDailyChange > 0
              ? `+${formatVND(avgDailyChange)}/ngày`
              : '0 ₫/ngày'}
          </Text>
        </View>
      </View>

      {/* Trend Summary Alert Bar */}
      <View
        style={[
          styles.trendAlertBar,
          trendType === 'down'
            ? styles.trendAlertDown
            : trendType === 'up'
            ? styles.trendAlertUp
            : styles.trendAlertNeutral,
        ]}
      >
        <Ionicons
          name={
            trendType === 'down'
              ? 'trending-down'
              : trendType === 'up'
              ? 'trending-up'
              : 'git-commit-outline'
          }
          size={15}
          color={
            trendType === 'down'
              ? '#991B1B'
              : trendType === 'up'
              ? '#14532D'
              : '#1E3A8A'
          }
        />
        <Text
          style={[
            styles.trendAlertText,
            {
              color:
                trendType === 'down'
                  ? '#991B1B'
                  : trendType === 'up'
                  ? '#14532D'
                  : '#1E3A8A',
            },
          ]}
        >
          {trendType === 'down'
            ? `Tổng tài sản đang giảm dần (-${isBalanceHidden ? '•••' : formatVND(Math.abs(overallChange))} trong kỳ). Tốc độ tiêu trung bình ${isBalanceHidden ? '•••' : formatVND(Math.abs(avgDailyChange))}/ngày.`
            : trendType === 'up'
            ? `Tổng tài sản đang tăng trưởng (+${isBalanceHidden ? '•••' : formatVND(overallChange)} trong kỳ) nhờ thu nhập vượt chi tiêu.`
            : 'Tổng tài sản duy trì ổn định, dòng tiền thu chi đang ở trạng thái cân bằng.'}
        </Text>
      </View>

      {/* Selected Day Tooltip */}
      {selectedPoint && (
        <View style={styles.tooltipBox}>
          <View style={styles.tooltipHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="calendar-outline" size={13} color="#000000" />
              <Text style={styles.tooltipDate}>
                {dayjs(selectedPoint.data.date).format('DD/MM/YYYY')}
              </Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => setSelectedIndex(null)}
              style={styles.tooltipClose}
            >
              <Ionicons name="close" size={13} color="#6B7280" />
            </Pressable>
          </View>

          <View style={styles.tooltipRow}>
            <Text style={styles.tooltipLabel}>Tổng tài sản cuối ngày:</Text>
            <Text style={[styles.tooltipValue, { color: '#000000' }]}>
              {isBalanceHidden
                ? '••••••'
                : formatVND(selectedPoint.data.totalAssets)}
            </Text>
          </View>

          <View style={styles.tooltipRow}>
            <Text style={styles.tooltipLabel}>So với hôm trước:</Text>
            <Text
              style={[
                styles.tooltipValue,
                {
                  color:
                    selectedPoint.data.delta > 0
                      ? '#15803D'
                      : selectedPoint.data.delta < 0
                      ? '#DC2626'
                      : '#6B7280',
                },
              ]}
            >
              {isBalanceHidden
                ? '•••'
                : selectedPoint.data.delta > 0
                ? `+${formatVND(selectedPoint.data.delta)}`
                : selectedPoint.data.delta < 0
                ? `-${formatVND(Math.abs(selectedPoint.data.delta))}`
                : 'Không đổi'}
            </Text>
          </View>

          {(selectedPoint.data.expense > 0 || selectedPoint.data.income > 0) && (
            <View style={styles.tooltipDetailRow}>
              {selectedPoint.data.expense > 0 && (
                <Text style={styles.tooltipExpenseText}>
                  Chi: {isBalanceHidden ? '•••' : formatVND(selectedPoint.data.expense)}
                </Text>
              )}
              {selectedPoint.data.income > 0 && (
                <Text style={styles.tooltipIncomeText}>
                  Thu: {isBalanceHidden ? '•••' : formatVND(selectedPoint.data.income)}
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* SVG Asset Trajectory Curve */}
      <View style={styles.chartContainer}>
        <Svg width={containerWidth} height={CHART_HEIGHT}>
          <Defs>
            <LinearGradient id="assetGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={trendColor} stopOpacity="0.25" />
              <Stop offset="100%" stopColor={trendColor} stopOpacity="0.01" />
            </LinearGradient>
          </Defs>

          {/* Grid lines */}
          <Line
            x1={PADDING_HORIZONTAL}
            y1={PADDING_TOP}
            x2={containerWidth - PADDING_HORIZONTAL}
            y2={PADDING_TOP}
            stroke="#E5E7EB"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <Line
            x1={PADDING_HORIZONTAL}
            y1={PADDING_TOP + graphHeight / 2}
            x2={containerWidth - PADDING_HORIZONTAL}
            y2={PADDING_TOP + graphHeight / 2}
            stroke="#E5E7EB"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <Line
            x1={PADDING_HORIZONTAL}
            y1={PADDING_TOP + graphHeight}
            x2={containerWidth - PADDING_HORIZONTAL}
            y2={PADDING_TOP + graphHeight}
            stroke="#111827"
            strokeWidth={1.5}
          />

          {/* Area fill */}
          <Path d={areaPath} fill="url(#assetGradient)" />

          {/* Trajectory Line */}
          <Path
            d={linePath}
            stroke={trendColor}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Points */}
          {coordinates.map((pt, i) => {
            const isSelected = selectedIndex === i;
            const isLatest = i === coordinates.length - 1;
            return (
              <Circle
                key={pt.data.date}
                cx={pt.x}
                cy={pt.y}
                r={isSelected ? 6 : isLatest ? 4.5 : 2.5}
                fill={isSelected ? trendColor : '#FFFFFF'}
                stroke={trendColor}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
            );
          })}
        </Svg>

        {/* Touch Overlay */}
        <View style={styles.touchOverlay}>
          {coordinates.map((pt, idx) => (
            <Pressable
              key={`touch-${pt.data.date}`}
              style={{
                position: 'absolute',
                left: pt.x - stepX / 2,
                top: 0,
                width: stepX,
                height: CHART_HEIGHT,
              }}
              onPress={() => {
                hapticLight();
                setSelectedIndex(idx === selectedIndex ? null : idx);
              }}
            />
          ))}
        </View>
      </View>

      {/* Date Labels on X Axis */}
      <View style={styles.dateLabelsRow}>
        {coordinates.length > 0 && (
          <>
            <Text style={styles.dateLabelText}>
              {dayjs(coordinates[0].data.date).format('DD/MM')}
            </Text>
            {coordinates.length > 2 && (
              <Text style={styles.dateLabelText}>
                {dayjs(
                  coordinates[Math.floor(coordinates.length / 2)].data.date
                ).format('DD/MM')}
              </Text>
            )}
            <Text style={styles.dateLabelText}>
              {dayjs(coordinates[coordinates.length - 1].data.date).format(
                'DD/MM'
              )}
            </Text>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E5E7EB',
  },
  metricLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '900',
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '900',
  },
  trendAlertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 12,
  },
  trendAlertDown: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FDA4AF',
  },
  trendAlertUp: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  trendAlertNeutral: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  trendAlertText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  tooltipBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 4,
  },
  tooltipDate: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
  },
  tooltipClose: {
    padding: 2,
  },
  tooltipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  tooltipLabel: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  tooltipValue: {
    fontSize: 11,
    fontWeight: '800',
  },
  tooltipDetailRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tooltipExpenseText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  tooltipIncomeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  chartContainer: {
    position: 'relative',
    height: CHART_HEIGHT,
  },
  touchOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  dateLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: PADDING_HORIZONTAL,
    marginTop: 4,
  },
  dateLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
});
