import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useWallet } from '../context/WalletContext';
import { DebtModal } from '../components/DebtModal';
import { NeoDropdown } from '../components/NeoDropdown';
import { Debt } from '../types';
import { THEME, formatVND } from '../constants';

export const DebtsScreen: React.FC = () => {
  const {
    debts,
    summary,
    isLoading,
    isBalanceHidden,
    refreshData,
    removeDebt,
  } = useWallet();

  const [activeTab, setActiveTab] = useState<'lend' | 'borrow'>('lend');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'settled'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [targetPaymentDebt, setTargetPaymentDebt] = useState<Debt | null>(null);

  // Filter debts
  const currentDebts = debts.filter(d => {
    if (d.type !== activeTab) return false;
    if (filterStatus === 'active' && d.status === 'settled') return false;
    if (filterStatus === 'settled' && d.status !== 'settled') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = d.person_name.toLowerCase().includes(q);
      const matchNote = (d.note || '').toLowerCase().includes(q);
      return matchName || matchNote;
    }
    return true;
  });

  const handleDeleteDebt = (debt: Debt) => {
    const hasWallet = !!debt.wallet_id;
    const hasRemaining = debt.remaining_amount > 0;
    const canRefund = hasWallet && hasRemaining && debt.status !== 'settled';

    const refundLabel =
      debt.type === 'lend'
        ? `Xóa & Hoàn ${formatVND(debt.remaining_amount)} vào ví`
        : `Xóa & Trừ ${formatVND(debt.remaining_amount)} khỏi ví`;

    const message = canRefund
      ? `Khoản nợ của "${debt.person_name}" còn ${formatVND(debt.remaining_amount)} chưa tất toán.\n\nBạn có muốn hoàn tiền về ví không?`
      : `Bạn có chắc muốn xóa khoản nợ của "${debt.person_name}"?`;

    Alert.alert(
      'Xóa khoản nợ',
      message,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa (không hoàn tiền)',
          style: 'destructive',
          onPress: async () => {
            await removeDebt(debt.id, false);
          },
        },
        ...(canRefund
          ? [
              {
                text: refundLabel,
                onPress: async () => {
                  await removeDebt(debt.id, true);
                },
              },
            ]
          : []),
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>Sổ Nợ & Cho Vay</Text>
          <Text style={styles.screenSubtitle}>Theo dõi công nợ 2 chiều</Text>
        </View>

        <Pressable
          style={styles.addBtnShadow}
          onPress={() => setCreateModalVisible(true)}
        >
          <View style={styles.addBtnInner}>
            <Ionicons name="add" size={18} color="#000000" />
            <Text style={styles.addBtnText}>Thêm nợ</Text>
          </View>
        </Pressable>
      </View>

      {/* Summary Folder Tab Cards */}
      <View style={styles.summaryGrid}>
        <Pressable
          style={[styles.summaryCardShadow, { flex: 1 }]}
          onPress={() => setActiveTab('lend')}
        >
          <View
            style={[
              styles.summaryCardInner,
              activeTab === 'lend' && styles.summaryCardActive,
            ]}
          >
            <View
              style={[
                styles.summaryFolderTab,
                { backgroundColor: THEME.primary },
              ]}
            >
              <Text style={styles.summaryFolderTabText}>PHẢI THU</Text>
            </View>
            <View style={styles.summaryContent}>
              <View style={styles.summaryIconHeader}>
                <View
                  style={[
                    styles.summaryIconBox,
                    { backgroundColor: THEME.primaryLight },
                  ]}
                >
                  <Ionicons name="arrow-up" size={16} color="#000000" />
                </View>
                <Text style={styles.summaryTabLabel}>Người khác nợ</Text>
              </View>
              <Text style={[styles.summaryBigNum, { color: '#15803D' }]}>
                {isBalanceHidden ? '••••••' : formatVND(summary?.totalLent || 0)}
              </Text>
            </View>
          </View>
        </Pressable>

        <Pressable
          style={[styles.summaryCardShadow, { flex: 1 }]}
          onPress={() => setActiveTab('borrow')}
        >
          <View
            style={[
              styles.summaryCardInner,
              activeTab === 'borrow' && styles.summaryCardActive,
            ]}
          >
            <View
              style={[
                styles.summaryFolderTab,
                { backgroundColor: THEME.popPink },
              ]}
            >
              <Text style={styles.summaryFolderTabText}>PHẢI TRẢ</Text>
            </View>
            <View style={styles.summaryContent}>
              <View style={styles.summaryIconHeader}>
                <View
                  style={[
                    styles.summaryIconBox,
                    { backgroundColor: THEME.popPinkLight },
                  ]}
                >
                  <Ionicons name="arrow-down" size={16} color="#000000" />
                </View>
                <Text style={styles.summaryTabLabel}>Nợ người khác</Text>
              </View>
              <Text style={[styles.summaryBigNum, { color: '#E11D48' }]}>
                {isBalanceHidden ? '••••••' : formatVND(summary?.totalBorrowed || 0)}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>

      {/* Segment Switch (Cho vay / Đi vay) */}
      <View style={styles.segmentContainer}>
        <Pressable
          style={[
            styles.segmentItem,
            activeTab === 'lend' && styles.segmentItemActiveLend,
          ]}
          onPress={() => setActiveTab('lend')}
        >
          <Ionicons
            name="arrow-up-circle-outline"
            size={16}
            color="#000000"
          />
          <Text style={styles.segmentText}>
            Cho vay ({debts.filter(d => d.type === 'lend' && d.status !== 'settled').length})
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.segmentItem,
            activeTab === 'borrow' && styles.segmentItemActiveBorrow,
          ]}
          onPress={() => setActiveTab('borrow')}
        >
          <Ionicons
            name="arrow-down-circle-outline"
            size={16}
            color="#000000"
          />
          <Text style={styles.segmentText}>
            Đi vay ({debts.filter(d => d.type === 'borrow' && d.status !== 'settled').length})
          </Text>
        </Pressable>
      </View>

      {/* Filter Row: Search & Status Dropdown */}
      <View style={styles.filterRow}>
        <View style={styles.searchShadow}>
          <View style={styles.searchInner}>
            <Ionicons name="search-outline" size={16} color="#000000" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo tên người..."
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#000000" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <NeoDropdown
          title="Lọc trạng thái công nợ"
          triggerLabel={
            filterStatus === 'all'
              ? 'Tất cả'
              : filterStatus === 'active'
              ? 'Đang nợ'
              : 'Đã xong'
          }
          triggerIcon="funnel-outline"
          isActive={filterStatus !== 'all'}
          options={[
            { id: 'all', label: 'Tất cả trạng thái', icon: 'layers-outline' },
            { id: 'active', label: 'Đang nợ', icon: 'time-outline', color: '#F59E0B' },
            { id: 'settled', label: 'Đã xong (Đã trả hết)', icon: 'checkmark-done-outline', color: '#10B981' },
          ]}
          selectedValue={filterStatus}
          onSelect={val => setFilterStatus((val || 'all') as any)}
        />
      </View>

      {/* Debts List */}
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
        {currentDebts.length > 0 ? (
          currentDebts.map(debt => {
            const isSettled = debt.status === 'settled';
            const paidAmount = debt.initial_amount - debt.remaining_amount;
            const progress =
              debt.initial_amount > 0
                ? Math.round((paidAmount / debt.initial_amount) * 100)
                : 0;

            let isOverdue = false;
            let dueText = '';
            if (debt.due_date && !isSettled) {
              const due = dayjs(debt.due_date);
              const diffDays = due.diff(dayjs(), 'day');
              if (diffDays < 0) {
                isOverdue = true;
                dueText = `Quá hạn ${Math.abs(diffDays)} ngày`;
              } else if (diffDays === 0) {
                dueText = 'Hạn hôm nay';
              } else {
                dueText = `Còn ${diffDays} ngày (${due.format('DD/MM')})`;
              }
            }

            const tabColor = activeTab === 'lend' ? THEME.primary : THEME.popPink;

            return (
              <View key={debt.id} style={styles.debtCardShadow}>
                <View style={styles.debtCardInner}>
                  {/* Folder Tab */}
                  <View style={[styles.cardFolderTab, { backgroundColor: tabColor }]}>
                    <Text style={styles.cardFolderTabText}>
                      {activeTab === 'lend' ? 'CHO VAY' : 'ĐI VAY'}
                    </Text>
                  </View>

                  <View style={styles.cardBody}>
                    {/* Top Row: Avatar & Person Name & Status */}
                    <View style={styles.cardTopRow}>
                      <View style={[styles.personAvatar, { backgroundColor: tabColor }]}>
                        <Text style={styles.avatarLetter}>
                          {debt.person_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.personInfoCol}>
                        <Text style={styles.personName}>{debt.person_name}</Text>
                        <Text style={styles.personSubDate}>
                          {debt.person_phone
                            ? debt.person_phone
                            : `Ngày tạo: ${dayjs(debt.created_at).format('DD/MM/YYYY')}`}
                        </Text>
                      </View>

                      {/* Status Badge */}
                      <View
                        style={[
                          styles.statusBadge,
                          isSettled
                            ? styles.statusSettled
                            : isOverdue
                            ? styles.statusOverdue
                            : styles.statusActive,
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>
                          {isSettled
                            ? 'ĐÃ TẤT TOÁN'
                            : isOverdue
                            ? 'QUÁ HẠN'
                            : debt.status === 'partially_paid'
                            ? 'ĐÃ TRẢ 1 PHẦN'
                            : 'ĐANG NỢ'}
                        </Text>
                      </View>
                    </View>

                    {/* Remaining & Initial Amounts */}
                    <View style={styles.amountDividerRow}>
                      <View>
                        <Text style={styles.amountCaption}>
                          Còn lại cần {activeTab === 'lend' ? 'thu' : 'trả'}
                        </Text>
                        <Text
                          style={[
                            styles.amountBigVal,
                            { color: activeTab === 'lend' ? '#15803D' : '#E11D48' },
                          ]}
                        >
                          {isBalanceHidden ? '••••••' : formatVND(debt.remaining_amount)}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.amountCaption}>Tổng ban đầu</Text>
                        <Text style={styles.amountInitialVal}>
                          {isBalanceHidden ? '••••••' : formatVND(debt.initial_amount)}
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${progress}%`,
                            backgroundColor:
                              activeTab === 'lend' ? THEME.primary : THEME.popPink,
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.progressLabelRow}>
                      <Text style={styles.progressPercent}>Đã thanh toán {progress}%</Text>
                      {dueText ? (
                        <View
                          style={[
                            styles.duePill,
                            isOverdue && styles.duePillOverdue,
                          ]}
                        >
                          <Ionicons
                            name={isOverdue ? 'alert-circle' : 'time-outline'}
                            size={12}
                            color="#000000"
                          />
                          <Text style={styles.duePillText}>{dueText}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Note or Wallet info */}
                    {(debt.note || debt.wallet_name) && (
                      <View style={styles.noteBox}>
                        <Ionicons name="information-circle-outline" size={14} color="#000000" />
                        <Text style={styles.noteBoxText} numberOfLines={1}>
                          {debt.note || ''}
                          {debt.note && debt.wallet_name ? ' • ' : ''}
                          {debt.wallet_name ? `Ví trích: ${debt.wallet_name}` : ''}
                        </Text>
                      </View>
                    )}

                    {/* Bottom Action Row */}
                    <View style={styles.cardActionsRow}>
                      {!isSettled ? (
                        <Pressable
                          style={styles.payBtnShadow}
                          onPress={() => setTargetPaymentDebt(debt)}
                        >
                          <View
                            style={[
                              styles.payBtnInner,
                              {
                                backgroundColor:
                                  activeTab === 'lend' ? THEME.primary : THEME.popYellow,
                              },
                            ]}
                          >
                            <Ionicons
                              name={activeTab === 'lend' ? 'cash-outline' : 'send-outline'}
                              size={15}
                              color="#000000"
                            />
                            <Text style={styles.payBtnText}>
                              {activeTab === 'lend' ? 'Ghi nhận thu nợ' : 'Ghi nhận trả nợ'}
                            </Text>
                          </View>
                        </Pressable>
                      ) : (
                        <View style={styles.settledBanner}>
                          <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                          <Text style={styles.settledBannerText}>Đã thanh toán đủ</Text>
                        </View>
                      )}

                      <Pressable
                        style={styles.deleteSquircleBtn}
                        onPress={() => handleDeleteDebt(debt)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#6B7280" />
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
                <Ionicons name="people-outline" size={32} color="#000000" />
              </View>
              <Text style={styles.emptyTitle}>
                Chưa có khoản {activeTab === 'lend' ? 'cho vay' : 'đi vay'} nào
              </Text>
              <Text style={styles.emptySub}>
                {activeTab === 'lend'
                  ? 'Ghi chép tiền bạn bè mượn để quản lý thu hồi rõ ràng, không lo thất thoát.'
                  : 'Ghi lại tiền vay người khác để chủ động thanh toán đúng kỳ hạn.'}
              </Text>

              <Pressable
                style={styles.createDebtBtnShadow}
                onPress={() => setCreateModalVisible(true)}
              >
                <View style={styles.createDebtBtnInner}>
                  <Text style={styles.createDebtBtnText}>+ Tạo khoản nợ mới</Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Debt Creation Modal */}
      <DebtModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        defaultType={activeTab}
      />

      {/* Debt Payment Modal */}
      {targetPaymentDebt && (
        <DebtModal
          visible={true}
          onClose={() => setTargetPaymentDebt(null)}
          debtToPay={targetPaymentDebt}
        />
      )}
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
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: 8,
  },
  summaryCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 18,
    marginTop: 14,
    marginRight: 3,
  },
  summaryCardInner: {
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  summaryCardActive: {
    borderColor: '#000000',
  },
  summaryFolderTab: {
    position: 'absolute',
    top: -14,
    left: 10,
    height: 16,
    paddingHorizontal: 8,
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
  },
  summaryContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 14,
    paddingTop: 16,
  },
  summaryIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  summaryIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryTabLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
  },
  summaryBigNum: {
    fontSize: 18,
    fontWeight: '900',
  },
  segmentContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },
  segmentItemActiveLend: {
    backgroundColor: THEME.primaryLight,
  },
  segmentItemActiveBorrow: {
    backgroundColor: THEME.popPinkLight,
  },
  segmentText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#000000',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
    gap: 10,
  },
  searchShadow: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 12,
    height: 44,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    height: 44,
    paddingHorizontal: 12,
    transform: [{ translateX: -2.5 }, { translateY: -2.5 }],
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  listArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  debtCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 18,
    marginBottom: 16,
    marginTop: 14,
    marginRight: 3,
  },
  debtCardInner: {
    transform: [{ translateX: -3.5 }, { translateY: -3.5 }],
  },
  cardFolderTab: {
    position: 'absolute',
    top: -14,
    left: 12,
    width: 78,
    height: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    borderBottomWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  cardFolderTabText: {
    fontSize: 8.5,
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
  personAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  personInfoCol: {
    flex: 1,
  },
  personName: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#000000',
  },
  personSubDate: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  statusActive: {
    backgroundColor: THEME.popYellow,
  },
  statusOverdue: {
    backgroundColor: '#FEE2E2',
  },
  statusSettled: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#000000',
  },
  amountDividerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1.5,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
    marginBottom: 10,
  },
  amountCaption: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 2,
  },
  amountBigVal: {
    fontSize: 19,
    fontWeight: '900',
  },
  amountInitialVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6B7280',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressPercent: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#6B7280',
  },
  duePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
  },
  duePillOverdue: {
    backgroundColor: '#FEE2E2',
  },
  duePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  noteBoxText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    flex: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payBtnShadow: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  payBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  payBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  settledBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  settledBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  deleteSquircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
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
    lineHeight: 18,
  },
  createDebtBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  createDebtBtnInner: {
    backgroundColor: THEME.popYellow,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    transform: [{ translateX: -2.5 }, { translateY: -2.5 }],
  },
  createDebtBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
});
