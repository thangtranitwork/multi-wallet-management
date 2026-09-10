import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useWallet } from '../context/WalletContext';
import { PlannedExpense } from '../types';
import { THEME, formatVND } from '../constants';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '../utils/haptics';

interface PlannedExpensesModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PlannedExpensesModal: React.FC<PlannedExpensesModalProps> = ({
  visible,
  onClose,
}) => {
  const {
    wallets,
    categories,
    plannedExpenses,
    totalPendingPlanned,
    safeToSpendBalance,
    isBalanceHidden,
    addPlannedExpense,
    editPlannedExpense,
    executePlannedExpense,
    removePlannedExpense,
  } = useWallet();

  const [activeTab, setActiveTab] = useState<'pending' | 'executed' | 'all'>('pending');

  // Modal tạo / sửa khoản dự chi
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<PlannedExpense | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [targetDateInput, setTargetDateInput] = useState(dayjs().add(3, 'day').format('YYYY-MM-DD'));
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [noteInput, setNoteInput] = useState('');

  // Modal xác nhận thực hiện chi ("Đã chi")
  const [executingItem, setExecutingItem] = useState<PlannedExpense | null>(null);
  const [actualAmountInput, setActualAmountInput] = useState('');
  const [executeWalletId, setExecuteWalletId] = useState('');
  const [executeNoteInput, setExecuteNoteInput] = useState('');

  // Tổng số dư các ví
  const totalWalletBalance = useMemo(() => {
    return wallets.reduce((sum, w) => sum + w.balance, 0);
  }, [wallets]);

  // Lọc danh sách theo tab
  const filteredExpenses = useMemo(() => {
    let list = [...plannedExpenses];
    if (activeTab === 'pending') {
      list = list.filter(item => item.status === 'pending');
    } else if (activeTab === 'executed') {
      list = list.filter(item => item.status === 'executed');
    }
    // Sắp xếp: pending xếp theo target_date gần nhất; executed xếp theo mới nhất
    return list.sort((a, b) => {
      if (a.status === 'pending' && b.status === 'pending') {
        return a.target_date.localeCompare(b.target_date);
      }
      return b.target_date.localeCompare(a.target_date);
    });
  }, [plannedExpenses, activeTab]);

  const pendingCount = useMemo(
    () => plannedExpenses.filter(p => p.status === 'pending').length,
    [plannedExpenses]
  );
  const executedCount = useMemo(
    () => plannedExpenses.filter(p => p.status === 'executed').length,
    [plannedExpenses]
  );

  // Mở form thêm mới
  const handleOpenAddForm = () => {
    hapticMedium();
    setEditingItem(null);
    setTitleInput('');
    setAmountInput('');
    setTargetDateInput(dayjs().add(3, 'day').format('YYYY-MM-DD'));
    setSelectedCategoryId(categories[0]?.id || '');
    setSelectedWalletId(wallets[0]?.id || '');
    setNoteInput('');
    setFormModalVisible(true);
  };

  // Mở form chỉnh sửa
  const handleOpenEditForm = (item: PlannedExpense) => {
    hapticMedium();
    setEditingItem(item);
    setTitleInput(item.title);
    setAmountInput(item.amount.toString());
    setTargetDateInput(item.target_date);
    setSelectedCategoryId(item.category_id || categories[0]?.id || '');
    setSelectedWalletId(item.wallet_id || '');
    setNoteInput(item.note || '');
    setFormModalVisible(true);
  };

  // Lưu form thêm/sửa
  const handleSaveExpense = async () => {
    if (!titleInput.trim()) {
      hapticError();
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên khoản dự chi.');
      return;
    }
    const numAmount = parseFloat(amountInput.replace(/[^0-9]/g, ''));
    if (isNaN(numAmount) || numAmount <= 0) {
      hapticError();
      Alert.alert('Số tiền không hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0.');
      return;
    }
    if (!targetDateInput || !dayjs(targetDateInput).isValid()) {
      hapticError();
      Alert.alert('Ngày không hợp lệ', 'Vui lòng chọn ngày theo định dạng YYYY-MM-DD.');
      return;
    }

    try {
      if (editingItem) {
        await editPlannedExpense({
          id: editingItem.id,
          title: titleInput.trim(),
          amount: numAmount,
          target_date: targetDateInput,
          category_id: selectedCategoryId || null,
          wallet_id: selectedWalletId || null,
          note: noteInput.trim() || undefined,
        });
        hapticSuccess();
      } else {
        await addPlannedExpense({
          title: titleInput.trim(),
          amount: numAmount,
          target_date: targetDateInput,
          category_id: selectedCategoryId || null,
          wallet_id: selectedWalletId || null,
          note: noteInput.trim() || undefined,
        });
        hapticSuccess();
      }
      setFormModalVisible(false);
    } catch (err: any) {
      hapticError();
      Alert.alert('Lỗi', err?.message || 'Không thể lưu khoản dự chi.');
    }
  };

  // Mở modal xác nhận "Đã chi"
  const handleOpenExecuteModal = (item: PlannedExpense) => {
    hapticMedium();
    setExecutingItem(item);
    setActualAmountInput(item.amount.toString());
    setExecuteWalletId(item.wallet_id || wallets[0]?.id || '');
    setExecuteNoteInput(item.note || '');
  };

  // Thực hiện chi
  const handleConfirmExecute = async () => {
    if (!executingItem) return;
    if (!executeWalletId) {
      hapticError();
      Alert.alert('Chưa chọn nguồn tiền', 'Vui lòng chọn ví để trừ tiền.');
      return;
    }
    const numActual = parseFloat(actualAmountInput.replace(/[^0-9]/g, ''));
    if (isNaN(numActual) || numActual <= 0) {
      hapticError();
      Alert.alert('Số tiền không hợp lệ', 'Vui lòng nhập số tiền thực tế lớn hơn 0.');
      return;
    }

    try {
      await executePlannedExpense({
        id: executingItem.id,
        walletId: executeWalletId,
        actualAmount: numActual,
        note: executeNoteInput.trim() || undefined,
      });
      hapticSuccess();
      setExecutingItem(null);
      Alert.alert('Tuyệt vời 🎉', 'Đã ghi nhận giao dịch chi tiêu và cập nhật số dư ví thành công!');
    } catch (err: any) {
      hapticError();
      Alert.alert('Lỗi khi trừ tiền', err?.message || 'Không thể hoàn thành khoản chi.');
    }
  };

  // Xóa khoản dự chi
  const handleDeleteExpense = (item: PlannedExpense) => {
    hapticLight();
    Alert.alert(
      'Xóa kế hoạch dự chi',
      `Ngài có chắc chắn muốn xóa "${item.title}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa ngay',
          style: 'destructive',
          onPress: async () => {
            await removePlannedExpense(item.id);
            hapticSuccess();
          },
        },
      ]
    );
  };

  // Tính toán badge thời hạn
  const renderDateBadge = (targetDate: string, status: 'pending' | 'executed' | 'cancelled') => {
    if (status === 'executed') {
      return (
        <View style={[styles.dateBadge, { backgroundColor: '#DCFCE7', borderColor: '#16A34A' }]}>
          <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
          <Text style={[styles.dateBadgeText, { color: '#16A34A' }]}>Đã chi</Text>
        </View>
      );
    }
    if (status === 'cancelled') {
      return (
        <View style={[styles.dateBadge, { backgroundColor: '#F3F4F6', borderColor: '#9CA3AF' }]}>
          <Ionicons name="close-circle-outline" size={12} color="#6B7280" />
          <Text style={[styles.dateBadgeText, { color: '#6B7280' }]}>Đã hủy</Text>
        </View>
      );
    }

    const today = dayjs().startOf('day');
    const target = dayjs(targetDate).startOf('day');
    const diffDays = target.diff(today, 'day');

    if (diffDays < 0) {
      return (
        <View style={[styles.dateBadge, { backgroundColor: '#FEE2E2', borderColor: '#DC2626' }]}>
          <Ionicons name="alert-circle" size={12} color="#DC2626" />
          <Text style={[styles.dateBadgeText, { color: '#DC2626' }]}>
            Quá hạn {Math.abs(diffDays)} ngày
          </Text>
        </View>
      );
    }

    if (diffDays === 0) {
      return (
        <View style={[styles.dateBadge, { backgroundColor: THEME.popYellow, borderColor: '#000000' }]}>
          <Ionicons name="time" size={12} color="#000000" />
          <Text style={[styles.dateBadgeText, { color: '#000000' }]}>Hôm nay đến hạn!</Text>
        </View>
      );
    }

    if (diffDays === 1) {
      return (
        <View style={[styles.dateBadge, { backgroundColor: '#FEF08A', borderColor: '#854D0E' }]}>
          <Ionicons name="hourglass-outline" size={12} color="#854D0E" />
          <Text style={[styles.dateBadgeText, { color: '#854D0E' }]}>Ngày mai</Text>
        </View>
      );
    }

    return (
      <View style={[styles.dateBadge, { backgroundColor: '#E0E7FF', borderColor: '#4338CA' }]}>
        <Ionicons name="calendar-outline" size={12} color="#4338CA" />
        <Text style={[styles.dateBadgeText, { color: '#4338CA' }]}>Còn {diffDays} ngày</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.folderTabBadge}>
              <Text style={styles.folderTabBadgeText}>KẾ HOẠCH TÀI CHÍNH</Text>
            </View>
            <Text style={styles.headerTitle}>Quản Lý Dự Chi</Text>
          </View>

          <View style={styles.headerRight}>
            <Pressable
              style={styles.addBtnShadow}
              onPress={handleOpenAddForm}
            >
              <View style={styles.addBtnInner}>
                <Ionicons name="add" size={22} color="#000000" />
                <Text style={styles.addBtnText}>Dự chi mới</Text>
              </View>
            </Pressable>

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color="#000000" />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Safe-to-Spend Hero Banner (Thẻ Tiền An Toàn) */}
          <View style={styles.safeBannerShadow}>
            <View style={styles.safeBannerInner}>
              <View style={styles.safeBannerTop}>
                <View style={styles.safeBannerBadge}>
                  <Ionicons name="shield-checkmark" size={14} color="#000000" />
                  <Text style={styles.safeBannerBadgeText}>TIỀN CÓ THỂ TIÊU AN TOÀN</Text>
                </View>
                <Text style={styles.safeBannerSub}>
                  Sau khi trừ tất cả các khoản đã lên lịch
                </Text>
              </View>

              <Text style={styles.safeBannerAmount} numberOfLines={1}>
                {isBalanceHidden ? '•••••••• ₫' : formatVND(safeToSpendBalance)}
              </Text>

              {/* Equation breakdown bar */}
              <View style={styles.breakdownBar}>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Tổng số dư ví</Text>
                  <Text style={styles.breakdownVal}>{isBalanceHidden ? '••••••' : formatVND(totalWalletBalance)}</Text>
                </View>
                <Text style={styles.breakdownSign}>-</Text>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Dự chi đang chờ</Text>
                  <Text style={[styles.breakdownVal, { color: '#DC2626' }]}>
                    {isBalanceHidden ? '••••••' : formatVND(totalPendingPlanned)}
                  </Text>
                </View>
                <Text style={styles.breakdownSign}>=</Text>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>An toàn</Text>
                  <Text style={[styles.breakdownVal, { color: '#15803D' }]}>
                    {isBalanceHidden ? '••••••' : formatVND(safeToSpendBalance)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Segmented Filter Tabs */}
          <View style={styles.filterTabsRow}>
            <Pressable
              style={[
                styles.filterTab,
                activeTab === 'pending' && styles.filterTabActive,
              ]}
              onPress={() => {
                hapticLight();
                setActiveTab('pending');
              }}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeTab === 'pending' && styles.filterTabTextActive,
                ]}
              >
                Chờ chi ({pendingCount})
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.filterTab,
                activeTab === 'executed' && styles.filterTabActive,
              ]}
              onPress={() => {
                hapticLight();
                setActiveTab('executed');
              }}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeTab === 'executed' && styles.filterTabTextActive,
                ]}
              >
                Đã chi ({executedCount})
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.filterTab,
                activeTab === 'all' && styles.filterTabActive,
              ]}
              onPress={() => {
                hapticLight();
                setActiveTab('all');
              }}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeTab === 'all' && styles.filterTabTextActive,
                ]}
              >
                Tất cả ({plannedExpenses.length})
              </Text>
            </Pressable>
          </View>

          {/* Planned Expenses List */}
          {filteredExpenses.length === 0 ? (
            <View style={styles.emptyCardShadow}>
              <View style={styles.emptyCardInner}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="calendar-outline" size={36} color="#000000" />
                </View>
                <Text style={styles.emptyTitle}>
                  {activeTab === 'pending'
                    ? 'Chưa có khoản dự chi nào đang chờ!'
                    : activeTab === 'executed'
                    ? 'Chưa có khoản dự chi nào đã thực hiện.'
                    : 'Danh sách dự chi đang trống.'}
                </Text>
                <Text style={styles.emptySub}>
                  Lên kế hoạch các khoản tiền cần chi trong tương lai (tiền nhà, tiền điện, mua quà...) để luôn chủ động tài chính.
                </Text>

                <Pressable
                  style={styles.emptyAddBtnShadow}
                  onPress={handleOpenAddForm}
                >
                  <View style={styles.emptyAddBtnInner}>
                    <Ionicons name="add" size={20} color="#000000" />
                    <Text style={styles.emptyAddBtnText}>Tạo dự chi đầu tiên</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          ) : (
            filteredExpenses.map(item => {
              const cat = categories.find(c => c.id === item.category_id);
              const wallet = wallets.find(w => w.id === item.wallet_id);
              const isPending = item.status === 'pending';

              return (
                <View key={item.id} style={styles.itemCardShadow}>
                  <View style={styles.itemCardInner}>
                    {/* Item Top Row */}
                    <View style={styles.itemTopRow}>
                      <View style={styles.itemLeftGroup}>
                        <View
                          style={[
                            styles.itemCatIconBox,
                            { backgroundColor: cat?.color || THEME.popYellow },
                          ]}
                        >
                          <Ionicons
                            name={(cat?.icon as any) || 'calendar'}
                            size={18}
                            color="#000000"
                          />
                        </View>
                        <View style={styles.itemTextCol}>
                          <Text style={styles.itemTitle}>{item.title}</Text>
                          <View style={styles.itemSubRow}>
                            <Text style={styles.itemCatName}>
                              {cat?.name || 'Khác'}
                            </Text>
                            {wallet ? (
                              <>
                                <Text style={styles.itemDot}>•</Text>
                                <Text style={styles.itemWalletName}>{wallet.name}</Text>
                              </>
                            ) : null}
                          </View>
                        </View>
                      </View>

                      <View style={styles.itemAmountCol}>
                        <Text style={styles.itemAmountText}>
                          {isBalanceHidden ? '••••••' : formatVND(item.amount)}
                        </Text>
                        {item.actual_amount && item.actual_amount !== item.amount ? (
                          <Text style={styles.itemActualText}>
                            Thực tế: {isBalanceHidden ? '••••••' : formatVND(item.actual_amount)}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Item Note if any */}
                    {item.note ? (
                      <View style={styles.itemNoteBox}>
                        <Ionicons name="reader-outline" size={13} color="#4B5563" />
                        <Text style={styles.itemNoteText}>{item.note}</Text>
                      </View>
                    ) : null}

                    {/* Item Footer Row: Date badge + Actions */}
                    <View style={styles.itemFooterRow}>
                      <View style={styles.itemDateGroup}>
                        <Text style={styles.itemDateLabel}>
                          Ngày dự chi: {dayjs(item.target_date).format('DD/MM/YYYY')}
                        </Text>
                        {renderDateBadge(item.target_date, item.status)}
                      </View>

                      <View style={styles.itemActionsGroup}>
                        {isPending && (
                          <Pressable
                            style={styles.executeBtnShadow}
                            onPress={() => handleOpenExecuteModal(item)}
                          >
                            <View style={styles.executeBtnInner}>
                              <Ionicons name="checkmark-sharp" size={16} color="#000000" />
                              <Text style={styles.executeBtnText}>Đã chi</Text>
                            </View>
                          </Pressable>
                        )}

                        {isPending && (
                          <Pressable
                            style={styles.iconActionBtn}
                            onPress={() => handleOpenEditForm(item)}
                          >
                            <Ionicons name="pencil-sharp" size={16} color="#000000" />
                          </Pressable>
                        )}

                        <Pressable
                          style={[styles.iconActionBtn, { backgroundColor: '#FEE2E2' }]}
                          onPress={() => handleDeleteExpense(item)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#DC2626" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Modal Thêm / Chỉnh sửa Dự Chi */}
        <Modal
          visible={formModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setFormModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.formModalBox}>
              <View style={styles.formModalHeader}>
                <Text style={styles.formModalTitle}>
                  {editingItem ? 'Chỉnh Sửa Dự Chi' : 'Tạo Kế Hoạch Dự Chi'}
                </Text>
                <Pressable
                  style={styles.formModalCloseBtn}
                  onPress={() => setFormModalVisible(false)}
                >
                  <Ionicons name="close" size={20} color="#000000" />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Tiêu đề */}
                <Text style={styles.inputLabel}>TÊN KHOẢN DỰ CHI *</Text>
                <TextInput
                  style={styles.inputField}
                  value={titleInput}
                  onChangeText={setTitleInput}
                  placeholder="VD: Tiền trọ, Đám cưới, Học phí..."
                  placeholderTextColor="#9CA3AF"
                />

                {/* Số tiền */}
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>SỐ TIỀN DỰ KIẾN (₫) *</Text>
                <TextInput
                  style={[styles.inputField, styles.amountInputField]}
                  value={amountInput}
                  onChangeText={setAmountInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                />

                {/* Ngày dự chi */}
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                  NGÀY DỰ KIẾN CHI (YYYY-MM-DD) *
                </Text>
                <View style={styles.dateInputRow}>
                  <Ionicons name="calendar" size={18} color="#000000" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.dateTextInput}
                    value={targetDateInput}
                    onChangeText={setTargetDateInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Quick Date Chips */}
                <View style={styles.dateChipsRow}>
                  {[
                    { label: 'Hôm nay', val: dayjs().format('YYYY-MM-DD') },
                    { label: 'Ngày mai', val: dayjs().add(1, 'day').format('YYYY-MM-DD') },
                    { label: 'Sau 3 ngày', val: dayjs().add(3, 'day').format('YYYY-MM-DD') },
                    { label: '1 tuần tới', val: dayjs().add(7, 'day').format('YYYY-MM-DD') },
                    { label: 'Đầu tháng tới', val: dayjs().add(1, 'month').startOf('month').format('YYYY-MM-DD') },
                  ].map(chip => (
                    <Pressable
                      key={chip.label}
                      style={[
                        styles.dateChip,
                        targetDateInput === chip.val && styles.dateChipActive,
                      ]}
                      onPress={() => {
                        hapticLight();
                        setTargetDateInput(chip.val);
                      }}
                    >
                      <Text
                        style={[
                          styles.dateChipText,
                          targetDateInput === chip.val && styles.dateChipTextActive,
                        ]}
                      >
                        {chip.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Danh mục */}
                <Text style={[styles.inputLabel, { marginTop: 14 }]}>DANH MỤC</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catPickerScroll}>
                  {categories.map(cat => {
                    const isSelected = selectedCategoryId === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        style={[
                          styles.catChip,
                          isSelected && styles.catChipActive,
                        ]}
                        onPress={() => {
                          hapticLight();
                          setSelectedCategoryId(cat.id);
                        }}
                      >
                        <View style={[styles.catChipIcon, { backgroundColor: cat.color }]}>
                          <Ionicons name={(cat.icon as any) || 'folder'} size={14} color="#000000" />
                        </View>
                        <Text style={[styles.catChipText, isSelected && styles.catChipTextActive]}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Ví dự kiến */}
                <Text style={[styles.inputLabel, { marginTop: 14 }]}>VÍ DỰ KIẾN CHI (TÙY CHỌN)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.walletPickerScroll}>
                  <Pressable
                    style={[
                      styles.walletChip,
                      selectedWalletId === '' && styles.walletChipActive,
                    ]}
                    onPress={() => {
                      hapticLight();
                      setSelectedWalletId('');
                    }}
                  >
                    <Text style={[styles.walletChipText, selectedWalletId === '' && styles.walletChipTextActive]}>
                      Chưa định ví
                    </Text>
                  </Pressable>

                  {wallets.map(w => {
                    const isSelected = selectedWalletId === w.id;
                    return (
                      <Pressable
                        key={w.id}
                        style={[
                          styles.walletChip,
                          isSelected && styles.walletChipActive,
                        ]}
                        onPress={() => {
                          hapticLight();
                          setSelectedWalletId(w.id);
                        }}
                      >
                        <Text style={[styles.walletChipText, isSelected && styles.walletChipTextActive]}>
                          {w.name} {isBalanceHidden ? '' : `(${formatVND(w.balance)})`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Ghi chú */}
                <Text style={[styles.inputLabel, { marginTop: 14 }]}>GHI CHÚ (TÙY CHỌN)</Text>
                <TextInput
                  style={[styles.inputField, { height: 64, textAlignVertical: 'top' }]}
                  value={noteInput}
                  onChangeText={setNoteInput}
                  placeholder="Ghi chú chi tiết cho khoản chi này..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                />

                {/* Save Button */}
                <Pressable
                  style={styles.saveBtnShadow}
                  onPress={handleSaveExpense}
                >
                  <View style={styles.saveBtnInner}>
                    <Text style={styles.saveBtnText}>
                      {editingItem ? 'Cập nhật dự chi' : 'Lưu kế hoạch dự chi'}
                    </Text>
                  </View>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Modal Xác nhận "Đã chi" */}
        <Modal
          visible={!!executingItem}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setExecutingItem(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.executeModalBox}>
              <View style={styles.formModalHeader}>
                <View style={styles.executeTitleBadge}>
                  <Text style={styles.executeTitleBadgeText}>HOÀN TẤT CHI</Text>
                </View>
                <Text style={styles.formModalTitle}>Xác Nhận Đã Chi</Text>
                <Pressable
                  style={styles.formModalCloseBtn}
                  onPress={() => setExecutingItem(null)}
                >
                  <Ionicons name="close" size={20} color="#000000" />
                </Pressable>
              </View>

              <Text style={styles.executePrompt}>
                Hệ thống sẽ ghi một khoản chi tiêu mới vào nhật ký và tự động trừ số dư ví đã chọn.
              </Text>

              {/* Tên khoản dự chi */}
              <View style={styles.executeInfoBox}>
                <Text style={styles.executeInfoTitle}>{executingItem?.title}</Text>
                <Text style={styles.executeInfoSub}>
                  Dự kiến: {isBalanceHidden ? '••••••' : formatVND(executingItem?.amount || 0)}
                </Text>
              </View>

              {/* Số tiền thực tế */}
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>SỐ TIỀN THỰC TẾ ĐÃ CHI (₫) *</Text>
              <TextInput
                style={[styles.inputField, styles.amountInputField]}
                value={actualAmountInput}
                onChangeText={setActualAmountInput}
                keyboardType="numeric"
              />

              {/* Chọn ví thanh toán */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>TRỪ TỪ VÍ NÀO? *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.walletPickerScroll}>
                {wallets.map(w => {
                  const isSelected = executeWalletId === w.id;
                  return (
                    <Pressable
                      key={w.id}
                      style={[
                        styles.walletChip,
                        isSelected && styles.walletChipActive,
                      ]}
                      onPress={() => {
                        hapticLight();
                        setExecuteWalletId(w.id);
                      }}
                    >
                      <Text style={[styles.walletChipText, isSelected && styles.walletChipTextActive]}>
                        {w.name} {isBalanceHidden ? '' : `(${formatVND(w.balance)})`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Ghi chú thêm */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>GHI CHÚ GIAO DỊCH (TÙY CHỌN)</Text>
              <TextInput
                style={styles.inputField}
                value={executeNoteInput}
                onChangeText={setExecuteNoteInput}
                placeholder="Ghi chú hóa đơn thực tế..."
                placeholderTextColor="#9CA3AF"
              />

              <View style={styles.executeBtnRow}>
                <Pressable
                  style={styles.executeCancelBtn}
                  onPress={() => setExecutingItem(null)}
                >
                  <Text style={styles.executeCancelText}>Hủy</Text>
                </Pressable>

                <Pressable
                  style={styles.confirmExecuteBtnShadow}
                  onPress={handleConfirmExecute}
                >
                  <View style={styles.confirmExecuteBtnInner}>
                    <Ionicons name="checkmark-circle" size={18} color="#000000" />
                    <Text style={styles.confirmExecuteBtnText}>Xác nhận trừ ví</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flex: 1,
  },
  folderTabBadge: {
    alignSelf: 'flex-start',
    backgroundColor: THEME.popYellow,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
    marginBottom: 4,
  },
  folderTabBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  addBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Safe-to-Spend Hero Banner
  safeBannerShadow: {
    backgroundColor: '#000000',
    borderRadius: 18,
    marginBottom: 16,
  },
  safeBannerInner: {
    backgroundColor: '#ECFDF5',
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 16,
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  safeBannerTop: {
    marginBottom: 6,
  },
  safeBannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: THEME.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    marginBottom: 4,
  },
  safeBannerBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
  },
  safeBannerSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  safeBannerAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000000',
    marginVertical: 4,
  },
  breakdownBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  breakdownItem: {
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 2,
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  breakdownSign: {
    fontSize: 16,
    fontWeight: '900',
    color: '#9CA3AF',
  },

  // Filter tabs
  filterTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#000000',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#000000',
  },

  // Empty State
  emptyCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 18,
    marginTop: 10,
  },
  emptyCardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 24,
    alignItems: 'center',
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyAddBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  emptyAddBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  emptyAddBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },

  // Expense Card
  itemCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 16,
    marginBottom: 14,
  },
  itemCardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 14,
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  itemCatIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTextCol: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
  },
  itemSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  itemCatName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  itemDot: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  itemWalletName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  itemAmountCol: {
    alignItems: 'flex-end',
  },
  itemAmountText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#000000',
  },
  itemActualText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    marginTop: 2,
  },
  itemNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 10,
  },
  itemNoteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    flex: 1,
  },
  itemFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1.5,
    borderTopColor: '#F3F4F6',
  },
  itemDateGroup: {
    flexDirection: 'column',
    gap: 4,
  },
  itemDateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  dateBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  itemActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  executeBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  executeBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    transform: [{ translateX: -1.5 }, { translateY: -1.5 }],
  },
  executeBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modals General
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  formModalBox: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 3,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: '#000000',
    padding: 20,
    maxHeight: '90%',
  },
  formModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  formModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
  },
  formModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#374151',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  inputField: {
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    backgroundColor: '#F9FAFB',
  },
  amountInputField: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
  },
  dateTextInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
  },
  dateChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  dateChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
  },
  dateChipActive: {
    borderColor: '#000000',
    backgroundColor: THEME.popYellow,
  },
  dateChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4B5563',
  },
  dateChipTextActive: {
    color: '#000000',
  },
  catPickerScroll: {
    marginBottom: 4,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    marginRight: 8,
  },
  catChipActive: {
    borderColor: '#000000',
    backgroundColor: '#FEF08A',
  },
  catChipIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
  },
  catChipTextActive: {
    color: '#000000',
  },
  walletPickerScroll: {
    marginBottom: 4,
  },
  walletChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    marginRight: 8,
  },
  walletChipActive: {
    borderColor: '#000000',
    backgroundColor: THEME.popBlue,
  },
  walletChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
  },
  walletChipTextActive: {
    color: '#000000',
  },
  saveBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 14,
    marginTop: 20,
    marginBottom: 10,
  },
  saveBtnInner: {
    backgroundColor: THEME.primary,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#000000',
    paddingVertical: 14,
    alignItems: 'center',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
  },

  // Execute Modal Specifics
  executeModalBox: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 3,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: '#000000',
    padding: 20,
  },
  executeTitleBadge: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    marginRight: 8,
  },
  executeTitleBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
  },
  executePrompt: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 12,
    lineHeight: 18,
  },
  executeInfoBox: {
    backgroundColor: '#FEF9C3',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 12,
    marginBottom: 10,
  },
  executeInfoTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  executeInfoSub: {
    fontSize: 13,
    fontWeight: '700',
    color: '#854D0E',
    marginTop: 2,
  },
  executeBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  executeCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  executeCancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
  confirmExecuteBtnShadow: {
    flex: 2,
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  confirmExecuteBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.primary,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 12,
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  confirmExecuteBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
});
