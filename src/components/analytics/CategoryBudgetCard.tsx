import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CategorySpending } from '../../types';
import { THEME, formatVND } from '../../constants';
import { hapticLight } from '../../utils/haptics';
import { CategoryPieChart } from '../CategoryPieChart';

interface CategoryBudgetCardProps {
  categorySpendings: CategorySpending[];
  totalExpense: number;
  isBalanceHidden?: boolean;
}

type ViewMode = 'list' | 'pie';

export const CategoryBudgetCard: React.FC<CategoryBudgetCardProps> = ({
  categorySpendings,
  totalExpense,
  isBalanceHidden = false,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(
    categorySpendings.length < 6 && categorySpendings.length > 0 ? 'pie' : 'list'
  );

  return (
    <View style={styles.cardShadow}>
      <View style={styles.cardInner}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.folderTab, { backgroundColor: THEME.popYellow }]}>
            <Text style={styles.folderTabText}>CƠ CẤU CHI TIÊU</Text>
          </View>

          {/* Toggle between Pie chart and Progress List */}
          {categorySpendings.length > 0 && (
            <View style={styles.viewToggleGroup}>
              <Pressable
                style={[
                  styles.viewToggleBtn,
                  viewMode === 'pie' && styles.viewToggleBtnActive,
                ]}
                onPress={() => {
                  hapticLight();
                  setViewMode('pie');
                }}
              >
                <Ionicons
                  name="pie-chart"
                  size={12}
                  color={viewMode === 'pie' ? '#000000' : '#6B7280'}
                />
                <Text
                  style={[
                    styles.viewToggleText,
                    viewMode === 'pie' && styles.viewToggleTextActive,
                  ]}
                >
                  Tròn
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.viewToggleBtn,
                  viewMode === 'list' && styles.viewToggleBtnActive,
                ]}
                onPress={() => {
                  hapticLight();
                  setViewMode('list');
                }}
              >
                <Ionicons
                  name="list"
                  size={12}
                  color={viewMode === 'list' ? '#000000' : '#6B7280'}
                />
                <Text
                  style={[
                    styles.viewToggleText,
                    viewMode === 'list' && styles.viewToggleTextActive,
                  ]}
                >
                  Tiến độ
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.sectionHeaderTitle}>Chi tiết theo từng danh mục</Text>

          {categorySpendings.length === 0 ? (
            <View style={styles.noDataBox}>
              <Ionicons name="pie-chart-outline" size={32} color="#9CA3AF" />
              <Text style={styles.noDataText}>
                Chưa có khoản chi tiêu nào trong kỳ này
              </Text>
            </View>
          ) : viewMode === 'pie' ? (
            <CategoryPieChart
              data={categorySpendings}
              totalAmount={totalExpense}
              isBalanceHidden={isBalanceHidden}
            />
          ) : (
            <View style={styles.listContainer}>
              {categorySpendings.map(cat => {
                const isHeavy = cat.percentage >= 35;
                const isModerate = cat.percentage >= 20 && cat.percentage < 35;

                return (
                  <View key={cat.category_id} style={styles.categorySpendItem}>
                    <View style={styles.catSpendHeader}>
                      <View style={styles.catTitleLeft}>
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
                            name={
                              (cat.category_icon as any) || 'pricetag-outline'
                            }
                            size={15}
                            color="#FFFFFF"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.catNameRow}>
                            <Text
                              style={styles.catNameText}
                              numberOfLines={1}
                            >
                              {cat.category_name}
                            </Text>
                            {isHeavy && (
                              <View style={styles.heavyBadge}>
                                <Text style={styles.heavyBadgeText}>
                                  TỶ TRỌNG CAO
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>

                      <View style={styles.catAmountRight}>
                        <Text style={styles.catAmountText}>
                          {isBalanceHidden
                            ? '••••••'
                            : formatVND(cat.total_amount)}
                        </Text>
                        <View
                          style={[
                            styles.percentBadge,
                            isHeavy && styles.percentBadgeHeavy,
                            isModerate && styles.percentBadgeModerate,
                          ]}
                        >
                          <Text
                            style={[
                              styles.catPercentText,
                              isHeavy && styles.catPercentTextHeavy,
                            ]}
                          >
                            {cat.percentage}%
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Progress Bar Track */}
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min(100, Math.max(3, cat.percentage))}%`,
                            backgroundColor:
                              cat.category_color || THEME.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 10,
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
  viewToggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    padding: 2,
    gap: 2,
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  viewToggleBtnActive: {
    backgroundColor: THEME.popYellow,
    borderWidth: 1,
    borderColor: '#000000',
  },
  viewToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  viewToggleTextActive: {
    color: '#000000',
    fontWeight: '900',
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
  listContainer: {
    gap: 12,
  },
  categorySpendItem: {
    gap: 6,
  },
  catSpendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
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
  catNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  catNameText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  heavyBadge: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  heavyBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#DC2626',
  },
  catAmountRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catAmountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  percentBadge: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 36,
    alignItems: 'center',
  },
  percentBadgeHeavy: {
    backgroundColor: '#FFE4E6',
    borderColor: '#E11D48',
  },
  percentBadgeModerate: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  catPercentText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#374151',
  },
  catPercentTextHeavy: {
    color: '#E11D48',
  },
  barTrack: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#000000',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  noDataBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  noDataText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
});
