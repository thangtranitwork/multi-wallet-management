import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import dayjs from 'dayjs';
import { useWallet } from '../context/WalletContext';
import { THEME } from '../constants';
import * as queries from '../database/queries';
import {
  RangeAnalytics,
  AdvancedAnalyticsMetrics,
  DailyAssetPoint,
} from '../database/queries';
import { PeriodComparisonResult } from '../types';
import { hapticLight } from '../utils/haptics';
import { useCustomAlert } from '../components/CustomAlertModal';
import { AnalyticsOverviewTab } from '../components/analytics/AnalyticsOverviewTab';
import {
  AnalyticsComparisonTab,
  CategoryFilter,
} from '../components/analytics/AnalyticsComparisonTab';

type TimeRangeKey = 'week' | 'month' | 'last_month' | 'year' | 'all';
type AnalyticsTab = 'overview' | 'comparison';
type ComparisonPreset =
  | 'month_vs_last_month'
  | 'quarter_vs_last_quarter'
  | 'month_vs_same_month_last_year';

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

const COMPARISON_PRESETS: { key: ComparisonPreset; label: string }[] = [
  { key: 'month_vs_last_month', label: 'Tháng này vs Tháng trước' },
  { key: 'quarter_vs_last_quarter', label: 'Quý này vs Quý trước' },
  { key: 'month_vs_same_month_last_year', label: 'Cùng kỳ năm trước' },
];

