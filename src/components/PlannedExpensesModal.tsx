import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useCustomAlert } from './CustomAlertModal';
import dayjs from 'dayjs';
import { useWallet } from '../context/WalletContext';
import { PlannedExpense } from '../types';
import { THEME, formatVND } from '../constants';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '../utils/haptics';
import * as queries from '../database/queries';

export type DateFilterType =
  | 'all'
  | 'overdue'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'next_month'
  | 'custom';

interface PlannedExpensesModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PlannedExpensesModal: React.FC<PlannedExpensesModalProps> = ({
  visible,
  onClose,
}) => {
  const db = useSQLiteContext();
  const {
    wallets,
    categories,
    plannedExpenses,
    totalPendingPlanned,
    totalAllPendingPlanned,
    liquidAvailableBalance,
    safeToSpendBalance,
    isBalanceHidden,
    addPlannedExpense,
    editPlannedExpense,
    executePlannedExpense,
    removePlannedExpense,
    refreshData,
  } = useWallet();
  const { showAlert, showConfirm, AlertModalComponent } = useCustomAlert(false);

  const [activeTab, setActiveTab] = useState<'pending' | 'executed' | 'all'>('pending');

  // Lọc ngày
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [datePickerModalVisible, setDatePickerModalVisible] = useState<boolean>(false);
  const [tempStartDate, setTempStartDate] = useState<string | null>(null);
  const [tempEndDate, setTempEndDate] = useState<string | null>(null);
  const [pickerMonth, setPickerMonth] = useState<Date>(new Date());

  // Chế độ chọn nhiều & Thao tác hàng loạt
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchExecuteModalVisible, setBatchExecuteModalVisible] = useState<boolean>(false);
  const [batchExecuteWalletId, setBatchExecuteWalletId] = useState<string>('auto');
  const [batchExecuteNote, setBatchExecuteNote] = useState<string>('');

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

  // Các mốc ngày tính toán
  const todayStr = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
  const startOfWeek = useMemo(() => dayjs().startOf('week').format('YYYY-MM-DD'), []);
  const endOfWeek = useMemo(() => dayjs().endOf('week').format('YYYY-MM-DD'), []);
  const startOfThisMonth = useMemo(() => dayjs().startOf('month').format('YYYY-MM-DD'), []);
  const endOfThisMonth = useMemo(() => dayjs().endOf('month').format('YYYY-MM-DD'), []);
  const startOfNextMonth = useMemo(() => dayjs().add(1, 'month').startOf('month').format('YYYY-MM-DD'), []);
  const endOfNextMonth = useMemo(() => dayjs().add(1, 'month').endOf('month').format('YYYY-MM-DD'), []);

  // Tổng số dư các ví
  const totalWalletBalance = useMemo(() => {
    return wallets.reduce((sum, w) => sum + w.balance, 0);
  }, [wallets]);

  // Lọc danh sách theo tab VÀ lọc theo ngày
  const filteredExpenses = useMemo(() => {
    let list = [...plannedExpenses];
    if (activeTab === 'pending') {
      list = list.filter(item => item.status === 'pending');
    } else if (activeTab === 'executed') {
      list = list.filter(item => item.status === 'executed');
    }

    if (dateFilter === 'overdue') {
      list = list.filter(item => item.target_date < todayStr && item.status === 'pending');
    } else if (dateFilter === 'today') {
      list = list.filter(item => item.target_date === todayStr);
    } else if (dateFilter === 'this_week') {
      list = list.filter(item => item.target_date >= startOfWeek && item.target_date <= endOfWeek);
    } else if (dateFilter === 'this_month') {
      list = list.filter(item => item.target_date >= startOfThisMonth && item.target_date <= endOfThisMonth);
    } else if (dateFilter === 'next_month') {
      list = list.filter(item => item.target_date >= startOfNextMonth && item.target_date <= endOfNextMonth);
    } else if (dateFilter === 'custom') {
      if (customStartDate) {
        list = list.filter(item => item.target_date >= customStartDate);
      }
      if (customEndDate) {
        list = list.filter(item => item.target_date <= customEndDate);
      }
    }

    // Sắp xếp: pending xếp theo target_date gần nhất; executed xếp theo mới nhất
    return list.sort((a, b) => {
      if (a.status === 'pending' && b.status === 'pending') {
        return a.target_date.localeCompare(b.target_date);
      }
      return b.target_date.localeCompare(a.target_date);
    });
  }, [
    plannedExpenses,
    activeTab,
    dateFilter,
    customStartDate,
    customEndDate,
    todayStr,
    startOfWeek,
    endOfWeek,
    startOfThisMonth,
    endOfThisMonth,
    startOfNextMonth,
    endOfNextMonth,
  ]);

  // Đếm số lượng cho từng chip lọc ngày
  const dateCounts = useMemo(() => {
    let baseList = [...plannedExpenses];
    if (activeTab === 'pending') {
      baseList = baseList.filter(item => item.status === 'pending');
    } else if (activeTab === 'executed') {
      baseList = baseList.filter(item => item.status === 'executed');
    }

    return {
      all: baseList.length,
      overdue: baseList.filter(i => i.target_date < todayStr && i.status === 'pending').length,
      today: baseList.filter(i => i.target_date === todayStr).length,
      this_week: baseList.filter(i => i.target_date >= startOfWeek && i.target_date <= endOfWeek).length,
      this_month: baseList.filter(i => i.target_date >= startOfThisMonth && i.target_date <= endOfThisMonth).length,
      next_month: baseList.filter(i => i.target_date >= startOfNextMonth && i.target_date <= endOfNextMonth).length,
    };
  }, [
    plannedExpenses,
    activeTab,
    todayStr,
    startOfWeek,
    endOfWeek,
    startOfThisMonth,
    endOfThisMonth,
    startOfNextMonth,
    endOfNextMonth,
  ]);

  const pendingCount = useMemo(
    () => plannedExpenses.filter(p => p.status === 'pending').length,
    [plannedExpenses]
  );
  const executedCount = useMemo(
    () => plannedExpenses.filter(p => p.status === 'executed').length,
    [plannedExpenses]
  );

  // Các khoản đang được chọn
  const selectedItems = useMemo(() => {
    return plannedExpenses.filter(p => selectedIds.has(p.id));
  }, [plannedExpenses, selectedIds]);

  const selectedPendingItems = useMemo(() => {
    return selectedItems.filter(p => p.status === 'pending');
  }, [selectedItems]);

  const totalSelectedAmount = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.amount, 0);
  }, [selectedItems]);

  const totalPendingSelectedAmount = useMemo(() => {
    return selectedPendingItems.reduce((sum, item) => sum + item.amount, 0);
  }, [selectedPendingItems]);

  // Xử lý mở lịch chọn khoảng ngày
  const handleOpenDatePickerModal = () => {
    hapticMedium();
    setTempStartDate(customStartDate || todayStr);
    setTempEndDate(customEndDate || null);
    setPickerMonth(customStartDate ? dayjs(customStartDate).toDate() : new Date());
    setDatePickerModalVisible(true);
  };

  // Tính toán số ngày trong tháng cho lịch trực quan
  const getCalendarDays = (monthDate: Date) => {
    const startOfMonth = dayjs(monthDate).startOf('month');
    const daysInMonth = startOfMonth.daysInMonth();
    const startDayOfWeek = (startOfMonth.day() + 6) % 7;
    const days: Array<{ dayNum: number | null }> = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ dayNum: null });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ dayNum: i });
    }
    return days;
  };

  // Thống kê kết quả lọc
  const filteredTotalAmount = useMemo(() => {
    return filteredExpenses.reduce(
      (sum, item) =>
        sum + (activeTab === 'executed' ? (item.actual_amount || item.amount) : item.amount),
      0
    );
  }, [filteredExpenses, activeTab]);

  const filteredPendingCount = useMemo(() => {
    return filteredExpenses.filter(item => item.status === 'pending').length;
  }, [filteredExpenses]);

  const filteredPendingAmount = useMemo(() => {
    return filteredExpenses
      .filter(item => item.status === 'pending')
      .reduce((sum, item) => sum + item.amount, 0);
  }, [filteredExpenses]);

  const filteredExecutedCount = useMemo(() => {
    return filteredExpenses.filter(item => item.status === 'executed').length;
  }, [filteredExpenses]);

  const filteredExecutedAmount = useMemo(() => {
    return filteredExpenses
      .filter(item => item.status === 'executed')
      .reduce((sum, item) => sum + (item.actual_amount || item.amount), 0);
  }, [filteredExpenses]);

  const getFilterTitle = (): string => {
    let dateStr = '';
    switch (dateFilter) {
      case 'overdue':
        dateStr = 'Khoản Quá Hạn';
        break;
      case 'today':
        dateStr = `Hôm nay (${dayjs().format('DD/MM')})`;
        break;
      case 'this_week':
        dateStr = 'Tuần này';
        break;
      case 'this_month':
        dateStr = `Tháng ${dayjs().format('MM/YYYY')}`;
        break;
      case 'next_month':
        dateStr = `Tháng sau (${dayjs().add(1, 'month').format('MM/YYYY')})`;
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          if (customStartDate === customEndDate) {
            dateStr = dayjs(customStartDate).format('DD/MM/YYYY');
          } else {
            dateStr = `${dayjs(customStartDate).format('DD/MM')} - ${dayjs(customEndDate).format('DD/MM/YYYY')}`;
          }
        } else if (customStartDate) {
          dateStr = `Từ ${dayjs(customStartDate).format('DD/MM/YYYY')}`;
        } else if (customEndDate) {
          dateStr = `Đến ${dayjs(customEndDate).format('DD/MM/YYYY')}`;
        } else {
          dateStr = 'Khoảng ngày';
        }
        break;
      default:
        dateStr = 'Toàn bộ thời gian';
        break;
    }

    let tabStr = '';
    if (activeTab === 'pending') tabStr = 'Chờ chi';
    else if (activeTab === 'executed') tabStr = 'Đã chi';
    else tabStr = 'Tất cả';

    return `${dateStr} • ${tabStr}`;
  };

  // Xử lý chọn / bỏ chọn
  const toggleSelect = (id: string) => {
    hapticLight();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    hapticMedium();
    const visibleIds = filteredExpenses.map(item => item.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));

    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const exitSelectMode = () => {
    hapticLight();
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const enterSelectModeWithItem = (id: string) => {
    hapticMedium();
    setIsSelectMode(true);
    setSelectedIds(new Set([id]));
  };

  // Xử lý xóa hàng loạt
  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    hapticLight();
    showConfirm(
      `Xóa ${selectedIds.size} kế hoạch dự chi`,
      `Bạn có chắc chắn muốn xóa ${selectedIds.size} khoản dự chi đã chọn? Thao tác này sẽ xóa vĩnh viễn và không thể hoàn tác.`,
      async () => {
        try {
          await db.withTransactionAsync(async () => {
            for (const id of Array.from(selectedIds)) {
              await queries.deletePlannedExpense(db, id);
            }
          });
          await refreshData();
          exitSelectMode();
          hapticSuccess();
          showAlert('Thành công', `Đã xóa thành công ${selectedIds.size} khoản dự chi.`);
        } catch (err: any) {
          hapticError();
          showAlert('Lỗi', err?.message || 'Không thể xóa các khoản dự chi.');
        }
      },
      { destructive: true, confirmText: 'Xóa tất cả' }
    );
  };

  // Xử lý đã chi hàng loạt
  const handleOpenBatchExecuteModal = () => {
    if (selectedPendingItems.length === 0) {
      showAlert('Thông báo', 'Không có khoản dự chi nào đang chờ để thực hiện thanh toán.');
      return;
    }
    hapticMedium();
    setBatchExecuteWalletId('auto');
    setBatchExecuteNote('');
    setBatchExecuteModalVisible(true);
  };

  const handleConfirmBatchExecute = async () => {
    if (selectedPendingItems.length === 0) return;
    try {
      hapticMedium();
      const defaultWalletId = wallets[0]?.id;
      if (!defaultWalletId && batchExecuteWalletId === 'auto') {
        showAlert('Chưa có ví', 'Vui lòng tạo ví trong hệ thống trước khi thanh toán.');
        return;
      }

      await db.withTransactionAsync(async () => {
        for (const item of selectedPendingItems) {
          const targetWalletId =
            batchExecuteWalletId === 'auto'
              ? (item.wallet_id || defaultWalletId)
              : batchExecuteWalletId;

          await queries.executePlannedExpense(db, {
            id: item.id,
            walletId: targetWalletId,
            actualAmount: item.amount,
            note: batchExecuteNote.trim() || undefined,
          });
        }
      });

      await refreshData();
      setBatchExecuteModalVisible(false);
      exitSelectMode();
      hapticSuccess();
      showAlert(
        'Thành công',
        `Đã ghi nhận thanh toán hoàn tất cho ${selectedPendingItems.length} khoản dự chi!`
      );
    } catch (err: any) {
      hapticError();
      showAlert('Lỗi thanh toán', err?.message || 'Không thể hoàn tất thanh toán hàng loạt.');
    }
  };

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
      showAlert('Thiếu thông tin', 'Vui lòng nhập tên khoản dự chi.');
      return;
    }
    const numAmount = parseFloat(amountInput.replace(/[^0-9]/g, ''));
    if (isNaN(numAmount) || numAmount <= 0) {
      hapticError();
      showAlert('Số tiền không hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0.');
      return;
    }
    if (!targetDateInput || !dayjs(targetDateInput).isValid()) {
      hapticError();
      showAlert('Ngày không hợp lệ', 'Vui lòng chọn ngày theo định dạng YYYY-MM-DD.');
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
      showAlert('Lỗi', err?.message || 'Không thể lưu khoản dự chi.');
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
      showAlert('Chưa chọn nguồn tiền', 'Vui lòng chọn ví để trừ tiền.');
      return;
    }
    const numActual = parseFloat(actualAmountInput.replace(/[^0-9]/g, ''));
    if (isNaN(numActual) || numActual <= 0) {
      hapticError();
      showAlert('Số tiền không hợp lệ', 'Vui lòng nhập số tiền thực tế lớn hơn 0.');
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
      showAlert('Thành công', 'Đã ghi nhận giao dịch chi tiêu và cập nhật số dư ví thành công!');
    } catch (err: any) {
      hapticError();
      showAlert('Lỗi khi trừ tiền', err?.message || 'Không thể hoàn thành khoản chi.');
    }
  };

  // Xóa khoản dự chi
  const handleDeleteExpense = (item: PlannedExpense) => {
    hapticLight();
    showConfirm(
      'Xóa kế hoạch dự chi',
      `Bạn có chắc chắn muốn xóa "${item.title}"?`,
      async () => {
        await removePlannedExpense(item.id);
        hapticSuccess();
      },
      { destructive: true, confirmText: 'Xóa ngay' }
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
    const endOfNextMonth = dayjs().add(1, 'month').endOf('month').format('YYYY-MM-DD');
    const isBeyondNextMonth = targetDate.substring(0, 10) > endOfNextMonth;

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

    if (isBeyondNextMonth) {
      return (
        <View style={[styles.dateBadge, { backgroundColor: '#F3E8FF', borderColor: '#7E22CE' }]}>
          <Ionicons name="time-outline" size={12} color="#7E22CE" />
          <Text style={[styles.dateBadgeText, { color: '#7E22CE' }]}>Kỳ sau ({dayjs(targetDate).format('MM/YYYY')})</Text>
        </View>
      );
    }

    return (
      <View style={[styles.dateBadge, { backgroundColor: '#E0E7FF', borderColor: '#4338CA' }]}>
        <Ionicons name="time-outline" size={12} color="#4338CA" />
        <Text style={[styles.dateBadgeText, { color: '#4338CA' }]}>Còn {diffDays} ngày</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Top Header */}
        {isSelectMode ? (
          <View style={[styles.headerRow, styles.selectionHeaderRow]}>
            <View style={styles.selectionHeaderLeft}>
              <Pressable style={styles.selectionCloseBtn} onPress={exitSelectMode}>
                <Ionicons name="close" size={20} color="#000000" />
              </Pressable>
              <View>
                <Text style={styles.selectionTitle}>
                  Đã chọn: {selectedIds.size} / {filteredExpenses.length}
                </Text>
                <Text style={styles.selectionSub}>
                  Tổng: {isBalanceHidden ? '••••••' : formatVND(totalSelectedAmount)}
                </Text>
              </View>
            </View>

            <View style={styles.selectionHeaderRight}>
              <Pressable
                style={styles.selectAllBtn}
                onPress={handleToggleSelectAll}
              >
                <Text style={styles.selectAllBtnText}>
                  {filteredExpenses.length > 0 && filteredExpenses.every(i => selectedIds.has(i.id))
                    ? 'Bỏ chọn hết'
                    : 'Chọn tất cả'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle} numberOfLines={1}>Quản Lý Dự Chi</Text>
              <Text style={styles.headerSubtitle}>
                {plannedExpenses.length} khoản • {pendingCount} chờ chi
              </Text>
            </View>

            <View style={styles.headerRight}>
              <Pressable
                style={styles.addBtnShadow}
                onPress={handleOpenAddForm}
              >
                <View style={styles.addBtnInner}>
                  <Ionicons name="add" size={18} color="#000000" />
                  <Text style={styles.addBtnText}>Thêm</Text>
                </View>
              </Pressable>

              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color="#000000" />
              </Pressable>
            </View>
          </View>
        )}

        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.scrollContent,
            isSelectMode && selectedIds.size > 0 && { paddingBottom: 110 },
          ]}
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
                  Bảo lưu dự chi kỳ tới ({dayjs().format('MM/YYYY')} - {dayjs().add(1, 'month').format('MM/YYYY')})
                </Text>
              </View>

              <Text style={styles.safeBannerAmount} numberOfLines={1}>
                {isBalanceHidden ? '•••••••• ₫' : formatVND(safeToSpendBalance)}
              </Text>

              {/* Equation breakdown bar */}
              <View style={styles.breakdownBar}>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Tài sản khả dụng</Text>
                  <Text style={styles.breakdownVal} numberOfLines={1} adjustsFontSizeToFit>{isBalanceHidden ? '••••••' : formatVND(liquidAvailableBalance)}</Text>
                </View>
                <Text style={styles.breakdownSign}>-</Text>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Dự chi kỳ tới</Text>
                  <Text style={[styles.breakdownVal, { color: '#DC2626' }]} numberOfLines={1} adjustsFontSizeToFit>
                    {isBalanceHidden ? '••••••' : formatVND(totalPendingPlanned)}
                  </Text>
                </View>
                <Text style={styles.breakdownSign}>=</Text>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>An toàn</Text>
                  <Text style={[styles.breakdownVal, { color: '#15803D' }]} numberOfLines={1} adjustsFontSizeToFit>
                    {isBalanceHidden ? '••••••' : formatVND(safeToSpendBalance)}
                  </Text>
                </View>
              </View>

              {totalAllPendingPlanned > totalPendingPlanned && (
                <Text style={styles.breakdownNoteText}>
                  * Không tính các khoản dự chi dài hạn sau tháng {dayjs().add(1, 'month').format('MM/YYYY')} ({formatVND(totalAllPendingPlanned - totalPendingPlanned)}) để tránh hụt tiền chi tiêu thực tế.
                </Text>
              )}
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

          {/* Date Filter Pills (Tháng này & Tháng sau ưu tiên lên đầu) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dateFilterScroll}
            contentContainerStyle={styles.dateFilterContent}
          >
            {[
              { key: 'this_month', label: 'Tháng này', count: dateCounts.this_month },
              { key: 'next_month', label: 'Tháng sau', count: dateCounts.next_month },
              { key: 'all', label: 'Tất cả ngày', count: dateCounts.all },
              { key: 'overdue', label: 'Quá hạn', count: dateCounts.overdue, isAlert: dateCounts.overdue > 0 },
              { key: 'today', label: 'Hôm nay', count: dateCounts.today },
              { key: 'this_week', label: 'Tuần này', count: dateCounts.this_week },
            ].map(pill => {
              const isActive = dateFilter === pill.key;
              return (
                <Pressable
                  key={pill.key}
                  style={[
                    styles.dateFilterPill,
                    isActive && styles.dateFilterPillActive,
                    pill.isAlert && !isActive && styles.dateFilterPillAlert,
                  ]}
                  onPress={() => {
                    hapticLight();
                    setDateFilter(pill.key as DateFilterType);
                  }}
                >
                  {pill.isAlert && (
                    <Ionicons
                      name="alert-circle"
                      size={13}
                      color={isActive ? '#000000' : '#DC2626'}
                      style={{ marginRight: 3 }}
                    />
                  )}
                  <Text
                    style={[
                      styles.dateFilterPillText,
                      isActive && styles.dateFilterPillTextActive,
                      pill.isAlert && !isActive && styles.dateFilterPillTextAlert,
                    ]}
                  >
                    {pill.label} {pill.count !== undefined ? `(${pill.count})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Card Thống Kê Kết Quả Lọc */}
          <View style={styles.statsCardShadow}>
            <View style={styles.statsCardInner}>
              <View style={styles.statsCardHeader}>
                <View style={styles.statsCardTitleRow}>
                  <View style={styles.statsCardIconBadge}>
                    <Ionicons name="pie-chart" size={14} color="#000000" />
                  </View>
                  <Text style={styles.statsCardTitle} numberOfLines={1}>
                    {getFilterTitle()}
                  </Text>
                </View>

                <View style={styles.statsCardCountBadge}>
                  <Text style={styles.statsCardCountText}>
                    {filteredExpenses.length} khoản
                  </Text>
                </View>
              </View>

              <View style={styles.statsCardMainRow}>
                <View>
                  <Text style={styles.statsCardAmountLabel}>
                    {activeTab === 'pending'
                      ? 'TỔNG CẦN CHI'
                      : activeTab === 'executed'
                      ? 'TỔNG ĐÃ CHI'
                      : 'TỔNG GIÁ TRỊ'}
                  </Text>
                  <Text style={styles.statsCardAmountValue}>
                    {isBalanceHidden ? '•••••••• ₫' : formatVND(filteredTotalAmount)}
                  </Text>
                </View>

                {dateFilter !== 'all' && (
                  <Pressable
                    style={styles.statsResetFilterBtn}
                    onPress={() => {
                      hapticLight();
                      setDateFilter('all');
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }}
                  >
                    <Ionicons name="close-circle-outline" size={14} color="#4B5563" />
                    <Text style={styles.statsResetFilterBtnText}>Bỏ lọc ngày</Text>
                  </Pressable>
                )}
              </View>

              {activeTab === 'all' && filteredExpenses.length > 0 && (
                <View style={styles.statsCardBreakdownRow}>
                  <View style={[styles.statsBreakdownItem, { backgroundColor: '#FEE2E2', borderColor: '#DC2626' }]}>
                    <Text style={[styles.statsBreakdownLabel, { color: '#991B1B' }]}>Chờ chi</Text>
                    <Text style={[styles.statsBreakdownValue, { color: '#DC2626' }]}>
                      {isBalanceHidden ? '••••' : formatVND(filteredPendingAmount)} ({filteredPendingCount})
                    </Text>
                  </View>

                  <View style={[styles.statsBreakdownItem, { backgroundColor: '#DCFCE7', borderColor: '#16A34A' }]}>
                    <Text style={[styles.statsBreakdownLabel, { color: '#166534' }]}>Đã chi</Text>
                    <Text style={[styles.statsBreakdownValue, { color: '#16A34A' }]}>
                      {isBalanceHidden ? '••••' : formatVND(filteredExecutedAmount)} ({filteredExecutedCount})
                    </Text>
                  </View>
                </View>
              )}
            </View>
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
              const isSelected = selectedIds.has(item.id);

              return (
                <Pressable
                  key={item.id}
                  style={styles.itemCardShadow}
                  onPress={() => {
                    if (isSelectMode) {
                      toggleSelect(item.id);
                    }
                  }}
                  onLongPress={() => {
                    if (!isSelectMode) {
                      enterSelectModeWithItem(item.id);
                    }
                  }}
                  delayLongPress={250}
                >
                  <View
                    style={[
                      styles.itemCardInner,
                      isSelected && styles.itemCardInnerSelected,
                    ]}
                  >
                    {/* Item Top Row */}
                    <View style={styles.itemTopRow}>
                      <View style={styles.itemLeftGroup}>
                        {isSelectMode && (
                          <Pressable
                            style={[
                              styles.checkboxBox,
                              isSelected && styles.checkboxBoxSelected,
                            ]}
                            onPress={() => toggleSelect(item.id)}
                          >
                            {isSelected && (
                              <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                            )}
                          </Pressable>
                        )}
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
                          <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
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
                          {item.planned_type === 'credit_payment' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                              <View style={[styles.dateBadge, { backgroundColor: '#FEF9C3', borderColor: '#000000', borderWidth: 1, paddingVertical: 1, paddingHorizontal: 6 }]}>
                                <Ionicons name="card" size={10} color="#000000" />
                                <Text style={[styles.dateBadgeText, { color: '#000000', fontSize: 10, fontWeight: '800' }]}>
                                  Trả nợ thẻ {item.to_wallet_name ? `• ${item.to_wallet_name}` : ''}
                                </Text>
                              </View>
                              {item.installment_current && item.installment_total ? (
                                <View style={[styles.dateBadge, { backgroundColor: '#F3E8FF', borderColor: '#A855F7', borderWidth: 1, paddingVertical: 1, paddingHorizontal: 6 }]}>
                                  <Text style={[styles.dateBadgeText, { color: '#7E22CE', fontSize: 10, fontWeight: '800' }]}>
                                    Kỳ {item.installment_current}/{item.installment_total}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={styles.itemAmountCol}>
                        <Text style={styles.itemAmountText} numberOfLines={1} adjustsFontSizeToFit>
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

                      {!isSelectMode && (
                        <View style={styles.itemActionsGroup}>
                          {isPending && (
                            <Pressable
                              style={styles.executeBtnShadow}
                              onPress={() => handleOpenExecuteModal(item)}
                            >
                              <View style={styles.executeBtnInner}>
                                <Ionicons name="checkmark-sharp" size={16} color="#000000" />
                                <Text style={styles.executeBtnText}>
                                  {item.planned_type === 'credit_payment' ? 'Thanh toán' : 'Đã chi'}
                                </Text>
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
                      )}
                    </View>
                  </View>
                </Pressable>
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
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>SỐ TIỀN DỰ KIẾN *</Text>
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
                  <Text style={styles.executeTitleBadgeText}>
                    {executingItem?.planned_type === 'credit_payment' ? 'TRẢ NỢ THẺ' : 'HOÀN TẤT CHI'}
                  </Text>
                </View>
                <Text style={styles.formModalTitle}>
                  {executingItem?.planned_type === 'credit_payment' ? 'Thanh Toán Thẻ' : 'Xác Nhận Đã Chi'}
                </Text>
                <Pressable
                  style={styles.formModalCloseBtn}
                  onPress={() => setExecutingItem(null)}
                >
                  <Ionicons name="close" size={20} color="#000000" />
                </Pressable>
              </View>

              <Text style={styles.executePrompt}>
                {executingItem?.planned_type === 'credit_payment'
                  ? 'Hệ thống sẽ chuyển tiền từ ví đã chọn sang ví thẻ tín dụng để thanh toán dư nợ và hồi hạn mức.'
                  : 'Hệ thống sẽ ghi một khoản chi tiêu mới vào nhật ký và tự động trừ số dư ví đã chọn.'}
              </Text>

              {/* Tên khoản dự chi */}
              <View style={styles.executeInfoBox}>
                <Text style={styles.executeInfoTitle}>{executingItem?.title}</Text>
                <Text style={styles.executeInfoSub}>
                  Dự kiến: {isBalanceHidden ? '••••••' : formatVND(executingItem?.amount || 0)}
                </Text>
              </View>

              {/* Số tiền thực tế */}
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                {executingItem?.planned_type === 'credit_payment'
                  ? 'SỐ TIỀN THANH TOÁN THỰC TẾ (₫) *'
                  : 'SỐ TIỀN THỰC TẾ ĐÃ CHI (₫) *'}
              </Text>
              <TextInput
                style={[styles.inputField, styles.amountInputField]}
                value={actualAmountInput}
                onChangeText={setActualAmountInput}
                keyboardType="numeric"
              />

              {/* Chọn ví thanh toán */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                {executingItem?.planned_type === 'credit_payment'
                  ? 'TRÍCH TIỀN TỪ VÍ NÀO ĐỂ TRẢ NỢ? *'
                  : 'TRỪ TỪ VÍ NÀO? *'}
              </Text>
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

        {/* Floating Batch Actions Bottom Bar */}
        {isSelectMode && selectedIds.size > 0 && (
          <View style={styles.batchBarFloatingWrapper}>
            <View style={styles.batchBarShadow}>
              <View style={styles.batchBarInner}>
                <View style={styles.batchBarLeft}>
                  <Text style={styles.batchBarCount}>
                    Đã chọn {selectedIds.size} khoản
                  </Text>
                  <Text style={styles.batchBarTotal}>
                    Tổng: {isBalanceHidden ? '••••••' : formatVND(totalSelectedAmount)}
                  </Text>
                </View>

                <View style={styles.batchBarRight}>
                  <Pressable
                    style={styles.batchDeleteBtn}
                    onPress={handleBatchDelete}
                  >
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <Text style={styles.batchDeleteBtnText}>Xóa</Text>
                  </Pressable>

                  {selectedPendingItems.length > 0 && (
                    <Pressable
                      style={styles.batchExecuteBtnShadow}
                      onPress={handleOpenBatchExecuteModal}
                    >
                      <View style={styles.batchExecuteBtnInner}>
                        <Ionicons name="checkmark-circle" size={16} color="#000000" />
                        <Text style={styles.batchExecuteBtnText}>
                          Đã chi ({selectedPendingItems.length})
                        </Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Modal Xác nhận "Đã chi hàng loạt" */}
        <Modal
          visible={batchExecuteModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setBatchExecuteModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.executeModalBox}>
              <View style={styles.formModalHeader}>
                <View style={styles.executeTitleBadge}>
                  <Text style={styles.executeTitleBadgeText}>HÀNG LOẠT</Text>
                </View>
                <Text style={styles.formModalTitle}>Xác Nhận Đã Chi Hàng Loạt</Text>
                <Pressable
                  style={styles.formModalCloseBtn}
                  onPress={() => setBatchExecuteModalVisible(false)}
                >
                  <Ionicons name="close" size={20} color="#000000" />
                </Pressable>
              </View>

              <Text style={styles.executePrompt}>
                Hệ thống sẽ ghi nhận chi tiêu/thanh toán cho {selectedPendingItems.length} khoản dự chi đang chọn và cập nhật số dư ví tương ứng.
              </Text>

              {/* Tóm tắt danh sách */}
              <View style={styles.executeInfoBox}>
                <Text style={styles.executeInfoTitle}>
                  {selectedPendingItems.length} khoản dự chi
                </Text>
                <Text style={styles.executeInfoSub}>
                  Tổng số tiền: {isBalanceHidden ? '••••••' : formatVND(totalPendingSelectedAmount)}
                </Text>
                <ScrollView style={{ maxHeight: 110, marginTop: 8 }} showsVerticalScrollIndicator={false}>
                  {selectedPendingItems.map(p => (
                    <View key={p.id} style={styles.batchItemSummaryRow}>
                      <Text style={styles.batchItemSummaryTitle} numberOfLines={1}>
                        • {p.title}
                      </Text>
                      <Text style={styles.batchItemSummaryAmount}>
                        {isBalanceHidden ? '••••••' : formatVND(p.amount)}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>

              {/* Chọn ví trừ tiền */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                NGUỒN TIỀN THANH TOÁN *
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.walletPickerScroll}>
                <Pressable
                  style={[
                    styles.walletChip,
                    batchExecuteWalletId === 'auto' && styles.walletChipActive,
                  ]}
                  onPress={() => {
                    hapticLight();
                    setBatchExecuteWalletId('auto');
                  }}
                >
                  <Text style={[styles.walletChipText, batchExecuteWalletId === 'auto' && styles.walletChipTextActive]}>
                    ⚡ Ví theo từng khoản (Mặc định)
                  </Text>
                </Pressable>

                {wallets.map(w => {
                  const isSelected = batchExecuteWalletId === w.id;
                  return (
                    <Pressable
                      key={w.id}
                      style={[
                        styles.walletChip,
                        isSelected && styles.walletChipActive,
                      ]}
                      onPress={() => {
                        hapticLight();
                        setBatchExecuteWalletId(w.id);
                      }}
                    >
                      <Text style={[styles.walletChipText, isSelected && styles.walletChipTextActive]}>
                        {w.name} {isBalanceHidden ? '' : `(${formatVND(w.balance)})`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Ghi chú chung */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>GHI CHÚ CHUNG (TÙY CHỌN)</Text>
              <TextInput
                style={styles.inputField}
                value={batchExecuteNote}
                onChangeText={setBatchExecuteNote}
                placeholder="Ghi chú chung cho đợt thanh toán..."
                placeholderTextColor="#9CA3AF"
              />

              <View style={styles.executeBtnRow}>
                <Pressable
                  style={styles.executeCancelBtn}
                  onPress={() => setBatchExecuteModalVisible(false)}
                >
                  <Text style={styles.executeCancelText}>Hủy</Text>
                </Pressable>

                <Pressable
                  style={styles.confirmExecuteBtnShadow}
                  onPress={handleConfirmBatchExecute}
                >
                  <View style={styles.confirmExecuteBtnInner}>
                    <Ionicons name="checkmark-circle" size={18} color="#000000" />
                    <Text style={styles.confirmExecuteBtnText}>
                      Xác nhận ({selectedPendingItems.length} khoản)
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Chọn Khoảng Ngày Bằng Lịch Trực Quan */}
        <Modal
          visible={datePickerModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setDatePickerModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.calendarModalBox}>
              {/* Header */}
              <View style={styles.formModalHeader}>
                <View style={styles.executeTitleBadge}>
                  <Text style={styles.executeTitleBadgeText}>LỊCH THỜI GIAN</Text>
                </View>
                <Text style={styles.formModalTitle}>Chọn Khoảng Ngày</Text>
                <Pressable
                  style={styles.formModalCloseBtn}
                  onPress={() => setDatePickerModalVisible(false)}
                >
                  <Ionicons name="close" size={20} color="#000000" />
                </Pressable>
              </View>

              {/* Range Preview Row */}
              <View style={styles.rangePreviewRow}>
                <View style={[styles.rangePreviewCol, tempStartDate ? styles.rangePreviewColActive : null]}>
                  <Text style={styles.rangePreviewLabel}>TỪ NGÀY</Text>
                  <Text style={styles.rangePreviewDate}>
                    {tempStartDate ? dayjs(tempStartDate).format('DD/MM/YYYY') : 'Chạm chọn ngày'}
                  </Text>
                </View>

                <Ionicons name="arrow-forward" size={16} color="#6B7280" />

                <View style={[styles.rangePreviewCol, tempEndDate ? styles.rangePreviewColActive : null]}>
                  <Text style={styles.rangePreviewLabel}>ĐẾN NGÀY</Text>
                  <Text style={styles.rangePreviewDate}>
                    {tempEndDate
                      ? dayjs(tempEndDate).format('DD/MM/YYYY')
                      : tempStartDate
                      ? dayjs(tempStartDate).format('DD/MM/YYYY')
                      : 'Chạm chọn ngày'}
                  </Text>
                </View>
              </View>

              {/* Quick Preset Chips */}
              <View style={styles.calendarQuickPresets}>
                {[
                  {
                    label: 'Hôm nay',
                    action: () => {
                      setTempStartDate(todayStr);
                      setTempEndDate(todayStr);
                      setPickerMonth(new Date());
                    },
                  },
                  {
                    label: '7 ngày tới',
                    action: () => {
                      setTempStartDate(todayStr);
                      setTempEndDate(dayjs().add(7, 'day').format('YYYY-MM-DD'));
                      setPickerMonth(new Date());
                    },
                  },
                  {
                    label: 'Tháng này',
                    action: () => {
                      setTempStartDate(startOfThisMonth);
                      setTempEndDate(endOfThisMonth);
                      setPickerMonth(new Date());
                    },
                  },
                  {
                    label: 'Tháng sau',
                    action: () => {
                      setTempStartDate(startOfNextMonth);
                      setTempEndDate(endOfNextMonth);
                      setPickerMonth(dayjs().add(1, 'month').toDate());
                    },
                  },
                  {
                    label: '30 ngày tới',
                    action: () => {
                      setTempStartDate(todayStr);
                      setTempEndDate(dayjs().add(30, 'day').format('YYYY-MM-DD'));
                      setPickerMonth(new Date());
                    },
                  },
                ].map((item, idx) => (
                  <Pressable
                    key={idx}
                    style={styles.calendarQuickPresetBtn}
                    onPress={() => {
                      hapticLight();
                      item.action();
                    }}
                  >
                    <Text style={styles.calendarQuickPresetText}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Calendar Month Navigation */}
              <View style={styles.monthNavRow}>
                <Pressable
                  style={styles.monthNavBtn}
                  onPress={() => {
                    hapticLight();
                    setPickerMonth(prev => dayjs(prev).subtract(1, 'month').toDate());
                  }}
                >
                  <Ionicons name="chevron-back" size={18} color="#000000" />
                </Pressable>
                <Text style={styles.monthNavTitle}>
                  Tháng {dayjs(pickerMonth).format('M, YYYY')}
                </Text>
                <Pressable
                  style={styles.monthNavBtn}
                  onPress={() => {
                    hapticLight();
                    setPickerMonth(prev => dayjs(prev).add(1, 'month').toDate());
                  }}
                >
                  <Ionicons name="chevron-forward" size={18} color="#000000" />
                </Pressable>
              </View>

              {/* Weekday Header */}
              <View style={styles.weekHeaderRow}>
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((w, idx) => (
                  <Text
                    key={idx}
                    style={[
                      styles.weekHeaderText,
                      idx === 6 && { color: '#E11D48' },
                    ]}
                  >
                    {w}
                  </Text>
                ))}
              </View>

              {/* Days Grid */}
              <View style={styles.daysGrid}>
                {getCalendarDays(pickerMonth).map((slot, idx) => {
                  if (slot.dayNum === null) {
                    return <View key={idx} style={styles.dayCellEmpty} />;
                  }
                  const cellDate = dayjs(pickerMonth).date(slot.dayNum);
                  const cellDateStr = cellDate.format('YYYY-MM-DD');

                  const isStart = tempStartDate === cellDateStr;
                  const isEnd = tempEndDate === cellDateStr;
                  const isInRange =
                    tempStartDate &&
                    tempEndDate &&
                    cellDateStr > tempStartDate &&
                    cellDateStr < tempEndDate;
                  const isToday = cellDateStr === todayStr;

                  return (
                    <Pressable
                      key={idx}
                      style={[
                        styles.dayCell,
                        isInRange && styles.dayCellInRange,
                        (isStart || isEnd) && styles.dayCellSelected,
                        isToday && !isStart && !isEnd && styles.dayCellToday,
                      ]}
                      onPress={() => {
                        hapticLight();
                        if (!tempStartDate || (tempStartDate && tempEndDate)) {
                          setTempStartDate(cellDateStr);
                          setTempEndDate(null);
                        } else {
                          if (cellDateStr < tempStartDate) {
                            setTempStartDate(cellDateStr);
                            setTempEndDate(tempStartDate);
                          } else {
                            setTempEndDate(cellDateStr);
                          }
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.dayCellText,
                          (isStart || isEnd) && styles.dayCellTextSelected,
                          isInRange && styles.dayCellTextInRange,
                          isToday && !isStart && !isEnd && styles.dayCellTextToday,
                        ]}
                      >
                        {slot.dayNum}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Action Buttons */}
              <View style={styles.calendarModalActionsRow}>
                <Pressable
                  style={styles.calendarClearBtn}
                  onPress={() => {
                    hapticLight();
                    setCustomStartDate('');
                    setCustomEndDate('');
                    setDateFilter('all');
                    setDatePickerModalVisible(false);
                  }}
                >
                  <Text style={styles.calendarClearText}>Bỏ lọc</Text>
                </Pressable>

                <Pressable
                  style={styles.calendarApplyBtnShadow}
                  onPress={() => {
                    hapticMedium();
                    if (!tempStartDate) {
                      setCustomStartDate('');
                      setCustomEndDate('');
                      setDateFilter('all');
                    } else {
                      const finalStart = tempStartDate;
                      const finalEnd = tempEndDate || tempStartDate;
                      setCustomStartDate(finalStart <= finalEnd ? finalStart : finalEnd);
                      setCustomEndDate(finalStart <= finalEnd ? finalEnd : finalStart);
                      setDateFilter('custom');
                    }
                    setDatePickerModalVisible(false);
                  }}
                >
                  <View style={styles.calendarApplyBtnInner}>
                    <Ionicons name="checkmark" size={16} color="#000000" />
                    <Text style={styles.calendarApplyBtnText}>Áp dụng</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {AlertModalComponent}
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
    flex: 1,
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
  breakdownNoteText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
    marginTop: 8,
    lineHeight: 14,
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
  itemCardInnerSelected: {
    backgroundColor: '#FEF9C3',
    borderColor: '#000000',
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },
  checkboxBoxSelected: {
    backgroundColor: '#000000',
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
    marginRight: 8,
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
    alignItems: 'flex-end',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1.5,
    borderTopColor: '#F3F4F6',
  },
  itemDateGroup: {
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    marginRight: 8,
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

  // Header selection styles
  selectToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  selectToggleBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  selectionHeaderRow: {
    backgroundColor: '#FEF9C3',
  },
  selectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  selectionCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
  },
  selectionSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  selectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectAllBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
  },
  selectAllBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },

  // Floating Batch Actions Bottom Bar
  batchBarFloatingWrapper: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  batchBarShadow: {
    backgroundColor: '#000000',
    borderRadius: 16,
  },
  batchBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  batchBarLeft: {
    flex: 1,
    marginRight: 8,
  },
  batchBarCount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  batchBarTotal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    marginTop: 2,
  },
  batchBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  batchDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  batchDeleteBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#DC2626',
  },
  batchExecuteBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  batchExecuteBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.primary,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 7,
    transform: [{ translateX: -1.5 }, { translateY: -1.5 }],
  },
  batchExecuteBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  batchItemSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  batchItemSummaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    flex: 1,
    marginRight: 8,
  },
  batchItemSummaryAmount: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },

  // Date Filter Pills
  dateFilterScroll: {
    marginBottom: 12,
  },
  dateFilterContent: {
    gap: 8,
  },
  dateFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  dateFilterPillActive: {
    borderColor: '#000000',
    backgroundColor: THEME.popYellow,
    borderWidth: 2,
  },
  dateFilterPillAlert: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  dateFilterPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4B5563',
  },
  dateFilterPillTextActive: {
    color: '#000000',
  },
  dateFilterPillTextAlert: {
    color: '#DC2626',
  },

  headerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 2,
  },

  // Card Thống Kê Bộ Lọc
  statsCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 14,
    marginBottom: 14,
  },
  statsCardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 12,
    transform: [{ translateX: -2.5 }, { translateY: -2.5 }],
  },
  statsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 6,
  },
  statsCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  statsCardIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: THEME.popYellow,
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsCardTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    flex: 1,
  },
  statsCardCountBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  statsCardCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  statsCardMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statsCardAmountLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  statsCardAmountValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
    marginTop: 2,
  },
  statsResetFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  statsResetFilterBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4B5563',
  },
  statsCardBreakdownRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statsBreakdownItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  statsBreakdownLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  statsBreakdownValue: {
    fontSize: 11,
    fontWeight: '900',
  },

  // Interactive Calendar Modal Styles
  calendarModalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#000000',
    padding: 16,
    width: '92%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  rangePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#000000',
    padding: 10,
    marginBottom: 10,
  },
  rangePreviewCol: {
    flex: 1,
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  rangePreviewColActive: {
    borderColor: '#000000',
    backgroundColor: '#FEF9C3',
  },
  rangePreviewLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#6B7280',
    marginBottom: 2,
  },
  rangePreviewDate: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  calendarQuickPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  calendarQuickPresetBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  calendarQuickPresetText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 6,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthNavTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
  weekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  weekHeaderText: {
    width: 38,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: '#4B5563',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  dayCell: {
    width: 38,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 8,
  },
  dayCellEmpty: {
    width: 38,
    height: 34,
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: '#000000',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  dayCellInRange: {
    backgroundColor: '#FEF08A',
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  dayCellText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  dayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  dayCellTextInRange: {
    color: '#000000',
    fontWeight: '800',
  },
  dayCellTextToday: {
    fontWeight: '900',
  },
  calendarModalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    alignItems: 'center',
  },
  calendarClearBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarClearText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  calendarApplyBtnShadow: {
    flex: 2,
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  calendarApplyBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.primary,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 10,
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  calendarApplyBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
});
