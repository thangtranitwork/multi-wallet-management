import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { THEME, formatVND } from '../constants';

export const AnalyticsScreen: React.FC = () => {
  const {
    wallets,
    transactions,
    debts,
    summary,
    categorySpendings,
    isBalanceHidden,
  } = useWallet();

  const totalExpense = summary?.monthExpense || 0;
  const netSavings = (summary?.monthIncome || 0) - totalExpense;

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
        <View>
          <Text style={styles.screenTitle}>Báo Cáo & Phân Tích</Text>
          <Text style={styles.screenSubtitle}>Dòng tiền & Cơ cấu tài sản</Text>
        </View>

        <Pressable style={styles.shareBtnShadow} onPress={handleExportBackup}>
          <View style={styles.shareBtnInner}>
            <Ionicons name="share-outline" size={17} color="#000000" />
            <Text style={styles.shareBtnText}>Sao lưu</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Cash Flow Summary Card */}
        <View style={styles.cardShadow}>
          <View style={styles.cardInner}>
            <View style={[styles.folderTab, { backgroundColor: THEME.primary }]}>
              <Text style={styles.folderTabText}>DÒNG TIỀN THÁNG NÀY</Text>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cashFlowRow}>
                <View style={styles.cashFlowCol}>
                  <Text style={styles.cfLabel}>TỔNG THU</Text>
                  <Text style={[styles.cfVal, { color: '#15803D' }]}>
                    {isBalanceHidden ? '••••••' : formatVND(summary?.monthIncome || 0)}
                  </Text>
                </View>

                <View style={styles.cfDivider} />

                <View style={styles.cashFlowCol}>
                  <Text style={styles.cfLabel}>TỔNG CHI</Text>
                  <Text style={[styles.cfVal, { color: '#E11D48' }]}>
                    {isBalanceHidden ? '••••••' : formatVND(summary?.monthExpense || 0)}
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
              <Text style={styles.sectionHeaderTitle}>Chi tiêu theo nhóm tháng này</Text>

              {categorySpendings.length > 0 ? (
                categorySpendings.map(cat => (
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
                            color="#000000"
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
                  <Ionicons name="pie-chart-outline" size={32} color="#000000" />
                  <Text style={styles.noDataText}>Chưa có khoản chi tiêu nào trong tháng</Text>
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

        <View style={{ height: 100 }} />
      </ScrollView>
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
  shareBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  shareBtnInner: {
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
  shareBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  cardShadow: {
    backgroundColor: '#000000',
    borderRadius: 18,
    marginBottom: 20,
    marginTop: 16,
    marginRight: 3,
  },
  cardInner: {
    transform: [{ translateX: -3.5 }, { translateY: -3.5 }],
  },
  folderTab: {
    position: 'absolute',
    top: -14,
    left: 12,
    height: 16,
    paddingHorizontal: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    borderBottomWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  folderTabText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  cardBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 18,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 14,
  },
  cashFlowRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cashFlowCol: {
    flex: 1,
    alignItems: 'center',
  },
  cfDivider: {
    width: 2,
    height: 36,
    backgroundColor: '#000000',
    marginHorizontal: 4,
  },
  cfLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 4,
  },
  cfVal: {
    fontSize: 14.5,
    fontWeight: '900',
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
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catNameText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#000000',
  },
  catAmountRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catAmountText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#000000',
  },
  percentBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
  },
  catPercentText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  noDataBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 8,
  },
  allocationRow: {
    marginBottom: 12,
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
    fontSize: 13.5,
    fontWeight: '800',
    color: '#000000',
  },
  allocRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allocAmount: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#000000',
  },
  allocPercent: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
  },
  allocTrack: {
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    overflow: 'hidden',
  },
  allocFill: {
    height: '100%',
    borderRadius: 3,
  },
});