export const AnalyticsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const db = useSQLiteContext();
  const {
    wallets,
    summary,
    isBalanceHidden,
    toggleHideBalance,
  } = useWallet();
  const { AlertModalComponent } = useCustomAlert(true);

  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [selectedRange, setSelectedRange] = useState<TimeRangeKey>('month');
  const [isFullMonth, setIsFullMonth] = useState<boolean>(false);
  const [rangeData, setRangeData] = useState<RangeAnalytics | null>(null);
  const [advancedData, setAdvancedData] = useState<AdvancedAnalyticsMetrics | null>(null);
  const [assetTrajectory, setAssetTrajectory] = useState<DailyAssetPoint[]>([]);
  const [loadingRange, setLoadingRange] = useState<boolean>(true);

  // Period Comparison states
  const [comparisonPreset, setComparisonPreset] = useState<ComparisonPreset>('month_vs_last_month');
  const [comparisonData, setComparisonData] = useState<PeriodComparisonResult | null>(null);
  const [loadingComparison, setLoadingComparison] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  // Tính khoảng ngày dựa trên filter
  const getDateBounds = useCallback(
    (key: TimeRangeKey): { start: string | null; end: string | null; daysCount: number } => {
      const now = dayjs();
      switch (key) {
        case 'week': {
          const start = now.startOf('week');
          const end = now.endOf('week');
          return {
            start: start.toISOString(),
            end: end.toISOString(),
            daysCount: Math.max(1, now.diff(start, 'day') + 1),
          };
        }
        case 'month': {
          const start = now.startOf('month');
          const end = now.endOf('month');
          return {
            start: start.toISOString(),
            end: end.toISOString(),
            daysCount: Math.max(1, now.date()),
          };
        }
        case 'last_month': {
          const lastM = now.subtract(1, 'month');
          const start = lastM.startOf('month');
          const end = lastM.endOf('month');
          return {
            start: start.toISOString(),
            end: end.toISOString(),
            daysCount: start.daysInMonth(),
          };
        }
        case 'year': {
          const start = now.startOf('year');
          const end = now.endOf('year');
          return {
            start: start.toISOString(),
            end: end.toISOString(),
            daysCount: Math.max(1, now.diff(start, 'day') + 1),
          };
        }
        case 'all':
        default:
          return { start: null, end: null, daysCount: 30 };
      }
    },
    []
  );

  const getComparisonBounds = useCallback((preset: ComparisonPreset) => {
    const now = dayjs();
    if (preset === 'month_vs_last_month') {
      const p1Start = now.startOf('month').toISOString();
      const p1End = now.endOf('month').toISOString();
      const lastM = now.subtract(1, 'month');
      const p2Start = lastM.startOf('month').toISOString();
      const p2End = lastM.endOf('month').toISOString();
      return {
        p1Start,
        p1End,
        p2Start,
        p2End,
        p1Label: `Tháng ${now.format('MM/YYYY')}`,
        p2Label: `Tháng ${lastM.format('MM/YYYY')}`,
      };
    } else if (preset === 'quarter_vs_last_quarter') {
      const currentQuarter = Math.floor(now.month() / 3);
      const p1Start = now.month(currentQuarter * 3).startOf('month').toISOString();
      const p1End = now.month(currentQuarter * 3 + 2).endOf('month').toISOString();

      const lastQuarterDate = now.subtract(3, 'month');
      const lastQuarter = Math.floor(lastQuarterDate.month() / 3);
      const p2Start = lastQuarterDate.month(lastQuarter * 3).startOf('month').toISOString();
      const p2End = lastQuarterDate.month(lastQuarter * 3 + 2).endOf('month').toISOString();

      return {
        p1Start,
        p1End,
        p2Start,
        p2End,
        p1Label: `Quý ${currentQuarter + 1}/${now.year()}`,
        p2Label: `Quý ${lastQuarter + 1}/${lastQuarterDate.year()}`,
      };
    } else {
      const p1Start = now.startOf('month').toISOString();
      const p1End = now.endOf('month').toISOString();
      const lastYear = now.subtract(1, 'year');
      const p2Start = lastYear.startOf('month').toISOString();
      const p2End = lastYear.endOf('month').toISOString();
      return {
        p1Start,
        p1End,
        p2Start,
        p2End,
        p1Label: `T${now.format('MM/YYYY')}`,
        p2Label: `T${lastYear.format('MM/YYYY')}`,
      };
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    if (!db) return;
    try {
      setLoadingRange(true);
      const { start, end } = getDateBounds(selectedRange);
      const data = await queries.getAnalyticsByRange(db, start, end);
      const advanced = await queries.getAdvancedAnalyticsMetrics(
        db,
        start,
        end,
        selectedRange === 'month' ? isFullMonth : false
      );
      const trajectory = await queries.getDailyAssetTrajectory(db, summary?.totalAssets || 0, start, end);
      setRangeData(data);
      setAdvancedData(advanced);
      setAssetTrajectory(trajectory);
    } catch (err) {
      console.warn('Lỗi tải dữ liệu phân tích:', err);
    } finally {
      setLoadingRange(false);
    }
  }, [db, selectedRange, isFullMonth, getDateBounds, summary?.totalAssets]);

  const fetchComparison = useCallback(async () => {
    try {
      setLoadingComparison(true);
      const bounds = getComparisonBounds(comparisonPreset);
      const result = await queries.getPeriodComparison(
        db,
        bounds.p1Start,
        bounds.p1End,
        bounds.p2Start,
        bounds.p2End,
        bounds.p1Label,
        bounds.p2Label
      );
      setComparisonData(result);
    } catch (err) {
      console.warn('Lỗi tải dữ liệu so sánh kỳ:', err);
    } finally {
      setLoadingComparison(false);
    }
  }, [db, comparisonPreset, getComparisonBounds]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    if (activeTab === 'comparison') {
      fetchComparison();
    }
  }, [activeTab, fetchComparison]);

  const { daysCount } = getDateBounds(selectedRange);

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
          </View>
        </View>

        <Pressable
          style={styles.shareBtnShadow}
          onPress={() => {
            hapticLight();
            toggleHideBalance();
          }}
        >
          <View
            style={[
              styles.shareBtnInner,
              isBalanceHidden && { backgroundColor: THEME.popYellow },
            ]}
          >
            <Ionicons
              name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
              size={16}
              color="#000000"
            />
            <Text style={styles.shareBtnText}>
              {isBalanceHidden ? 'Hiện số' : 'Ẩn số'}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Top Segmented Tabs: Tổng quan | So sánh kỳ */}
      <View style={styles.topTabsContainer}>
        <Pressable
          style={[
            styles.topTabBtn,
            activeTab === 'overview' && styles.topTabBtnActive,
          ]}
          onPress={() => {
            hapticLight();
            setActiveTab('overview');
          }}
        >
          <Ionicons
            name="pie-chart-outline"
            size={15}
            color={activeTab === 'overview' ? '#000000' : '#6B7280'}
          />
          <Text
            style={[
              styles.topTabText,
              activeTab === 'overview' && styles.topTabTextActive,
            ]}
          >
            Tổng quan
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.topTabBtn,
            activeTab === 'comparison' && styles.topTabBtnActive,
          ]}
          onPress={() => {
            hapticLight();
            setActiveTab('comparison');
          }}
        >
          <Ionicons
            name="git-compare-outline"
            size={15}
            color={activeTab === 'comparison' ? '#000000' : '#6B7280'}
          />
          <Text
            style={[
              styles.topTabText,
              activeTab === 'comparison' && styles.topTabTextActive,
            ]}
          >
            So sánh kỳ
          </Text>
        </Pressable>
      </View>

      {/* Filter Bar */}
      {activeTab === 'overview' ? (
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
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
      ) : (
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            {COMPARISON_PRESETS.map(item => {
              const isSelected = comparisonPreset === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={[
                    styles.filterChipShadow,
                    isSelected && styles.filterChipShadowActive,
                  ]}
                  onPress={() => {
                    hapticLight();
                    setComparisonPreset(item.key);
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
      )}

      {/* Main Content Area */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'comparison' ? (
          <AnalyticsComparisonTab
            comparisonData={comparisonData}
            loadingComparison={loadingComparison}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            isBalanceHidden={isBalanceHidden}
          />
        ) : (
          <AnalyticsOverviewTab
            rangeData={rangeData}
            advancedData={advancedData}
            assetTrajectory={assetTrajectory}
            loadingRange={loadingRange}
            selectedRange={selectedRange}
            daysCount={daysCount}
            wallets={wallets}
            totalAssets={summary?.totalAssets || 0}
            isBalanceHidden={isBalanceHidden}
            isFullMonth={isFullMonth}
            onToggleFullMonth={() => setIsFullMonth(prev => !prev)}
          />
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
      {AlertModalComponent}
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
  topTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#E5E7EB',
  },
  topTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  topTabBtnActive: {
    backgroundColor: '#FAF8F5',
    borderColor: '#000000',
  },
  topTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  topTabTextActive: {
    color: '#000000',
    fontWeight: '900',
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
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  filterChipInnerActive: {
    backgroundColor: THEME.popYellow,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  filterChipTextActive: {
    fontWeight: '900',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
});
