import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { WalletCard } from '../components/WalletCard';
import { TransactionItem } from '../components/TransactionItem';
import { QuickAddModal } from '../components/QuickAddModal';
import { WalletModal } from '../components/WalletModal';
import { Wallet } from '../types';
import { THEME, formatVND } from '../constants';

const { width } = Dimensions.get('window');

interface DashboardScreenProps {
  navigation: any;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const {
    wallets,
    transactions,
    summary,
    isLoading,
    isBalanceHidden,
    toggleHideBalance,
    refreshData,
    removeTransaction,
    addWallet,
  } = useWallet();

  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [adjustingWallet, setAdjustingWallet] = useState<Wallet | null>(null);

  const recentTransactions = transactions.slice(0, 5);

  const handleQuickAddPreset = async (preset: {
    name: string;
    type: 'cash' | 'bank' | 'e_wallet' | 'credit';
    color: string;
    icon: string;
  }) => {
    await addWallet({
      name: preset.name,
      type: preset.type,
      balance: 0,
      credit_limit: preset.type === 'credit' ? 20000000 : 0,
      currency: 'VND',
      color: preset.color,
      icon: preset.icon,
      is_excluded: 0,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Header Bar với nhận diện Logo & Tên ứng dụng */}
      <View style={styles.topHeader}>
        <View style={styles.headerBrandRow}>
          <View style={styles.headerBrandLogoBox}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.headerBrandLogo}
              resizeMode="cover"
            />
          </View>
          <View style={styles.headerBrandTextCol}>
            <Text style={styles.headerBrandTitle}>Ví Của Tôi</Text>
            <Text style={styles.headerBrandSubtitle}>Sổ quản lý tài chính</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <Pressable
            style={styles.headerIconBtnShadow}
            onPress={() => setWalletModalVisible(true)}
          >
            <View style={styles.headerIconBtnInner}>
              <Ionicons name="folder-outline" size={19} color="#000000" />
            </View>
          </Pressable>

          <Pressable
            style={styles.headerIconBtnShadow}
            onPress={() => navigation.navigate('Transactions')}
          >
            <View style={styles.headerIconBtnInner}>
              <Ionicons name="search-outline" size={20} color="#000000" />
            </View>
          </Pressable>

          <Pressable
            style={styles.headerIconBtnShadow}
            onPress={() => navigation.navigate('Settings')}
          >
            <View style={styles.headerIconBtnInner}>
              <Ionicons name="settings-outline" size={20} color="#000000" />
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshData}
            tintColor="#000000"
          />
        }
      >
        {/* Large Punchy Headline (Đúng kiểu typography to bản trong ảnh của Ngài) */}
        <View style={styles.headlineSection}>
          <Text style={styles.headlineMain}>Tài chính trong tay.</Text>
          <Text style={styles.headlineSub}>Tự do từng ngày.</Text>
        </View>

        {/* Quick Add / Search Bar + Pop Yellow (+) Button (Y hệt thanh nhập và nút vàng trong ảnh mẫu) */}
        <View style={styles.quickBarRow}>
          <Pressable
            style={styles.quickSearchInputShadow}
            onPress={() => setQuickAddVisible(true)}
          >
            <View style={styles.quickSearchInputInner}>
              <View style={styles.inputLeftGroup}>
                <Text style={styles.hashSymbol}>#</Text>
                <Text style={styles.inputPlaceholderText}>
                  Ghi nhanh thu chi, nợ...
                </Text>
              </View>
              <Ionicons name="copy-outline" size={17} color="#000000" />
            </View>
          </Pressable>

          <Pressable
            style={styles.yellowAddBtnShadow}
            onPress={() => setQuickAddVisible(true)}
          >
            <View style={styles.yellowAddBtnInner}>
              <Ionicons name="add" size={30} color="#000000" />
            </View>
          </Pressable>
        </View>

        {/* Hero Card: Net Worth Overview (Thẻ Folder Tab Xanh Lá viền đen dập nổi) */}
        <View style={styles.netWorthCardShadow}>
          <View style={styles.netWorthCardInner}>
            {/* Folder Tab trên cùng */}
            <View style={styles.netWorthFolderTab}>
              <Text style={styles.netWorthFolderTabText}>TỔNG TÀI SẢN RÒNG</Text>
            </View>

            <View style={styles.netWorthContent}>
              <View style={styles.netWorthHeaderRow}>
                <Text style={styles.netWorthSubtitle}>TÀI SẢN RÒNG THỰC TẾ</Text>
                <Pressable
                  onPress={toggleHideBalance}
                  style={styles.eyeToggleBtn}
                >
                  <Ionicons
                    name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#000000"
                  />
                </Pressable>
              </View>

              <Text style={styles.netWorthBigValue} numberOfLines={1}>
                {isBalanceHidden ? '•••••••• ₫' : formatVND(summary?.netWorth || 0)}
              </Text>

              {/* Neo-Brutalism 7-Day Trend Chart */}
              <View style={styles.miniChartContainer}>
                <View style={styles.chartBarsRow}>
                  {[
                    { day: 'T2', height: 45, active: false },
                    { day: 'T3', height: 30, active: false },
                    { day: 'T4', height: 65, active: false },
                    { day: 'T5', height: 40, active: false },
                    { day: 'T6', height: 85, active: true },
                    { day: 'T7', height: 50, active: false },
                    { day: 'CN', height: 70, active: false },
                  ].map((item, idx) => (
                    <View key={idx} style={styles.chartBarCol}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: `${item.height}%`,
                              backgroundColor: item.active
                                ? THEME.primary
                                : '#E5E7EB',
                            },
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.timelineDayText,
                          item.active && styles.timelineDayActive,
                        ]}
                      >
                        {item.day}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Sub-stats Row */}
              <View style={styles.netWorthFooterRow}>
                <View style={styles.netWorthFooterCol}>
                  <Text style={styles.footerColLabel}>Tài sản khả dụng</Text>
                  <Text style={[styles.footerColVal, { color: '#15803D' }]}>
                    {isBalanceHidden
                      ? '••••••'
                      : formatVND(summary?.totalAssets || 0)}
                  </Text>
                </View>

                <View style={styles.footerDivider} />

                <View style={styles.netWorthFooterCol}>
                  <Text style={styles.footerColLabel}>Tổng nợ phải trả</Text>
                  <Text style={[styles.footerColVal, { color: '#DC2626' }]}>
                    {isBalanceHidden
                      ? '••••••'
                      : formatVND(summary?.totalLiabilities || 0)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Section: My Collections / Nguồn Tiền Của Tôi (Lưới 2 cột các thẻ Folder Tab y như ảnh của Ngài) */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <Text style={styles.sectionTitle}>Nguồn tiền của tôi</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{wallets.length} ví</Text>
              </View>
            </View>

            <Pressable
              style={styles.addWalletSmallBtn}
              onPress={() => setWalletModalVisible(true)}
            >
              <Ionicons name="add" size={16} color="#000000" />
              <Text style={styles.addWalletSmallText}>Thêm ví</Text>
            </Pressable>
          </View>

          {/* Wallets Grid or Empty State */}
          {wallets.length === 0 ? (
            <View style={styles.emptyWalletsCardShadow}>
              <View style={styles.emptyWalletsCardInner}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="wallet-outline" size={32} color="#000000" />
                </View>
                <Text style={styles.emptyTitle}>Chưa có nguồn tiền nào!</Text>
                <Text style={styles.emptySub}>
                  Ứng dụng hiện đang sạch 100% dữ liệu. Ngài hãy chọn nhanh một nguồn tiền
                  để khởi tạo ngay:
                </Text>

                <View style={styles.presetsGrid}>
                  {[
                    {
                      name: 'Tiền mặt',
                      type: 'cash' as const,
                      color: THEME.primary,
                      icon: 'cash-outline',
                    },
                    {
                      name: 'Vietcombank',
                      type: 'bank' as const,
                      color: THEME.popBlue,
                      icon: 'business-outline',
                    },
                    {
                      name: 'Ví MoMo',
                      type: 'e_wallet' as const,
                      color: THEME.popPink,
                      icon: 'phone-portrait-outline',
                    },
                    {
                      name: 'Thẻ tín dụng',
                      type: 'credit' as const,
                      color: THEME.popYellow,
                      icon: 'card-outline',
                    },
                  ].map((preset, idx) => (
                    <Pressable
                      key={idx}
                      style={styles.presetItemShadow}
                      onPress={() => handleQuickAddPreset(preset)}
                    >
                      <View
                        style={[
                          styles.presetItemInner,
                          { backgroundColor: preset.color },
                        ]}
                      >
                        <Ionicons
                          name={preset.icon as any}
                          size={18}
                          color="#000000"
                        />
                        <Text style={styles.presetName} numberOfLines={1}>
                          + {preset.name}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.walletsTwoColGrid}>
              {wallets.map(w => (
                <View key={w.id} style={styles.gridColHalf}>
                  <WalletCard
                    wallet={w}
                    isBalanceHidden={isBalanceHidden}
                    onPress={() => navigation.navigate('Wallets')}
                    onAdjustPress={() => {
                      setAdjustingWallet(w);
                      setWalletModalVisible(true);
                    }}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Section: Sổ Nợ & Cho Vay (Hai Thẻ Folder Tab Tương Phản) */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Sổ Nợ & Cho Vay</Text>
            <Pressable onPress={() => navigation.navigate('Debts')}>
              <Text style={styles.seeAllText}>Xem tất cả ➔</Text>
            </Pressable>
          </View>

          <View style={styles.debtsTwoColGrid}>
            {/* Thẻ Cho vay (Người nợ mình - Màu Xanh Lá) */}
            <Pressable
              style={[styles.debtCardShadow, { flex: 1 }]}
              onPress={() => navigation.navigate('Debts')}
            >
              <View style={styles.debtCardInner}>
                <View
                  style={[
                    styles.debtFolderTab,
                    { backgroundColor: THEME.primary },
                  ]}
                >
                  <Text style={styles.debtFolderTabText}>CHO VAY</Text>
                </View>

                <View style={styles.debtCardContent}>
                  <View
                    style={[
                      styles.debtIconBox,
                      { backgroundColor: THEME.primaryLight },
                    ]}
                  >
                    <Ionicons
                      name="arrow-up-circle-outline"
                      size={20}
                      color="#000000"
                    />
                  </View>
                  <Text style={styles.debtCardLabel}>Người khác nợ</Text>
                  <Text style={[styles.debtCardVal, { color: '#15803D' }]}>
                    {isBalanceHidden
                      ? '••••••'
                      : formatVND(summary?.totalLent || 0)}
                  </Text>
                </View>
              </View>
            </Pressable>

            {/* Thẻ Đi vay (Mình nợ người khác - Màu Hồng San Hô) */}
            <Pressable
              style={[styles.debtCardShadow, { flex: 1 }]}
              onPress={() => navigation.navigate('Debts')}
            >
              <View style={styles.debtCardInner}>
                <View
                  style={[
                    styles.debtFolderTab,
                    { backgroundColor: THEME.popPink },
                  ]}
                >
                  <Text style={styles.debtFolderTabText}>ĐI VAY</Text>
                </View>

                <View style={styles.debtCardContent}>
                  <View
                    style={[
                      styles.debtIconBox,
                      { backgroundColor: THEME.popPinkLight },
                    ]}
                  >
                    <Ionicons
                      name="arrow-down-circle-outline"
                      size={20}
                      color="#000000"
                    />
                  </View>
                  <Text style={styles.debtCardLabel}>Cần trả người khác</Text>
                  <Text style={[styles.debtCardVal, { color: '#E11D48' }]}>
                    {isBalanceHidden
                      ? '••••••'
                      : formatVND(summary?.totalBorrowed || 0)}
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Section: Giao dịch gần đây */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Giao dịch gần đây</Text>
            <Pressable onPress={() => navigation.navigate('Transactions')}>
              <Text style={styles.seeAllText}>Xem tất cả ➔</Text>
            </Pressable>
          </View>

          {recentTransactions.length === 0 ? (
            <View style={styles.emptyTxCardShadow}>
              <View style={styles.emptyTxCardInner}>
                <Ionicons name="receipt-outline" size={30} color="#000000" />
                <Text style={styles.emptyTxTitle}>Chưa có giao dịch nào</Text>
                <Text style={styles.emptyTxSub}>
                  Bấm nút (+) màu vàng để ghi lại khoản thu, chi hoặc nợ đầu tiên
                </Text>
              </View>
            </View>
          ) : (
            recentTransactions.map(tx => (
              <TransactionItem
                key={tx.id}
                transaction={tx}
                isBalanceHidden={isBalanceHidden}
                onDelete={() => removeTransaction(tx.id)}
              />
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modals */}
      <QuickAddModal
        visible={quickAddVisible}
        onClose={() => setQuickAddVisible(false)}
      />

      <WalletModal
        visible={walletModalVisible}
        onClose={() => {
          setWalletModalVisible(false);
          setAdjustingWallet(null);
        }}
        wallet={adjustingWallet}
        mode={adjustingWallet ? 'adjust' : 'create'}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerBrandLogoBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBrandLogo: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  headerBrandTextCol: {
    justifyContent: 'center',
  },
  headerBrandTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.4,
  },
  headerBrandSubtitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 12,
    width: 42,
    height: 42,
  },
  headerIconBtnInner: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  headlineSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  headlineMain: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  headlineSub: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  quickBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  quickSearchInputShadow: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 14,
    height: 50,
  },
  quickSearchInputInner: {
    flex: 1,
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    transform: [{ translateX: -3.5 }, { translateY: -3.5 }],
  },
  inputLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hashSymbol: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
  },
  inputPlaceholderText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#6B7280',
  },
  yellowAddBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 14,
    width: 50,
    height: 50,
  },
  yellowAddBtnInner: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: THEME.popYellow,
    borderWidth: 2.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -3.5 }, { translateY: -3.5 }],
  },
  netWorthCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 20,
    marginBottom: 24,
    marginTop: 16,
    marginRight: 4,
  },
  netWorthCardInner: {
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  netWorthFolderTab: {
    position: 'absolute',
    top: -14,
    left: 14,
    height: 16,
    paddingHorizontal: 12,
    backgroundColor: THEME.primary,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    borderBottomWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  netWorthFolderTabText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  netWorthContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 18,
  },
  netWorthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  netWorthSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  eyeToggleBtn: {
    padding: 4,
  },
  netWorthBigValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  miniChartContainer: {
    marginBottom: 16,
  },
  chartBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 56,
    paddingHorizontal: 6,
  },
  chartBarCol: {
    alignItems: 'center',
    flex: 1,
  },
  barTrack: {
    width: 14,
    height: 42,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 4,
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  timelineDayText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '800',
  },
  timelineDayActive: {
    color: '#000000',
    fontWeight: '900',
  },
  netWorthFooterRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: '#000000',
    paddingTop: 12,
    alignItems: 'center',
  },
  netWorthFooterCol: {
    flex: 1,
  },
  footerDivider: {
    width: 2,
    height: 32,
    backgroundColor: '#000000',
    marginHorizontal: 12,
  },
  footerColLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 2,
  },
  footerColVal: {
    fontSize: 14.5,
    fontWeight: '900',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: THEME.popYellow,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
  },
  addWalletSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  addWalletSmallText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  seeAllText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#000000',
  },
  walletsTwoColGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridColHalf: {
    width: (width - 40 - 12) / 2,
  },
  emptyWalletsCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 20,
    marginRight: 4,
    marginBottom: 4,
  },
  emptyWalletsCardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 20,
    alignItems: 'center',
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME.popYellow,
    borderWidth: 2.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
    fontWeight: '600',
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  presetItemShadow: {
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  presetItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  presetName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  debtsTwoColGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  debtCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 18,
    marginTop: 10,
    marginRight: 3,
  },
  debtCardInner: {
    transform: [{ translateX: -3.5 }, { translateY: -3.5 }],
  },
  debtFolderTab: {
    position: 'absolute',
    top: -12,
    left: 10,
    width: 74,
    height: 14,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 2.5,
    borderColor: '#000000',
    borderBottomWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  debtFolderTabText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#000000',
  },
  debtCardContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 14,
  },
  debtIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  debtCardLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 4,
  },
  debtCardVal: {
    fontSize: 15,
    fontWeight: '900',
  },
  emptyTxCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 16,
    marginRight: 3,
  },
  emptyTxCardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 20,
    alignItems: 'center',
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  emptyTxTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
    marginTop: 8,
    marginBottom: 4,
  },
  emptyTxSub: {
    fontSize: 11.5,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
  },
});
