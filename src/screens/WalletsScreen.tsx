import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { WalletModal } from '../components/WalletModal';
import { Wallet } from '../types';
import { THEME, formatVND } from '../constants';

export const WalletsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    wallets,
    summary,
    isLoading,
    isBalanceHidden,
    toggleHideBalance,
    refreshData,
    setActiveWalletFilter,
    addWallet,
  } = useWallet();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [adjustingWallet, setAdjustingWallet] = useState<Wallet | null>(null);

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
      note: '',
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>Nguồn Tiền</Text>
          <Text style={styles.screenSubtitle}>Quản lý tài khoản & số dư</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            style={styles.eyeBtn}
            onPress={toggleHideBalance}
          >
            <Ionicons
              name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color="#000000"
            />
          </Pressable>

          <Pressable
            style={styles.addBtnShadow}
            onPress={() => setCreateModalVisible(true)}
          >
            <View style={styles.addBtnInner}>
              <Ionicons name="add" size={18} color="#000000" />
              <Text style={styles.addBtnText}>Thêm ví</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Summary Total Card */}
      <View style={styles.summaryCardShadow}>
        <View style={styles.summaryCardInner}>
          <View style={styles.summaryFolderTab}>
            <Text style={styles.summaryFolderTabText}>TỔNG TÀI SẢN KHẢ DỤNG</Text>
          </View>

          <View style={styles.summaryContent}>
            <View style={styles.summaryTopRow}>
              <Text style={styles.summaryCaption}>TỔNG TIỀN CÁC VÍ</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{wallets.length} nguồn</Text>
              </View>
            </View>
            <Text style={styles.summaryBigAmount}>
              {isBalanceHidden ? '•••••••• ₫' : formatVND(summary?.totalAssets || 0)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.listArea}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshData}
            tintColor="#000000"
          />
        }
      >
        {wallets.length > 0 ? (
          wallets.map(w => {
            const isCredit = w.type === 'credit';
            const creditAvailable = isCredit
              ? Math.max(0, w.credit_limit - Math.abs(w.balance))
              : 0;
            const tabColor = w.color || THEME.primary;

            return (
              <View key={w.id} style={styles.walletCardShadow}>
                <View style={styles.walletCardInner}>
                  {/* Folder Tab */}
                  <View style={[styles.cardFolderTab, { backgroundColor: tabColor }]}>
                    <Text style={styles.cardFolderTabText}>
                      {w.type === 'cash' && 'TIỀN MẶT'}
                      {w.type === 'bank' && 'NGÂN HÀNG'}
                      {w.type === 'e_wallet' && 'VÍ ĐIỆN TỬ'}
                      {w.type === 'credit' && 'THẺ TÍN DỤNG'}
                      {w.type === 'savings' && 'TIẾT KIỆM'}
                    </Text>
                  </View>

                  {/* Card Body */}
                  <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                      <View style={[styles.walletIconBox, { backgroundColor: tabColor }]}>
                        <Ionicons
                          name={(w.icon as any) || 'wallet-outline'}
                          size={20}
                          color="#000000"
                        />
                      </View>

                      <View style={styles.walletInfoCol}>
                        <Text style={styles.walletNameText}>{w.name}</Text>
                        <Text style={styles.walletCurrencyText}>Đơn vị: {w.currency || 'VND'}</Text>
                      </View>

                      <Pressable
                        style={styles.settingsIconBtn}
                        onPress={() => setEditingWallet(w)}
                      >
                        <Ionicons name="ellipsis-vertical" size={18} color="#000000" />
                      </Pressable>
                    </View>

                    {/* Balance Info */}
                    <View style={styles.balanceRow}>
                      <View>
                        <Text style={styles.balanceLabel}>
                          {isCredit ? 'DƯ NỢ HIỆN TẠI' : 'SỐ DƯ'}
                        </Text>
                        <Text
                          style={[
                            styles.balanceBigText,
                            isCredit && w.balance > 0 && { color: THEME.danger },
                          ]}
                        >
                          {isBalanceHidden ? '•••••• ₫' : formatVND(w.balance)}
                        </Text>
                      </View>

                      {isCredit && w.credit_limit > 0 && (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.balanceLabel}>HẠN MỨC CÒN LẠI</Text>
                          <Text style={styles.creditLimitVal}>
                            {isBalanceHidden ? '••••••' : formatVND(creditAvailable)}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Action buttons */}
                    <View style={styles.actionsRow}>
                      <Pressable
                        style={styles.actionBtn}
                        onPress={() => setAdjustingWallet(w)}
                      >
                        <Ionicons name="swap-vertical" size={14} color="#000000" />
                        <Text style={styles.actionBtnText}>Cân đối số dư</Text>
                      </Pressable>

                      <Pressable
                        style={styles.actionBtn}
                        onPress={() => {
                          setActiveWalletFilter(w.id);
                          navigation.navigate('Transactions');
                        }}
                      >
                        <Ionicons name="receipt-outline" size={14} color="#000000" />
                        <Text style={styles.actionBtnText}>Lịch sử</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCardShadow}>
            <View style={styles.emptyCardInner}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="wallet-outline" size={32} color="#000000" />
              </View>
              <Text style={styles.emptyTitle}>Chưa có ví nào!</Text>
              <Text style={styles.emptySub}>
                Tạo một nguồn tiền để bắt đầu ghi chép dòng tiền của Ngài
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
                ].map((preset, idx) => (
                  <Pressable
                    key={idx}
                    style={styles.presetShadow}
                    onPress={() => handleQuickAddPreset(preset)}
                  >
                    <View
                      style={[
                        styles.presetInner,
                        { backgroundColor: preset.color },
                      ]}
                    >
                      <Ionicons
                        name={preset.icon as any}
                        size={16}
                        color="#000000"
                      />
                      <Text style={styles.presetText}>+ {preset.name}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Wallet Modals */}
      <WalletModal
        visible={createModalVisible || !!editingWallet || !!adjustingWallet}
        onClose={() => {
          setCreateModalVisible(false);
          setEditingWallet(null);
          setAdjustingWallet(null);
        }}
        wallet={editingWallet || adjustingWallet}
        mode={adjustingWallet ? 'adjust' : editingWallet ? 'edit' : 'create'}
      />
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
  eyeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  addBtnInner: {
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
  addBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  summaryCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 18,
    marginHorizontal: 20,
    marginBottom: 16,
    marginTop: 16,
  },
  summaryCardInner: {
    transform: [{ translateX: -3.5 }, { translateY: -3.5 }],
  },
  summaryFolderTab: {
    position: 'absolute',
    top: -14,
    left: 14,
    height: 16,
    paddingHorizontal: 10,
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
  summaryFolderTabText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  summaryContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 16,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryCaption: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: THEME.popYellow,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
  },
  summaryBigAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
  },
  listArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  walletCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 18,
    marginBottom: 16,
    marginTop: 14,
    marginRight: 3,
  },
  walletCardInner: {
    transform: [{ translateX: -3.5 }, { translateY: -3.5 }],
  },
  cardFolderTab: {
    position: 'absolute',
    top: -14,
    left: 14,
    height: 16,
    paddingHorizontal: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    borderBottomWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  cardFolderTabText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#000000',
  },
  cardBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  walletIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  walletInfoCol: {
    flex: 1,
  },
  walletNameText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  walletCurrencyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 2,
  },
  settingsIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1.5,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 2,
  },
  balanceBigText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
  },
  creditLimitVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6B7280',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  emptyCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 18,
    marginTop: 6,
    marginRight: 3.5,
    marginBottom: 20,
  },
  emptyCardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 24,
    alignItems: 'center',
    transform: [{ translateX: -3.5 }, { translateY: -3.5 }],
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.popYellow,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 16,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetShadow: {
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  presetInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  presetText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
});
