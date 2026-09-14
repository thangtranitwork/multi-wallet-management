import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { THEME, formatVND } from '../constants';

export interface CategoryPieItem {
  category_id: string;
  category_name: string;
  category_icon?: string | null;
  category_color?: string | null;
  total_amount: number;
  percentage: number;
}

interface CategoryPieChartProps {
  data: CategoryPieItem[];
  totalAmount: number;
  isBalanceHidden?: boolean;
}

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({
  data,
  totalAmount,
  isBalanceHidden = false,
}) => {
  const size = 210;
  const cx = size / 2;
  const cy = size / 2;
  const R = 90;
  const r = 52;

  // Filter out items with 0 or negative amount
  const validData = data.filter(d => d.total_amount > 0);
  const sumAmount = validData.reduce((acc, curr) => acc + curr.total_amount, 0);

  // Compute slices
  let cumulativeAngle = -Math.PI / 2; // Start at 12 o'clock

  const slices = validData.map(item => {
    const fraction = sumAmount > 0 ? item.total_amount / sumAmount : 0;
    const sweepAngle = fraction * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = startAngle + sweepAngle;
    cumulativeAngle = endAngle;

    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);

    const x3 = cx + r * Math.cos(endAngle);
    const y3 = cy + r * Math.sin(endAngle);
    const x4 = cx + r * Math.cos(startAngle);
    const y4 = cy + r * Math.sin(startAngle);

    const largeArcFlag = sweepAngle > Math.PI ? 1 : 0;

    const d = `M ${x1} ${y1} A ${R} ${R} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;

    return {
      ...item,
      fraction,
      d,
      color: item.category_color || THEME.primary,
    };
  });

  return (
    <View style={styles.container}>
      {/* Donut Graphic */}
      <View style={styles.chartWrapper}>
        <Svg width={size} height={size}>
          {validData.length === 1 ? (
            <G>
              <Circle
                cx={cx}
                cy={cy}
                r={R}
                fill={validData[0].category_color || THEME.primary}
                stroke="#000000"
                strokeWidth={2.5}
              />
              <Circle
                cx={cx}
                cy={cy}
                r={r}
                fill="#FFFFFF"
                stroke="#000000"
                strokeWidth={2.5}
              />
            </G>
          ) : (
            <G>
              {slices.map((slice, idx) => (
                <Path
                  key={slice.category_id || idx}
                  d={slice.d}
                  fill={slice.color}
                  stroke="#000000"
                  strokeWidth={2}
                />
              ))}
            </G>
          )}
        </Svg>

        {/* Center Text in Donut Hole */}
        <View style={[styles.centerCutout, { width: r * 2 - 4, height: r * 2 - 4, borderRadius: (r * 2 - 4) / 2 }]}>
          <Text style={styles.centerLabel}>TỔNG CHI</Text>
          <Text style={styles.centerAmount} numberOfLines={1}>
            {isBalanceHidden ? '••••••' : formatVND(totalAmount)}
          </Text>
          <Text style={styles.centerCount}>{validData.length} danh mục</Text>
        </View>
      </View>

      {/* Categories Legend List */}
      <View style={styles.legendContainer}>
        {validData.map(item => (
          <View key={item.category_id} style={styles.legendItem}>
            <View style={styles.legendLeft}>
              <View
                style={[
                  styles.legendIconBox,
                  { backgroundColor: item.category_color || THEME.popPink },
                ]}
              >
                <Ionicons
                  name={(item.category_icon as any) || 'pricetag-outline'}
                  size={14}
                  color="#FFFFFF"
                />
              </View>
              <Text style={styles.legendName} numberOfLines={1}>
                {item.category_name}
              </Text>
            </View>

            <View style={styles.legendRight}>
              <Text style={styles.legendAmount}>
                {isBalanceHidden ? '••••••' : formatVND(item.total_amount)}
              </Text>
              <View style={styles.percentBadge}>
                <Text style={styles.percentText}>{item.percentage}%</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  chartWrapper: {
    width: 210,
    height: 210,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  centerCutout: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  centerLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  centerAmount: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    marginTop: 2,
    textAlign: 'center',
  },
  centerCount: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 1,
  },
  legendContainer: {
    width: '100%',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  legendIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
    flex: 1,
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  percentBadge: {
    backgroundColor: '#FEF08A',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  percentText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
  },
});
