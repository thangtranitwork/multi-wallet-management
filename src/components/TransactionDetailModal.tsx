import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useWallet } from '../context/WalletContext';
import { Transaction, Category, Wallet } from '../types';
import { THEME, formatVND } from '../constants';
import { hapticLight, hapticSuccess, hapticError } from '../utils/haptics';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { useCustomAlert } from './CustomAlertModal';

interface TransactionDetailModalProps {
  visible: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onSplit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
  onRecreate?: (tx: Transaction) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  visible,
  onClose,
  transaction,
  onSplit,
  onDelete,
  onRecreate,
}) => {
  const {
    wallets,
    categories,
    updateTransactionCategory,
    updateTransactionWallet,
    updateTransactionTime,
    removeTransaction,
    isBalanceHidden,
  } = useWallet();
  const { showAlert, showConfirm, AlertModalComponent } = useCustomAlert(false);

  const [isChangingCategory, setIsChangingCategory] = useState(false);
  const [isChangingWallet, setIsChangingWallet] = useState(false);
  const [transferWalletTarget, setTransferWalletTarget] = useState<'source' | 'destination'>('source');
  const [isChangingTime, setIsChangingTime] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [pickerMonth, setPickerMonth] = useState<Date>(new Date());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (transaction) {
      const parsed = dayjs(transaction.transacted_at);
      const initialDate = parsed.isValid() ? parsed.toDate() : new Date();
      setSelectedDate(initialDate);
      setPickerMonth(initialDate);
    }
    setIsChangingCategory(false);
    setIsChangingWallet(false);
    setIsChangingTime(false);
    setShowDeleteConfirm(false);
  }, [transaction?.id, visible]);

  if (!transaction) return null;

  const isIncome =
    transaction.type === 'income' ||
    transaction.type === 'debt_collect' ||
    transaction.type === 'debt_borrow';

  const isExpense =
    transaction.type === 'expense' ||
    transaction.type === 'debt_lend' ||
    transaction.type === 'debt_repay';

  const isTransfer = transaction.type === 'transfer';
  const isDebt = transaction.type.startsWith('debt_');

  // Category change is eligible for expense & income transactions
  const canChangeCategory = transaction.type === 'expense' || transaction.type === 'income';
  const availableCategories = categories.filter(
    c => c.type === (transaction.type === 'income' ? 'income' : 'expense')
  );

  let typeLabel = 'Giao dịch';
  let typeBadgeBg = '#E5E7EB';
  let typeColor = '#000000';
  let typeIcon: any = 'receipt-outline';

  if (transaction.type === 'expense') {
    typeLabel = 'Khoản chi tiêu';
    typeBadgeBg = '#FFE4E6';
    typeColor = '#E11D48';
    typeIcon = 'arrow-down-circle';
  } else if (transaction.type === 'income') {
    typeLabel = 'Khoản thu nhập';
    typeBadgeBg = '#DCFCE7';
    typeColor = '#15803D';
    typeIcon = 'arrow-up-circle';
  } else if (transaction.type === 'transfer') {
    typeLabel = 'Chuyển tiền nội bộ';
    typeBadgeBg = '#E0F2FE';
    typeColor = '#0284C7';
    typeIcon = 'swap-horizontal';
  } else if (transaction.type === 'debt_lend') {
    typeLabel = 'Cho vay (Sổ nợ)';
    typeBadgeBg = '#FEF08A';
    typeColor = '#854D0E';
    typeIcon = 'send';
  } else if (transaction.type === 'debt_borrow') {
    typeLabel = 'Đi vay (Sổ nợ)';
    typeBadgeBg = '#FEF9C3';
    typeColor = '#A16207';
    typeIcon = 'download';
  } else if (transaction.type === 'debt_collect') {
    typeLabel = 'Thu hồi nợ (Sổ nợ)';
    typeBadgeBg = '#DCFCE7';
    typeColor = '#15803D';
    typeIcon = 'checkmark-circle';
  } else if (transaction.type === 'debt_repay') {
    typeLabel = 'Trả nợ vay (Sổ nợ)';
    typeBadgeBg = '#FCE7F3';
    typeColor = '#9D174D';
    typeIcon = 'refresh-circle';
  }

  // --- Category Change ---
  const handleSelectCategory = async (cat: Category) => {
    if (isUpdating) return;
    hapticLight();
    setIsUpdating(true);
    try {
      await updateTransactionCategory(transaction.id, cat.id);
      hapticSuccess();
      setIsChangingCategory(false);
    } catch (err: any) {
      hapticError();
      showAlert('Lỗi', err?.message || 'Không thể cập nhật danh mục');
    } finally {
      setIsUpdating(false);
    }
  };

  // --- Wallet Change ---
  const handleSelectWallet = (w: Wallet) => {
    if (isUpdating) return;
    hapticLight();

    if (isTransfer) {
      if (transferWalletTarget === 'source') {
        if (w.id === transaction.to_wallet_id) {
          hapticError();
          showAlert('Không hợp lệ', 'Ví gửi không thể trùng với ví nhận');
          return;
        }
      } else {
        if (w.id === transaction.wallet_id) {
          hapticError();
          showAlert('Không hợp lệ', 'Ví nhận không thể trùng với ví gửi');
          return;
        }
      }
    }

    const targetLabel = isTransfer
      ? transferWalletTarget === 'source'
        ? 'ví gửi'
        : 'ví nhận'
      : 'nguồn tiền (ví)';

    showConfirm(
      'Đổi nguồn tiền',
      `Ngài có muốn đổi ${targetLabel} sang "${w.name}"? Số dư các ví sẽ được tự động điều chỉnh.`,
      async () => {
        setIsUpdating(true);
        try {
          if (isTransfer && transferWalletTarget === 'destination') {
            await updateTransactionWallet(transaction.id, transaction.wallet_id, w.id);
          } else {
            await updateTransactionWallet(transaction.id, w.id, transaction.to_wallet_id);
          }
          hapticSuccess();
          setIsChangingWallet(false);
        } catch (err: any) {
          hapticError();
          showAlert('Lỗi', err?.message || 'Không thể cập nhật nguồn tiền');
        } finally {
          setIsUpdating(false);
        }
      },
      { confirmText: 'Đồng ý', cancelText: 'Hủy' }
    );
  };

  // --- Date & Time Controls ---
  const getFormattedDateLabel = (date: Date) => {
    const d = dayjs(date);
    const now = dayjs();
    const timeStr = d.format('HH:mm');
    if (d.isSame(now, 'day')) {
      return `Hôm nay • ${timeStr}`;
    }
    if (d.isSame(now.subtract(1, 'day'), 'day')) {
      return `Hôm qua • ${timeStr}`;
    }
    if (d.isSame(now.subtract(2, 'day'), 'day')) {
      return `2 ngày trước • ${timeStr}`;
    }
    return `${d.format('DD/MM/YYYY')} • ${timeStr}`;
  };

  const isSelectedToday = dayjs(selectedDate).isSame(dayjs(), 'day');
  const isSelectedYesterday = dayjs(selectedDate).isSame(dayjs().subtract(1, 'day'), 'day');
  const isSelectedTwoDaysAgo = dayjs(selectedDate).isSame(dayjs().subtract(2, 'day'), 'day');

  const setToday = () => {
    const now = new Date();
    setSelectedDate(prev => {
      const next = new Date(now);
      next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
      return next;
    });
    setPickerMonth(new Date());
  };

  const setYesterday = () => {
    const y = dayjs().subtract(1, 'day').toDate();
    setSelectedDate(prev => {
      const next = new Date(y);
      next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
      return next;
    });
    setPickerMonth(y);
  };

  const setTwoDaysAgo = () => {
    const d = dayjs().subtract(2, 'day').toDate();
    setSelectedDate(prev => {
      const next = new Date(d);
      next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
      return next;
    });
    setPickerMonth(d);
  };

  const selectDay = (dayNum: number) => {
    const d = dayjs(pickerMonth).date(dayNum).toDate();
    setSelectedDate(prev => {
      const next = new Date(d);
      next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
      return next;
    });
  };

  const adjustHour = (delta: number) => {
    setSelectedDate(prev => {
      const next = new Date(prev);
      let h = (next.getHours() + delta) % 24;
      if (h < 0) h += 24;
      next.setHours(h);
      return next;
    });
  };

  const adjustMinute = (delta: number) => {
    setSelectedDate(prev => {
      const next = new Date(prev);
      let m = (next.getMinutes() + delta) % 60;
      if (m < 0) m += 60;
      next.setMinutes(m);
      return next;
    });
  };

  const setPresetTime = (hour: number, minute: number) => {
    setSelectedDate(prev => {
      const next = new Date(prev);
      next.setHours(hour, minute, 0, 0);
      return next;
    });
  };

  const setNowTime = () => {
    const now = new Date();
    setSelectedDate(prev => {
      const next = new Date(prev);
      next.setHours(now.getHours(), now.getMinutes(), 0, 0);
      return next;
    });
  };

  const getCalendarDays = () => {
    const startOfMonth = dayjs(pickerMonth).startOf('month');
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

  const handleSaveTime = async () => {
    if (isUpdating) return;
    hapticLight();
    setIsUpdating(true);
    try {
      await updateTransactionTime(transaction.id, selectedDate.toISOString());
      hapticSuccess();
      setIsChangingTime(false);
    } catch (err: any) {
      hapticError();
      showAlert('Lỗi', err?.message || 'Không thể cập nhật thời gian giao dịch');
    } finally {
      setIsUpdating(false);
    }
  };



  const txDate = dayjs(transaction.transacted_at);
  const formattedDate = txDate.format('dddd, DD/MM/YYYY');
  const formattedTime = txDate.format('HH:mm');

  const currentWallet = wallets.find(w => w.id === transaction.wallet_id);
  const currentToWallet = transaction.to_wallet_id
    ? wallets.find(w => w.id === transaction.to_wallet_id)
    : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.titleBadge}>
                <Ionicons name="receipt-outline" size={16} color="#000000" />
                <Text style={styles.headerTitle}>Chi Tiết Giao Dịch</Text>
              </View>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={THEME.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Amount & Type Hero Card */}
            <View style={styles.heroCard}>
              <View style={[styles.typeBadge, { backgroundColor: typeBadgeBg }]}>
                <Ionicons name={typeIcon} size={14} color={typeColor} />
                <Text style={[styles.typeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
              </View>

              <Text
                style={[
                  styles.heroAmount,
                  isIncome && styles.incomeColor,
                  isExpense && styles.expenseColor,
                  isTransfer && styles.transferColor,
                ]}
              >
                {isBalanceHidden
                  ? '••••••'
                  : `${isIncome ? '+' : isExpense ? '-' : ''}${formatVND(transaction.amount)}`}
              </Text>

              <Text style={styles.heroSubDate}>
                {formattedDate} lúc {formattedTime}
              </Text>
            </View>

            {/* Wallet Section with Change Wallet Feature */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleGroup}>
                  <Ionicons name="wallet-outline" size={18} color="#000000" />
                  <Text style={styles.sectionTitle}>
                    {isTransfer ? 'Nguồn tiền (Ví chuyển / nhận)' : 'Nguồn tiền (Ví)'}
                  </Text>
                </View>
                <Pressable
                  style={styles.actionToggleBtn}
                  onPress={() => {
                    hapticLight();
                    setIsChangingWallet(!isChangingWallet);
                  }}
                >
                  <Ionicons
                    name={isChangingWallet ? 'chevron-up' : 'create-outline'}
                    size={15}
                    color="#000000"
                  />
                  <Text style={styles.actionToggleText}>
                    {isChangingWallet ? 'Thu gọn' : 'Đổi ví'}
                  </Text>
                </Pressable>
              </View>

              {/* Current Wallet Info */}
              <View style={styles.walletDisplayBox}>
                <View style={styles.walletItemRow}>
                  <View style={[styles.walletDot, { backgroundColor: currentWallet?.color || THEME.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.walletRoleLabel}>
                      {isTransfer ? 'Ví gửi (Trừ tiền):' : 'Ví giao dịch:'}
                    </Text>
                    <Text style={styles.walletNameText}>
                      {transaction.wallet_name || 'Ví không xác định'}
                    </Text>
                  </View>
                  <Text style={styles.walletBalanceBadge}>
                    {isBalanceHidden ? '••••••' : formatVND(currentWallet?.balance || 0)}
                  </Text>
                </View>

                {isTransfer && (
                  <View style={[styles.walletItemRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' }]}>
                    <View style={[styles.walletDot, { backgroundColor: currentToWallet?.color || '#0284C7' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.walletRoleLabel}>Ví nhận (Cộng tiền):</Text>
                      <Text style={styles.walletNameText}>
                        {transaction.to_wallet_name || 'Ví không xác định'}
                      </Text>
                    </View>
                    <Text style={[styles.walletBalanceBadge, { color: '#0284C7' }]}>
                      {isBalanceHidden ? '••••••' : formatVND(currentToWallet?.balance || 0)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Wallet Picker List */}
              {isChangingWallet && (
                <View style={styles.pickerContainer}>
                  {isTransfer && (
                    <View style={styles.transferTargetTabs}>
                      <Pressable
                        style={[
                          styles.transferTargetTab,
                          transferWalletTarget === 'source' && styles.transferTargetTabActive,
                        ]}
                        onPress={() => setTransferWalletTarget('source')}
                      >
                        <Text
                          style={[
                            styles.transferTargetTabText,
                            transferWalletTarget === 'source' && styles.transferTargetTabTextActive,
                          ]}
                        >
                          Đổi ví gửi
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.transferTargetTab,
                          transferWalletTarget === 'destination' && styles.transferTargetTabActive,
                        ]}
                        onPress={() => setTransferWalletTarget('destination')}
                      >
                        <Text
                          style={[
                            styles.transferTargetTabText,
                            transferWalletTarget === 'destination' && styles.transferTargetTabTextActive,
                          ]}
                        >
                          Đổi ví nhận
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  <Text style={styles.pickerLabel}>
                    {isTransfer
                      ? transferWalletTarget === 'source'
                        ? 'Chọn ví gửi mới:'
                        : 'Chọn ví nhận mới:'
                      : 'Chọn nguồn tiền mới để chuyển sang:'}
                  </Text>

                  <View style={styles.walletsGrid}>
                    {wallets.map(w => {
                      const isSelected = isTransfer
                        ? transferWalletTarget === 'source'
                          ? transaction.wallet_id === w.id
                          : transaction.to_wallet_id === w.id
                        : transaction.wallet_id === w.id;

                      const isOtherTransferWallet = isTransfer && (
                        transferWalletTarget === 'source'
                          ? transaction.to_wallet_id === w.id
                          : transaction.wallet_id === w.id
                      );

                      return (
                        <Pressable
                          key={w.id}
                          style={[
                            styles.walletChip,
                            isSelected && styles.walletChipSelected,
                            isOtherTransferWallet && styles.walletChipDisabled,
                          ]}
                          onPress={() => handleSelectWallet(w)}
                          disabled={isUpdating || isSelected || isOtherTransferWallet}
                        >
                          <View style={[styles.walletChipIconBox, { backgroundColor: w.color || THEME.primary }]}>
                            <Ionicons name={(w.icon as any) || 'wallet-outline'} size={16} color="#000000" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.walletChipName, isSelected && styles.walletChipNameSelected]} numberOfLines={1}>
                              {w.name}
                            </Text>
                            <Text style={styles.walletChipSub}>
                              {isBalanceHidden ? '••••••' : formatVND(w.balance)}
                            </Text>
                          </View>
                          {isSelected ? (
                            <Ionicons name="checkmark-circle" size={18} color="#000000" />
                          ) : isOtherTransferWallet ? (
                            <Text style={styles.disabledChipTag}>Đang dùng</Text>
                          ) : (
                            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {/* Time Section with Change Time Feature */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleGroup}>
                  <Ionicons name="time-outline" size={18} color="#000000" />
                  <Text style={styles.sectionTitle}>Thời gian ghi nhận</Text>
                </View>
                <Pressable
                  style={styles.actionToggleBtn}
                  onPress={() => {
                    hapticLight();
                    if (!isChangingTime) {
                      const d = dayjs(transaction.transacted_at).toDate();
                      setSelectedDate(d);
                      setPickerMonth(d);
                    }
                    setIsChangingTime(!isChangingTime);
                  }}
                >
                  <Ionicons
                    name={isChangingTime ? 'chevron-up' : 'calendar-outline'}
                    size={15}
                    color="#000000"
                  />
                  <Text style={styles.actionToggleText}>
                    {isChangingTime ? 'Thu gọn' : 'Đổi ngày/giờ'}
                  </Text>
                </Pressable>
              </View>

              {/* Current Date Display */}
              <View style={styles.timeDisplayBanner}>
                <View style={styles.timeIconBox}>
                  <Ionicons name="calendar" size={18} color="#000000" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timeMainText}>{getFormattedDateLabel(selectedDate)}</Text>
                  <Text style={styles.timeSubText}>
                    {dayjs(selectedDate).format('DD/MM/YYYY - HH:mm')}
                  </Text>
                </View>
              </View>

              {/* Expandable Time Picker */}
              {isChangingTime && (
                <View style={styles.pickerContainer}>
                  {/* Quick Date Chips */}
                  <View style={styles.quickDateChipsRow}>
                    <Pressable
                      style={[styles.quickChip, isSelectedToday && styles.quickChipActive]}
                      onPress={setToday}
                    >
                      <Text style={[styles.quickChipText, isSelectedToday && styles.quickChipTextActive]}>
                        Hôm nay
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.quickChip, isSelectedYesterday && styles.quickChipActive]}
                      onPress={setYesterday}
                    >
                      <Text style={[styles.quickChipText, isSelectedYesterday && styles.quickChipTextActive]}>
                        Hôm qua
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.quickChip, isSelectedTwoDaysAgo && styles.quickChipActive]}
                      onPress={setTwoDaysAgo}
                    >
                      <Text style={[styles.quickChipText, isSelectedTwoDaysAgo && styles.quickChipTextActive]}>
                        2 ngày trước
                      </Text>
                    </Pressable>
                  </View>

                  {/* Calendar Month Navigation */}
                  <View style={styles.monthNavRow}>
                    <Pressable
                      style={styles.monthNavBtn}
                      onPress={() => setPickerMonth(prev => dayjs(prev).subtract(1, 'month').toDate())}
                    >
                      <Ionicons name="chevron-back" size={16} color="#000000" />
                    </Pressable>
                    <Text style={styles.monthNavTitle}>
                      Tháng {dayjs(pickerMonth).format('M, YYYY')}
                    </Text>
                    <Pressable
                      style={styles.monthNavBtn}
                      onPress={() => setPickerMonth(prev => dayjs(prev).add(1, 'month').toDate())}
                    >
                      <Ionicons name="chevron-forward" size={16} color="#000000" />
                    </Pressable>
                  </View>

                  {/* Weekday Labels */}
                  <View style={styles.weekHeaderRow}>
                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((w, idx) => (
                      <Text
                        key={idx}
                        style={[styles.weekHeaderText, idx === 6 && { color: '#E11D48' }]}
                      >
                        {w}
                      </Text>
                    ))}
                  </View>

                  {/* Days Grid */}
                  <View style={styles.daysGrid}>
                    {getCalendarDays().map((slot, idx) => {
                      if (slot.dayNum === null) {
                        return <View key={idx} style={styles.dayCellEmpty} />;
                      }
                      const cellDate = dayjs(pickerMonth).date(slot.dayNum);
                      const isSelected = dayjs(selectedDate).isSame(cellDate, 'day');
                      const isToday = cellDate.isSame(dayjs(), 'day');

                      return (
                        <Pressable
                          key={idx}
                          style={[
                            styles.dayCell,
                            isSelected && styles.dayCellSelected,
                            isToday && !isSelected && styles.dayCellToday,
                          ]}
                          onPress={() => selectDay(slot.dayNum!)}
                        >
                          <Text
                            style={[
                              styles.dayCellText,
                              isSelected && styles.dayCellTextSelected,
                              isToday && !isSelected && styles.dayCellTextToday,
                            ]}
                          >
                            {slot.dayNum}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Time Presets */}
                  <Text style={styles.timeSectionLabel}>Khung giờ thông dụng:</Text>
                  <View style={styles.timePresetsRow}>
                    <Pressable style={styles.timePresetChip} onPress={() => setPresetTime(8, 0)}>
                      <Text style={styles.timePresetText}>08:00</Text>
                    </Pressable>
                    <Pressable style={styles.timePresetChip} onPress={() => setPresetTime(12, 30)}>
                      <Text style={styles.timePresetText}>12:30</Text>
                    </Pressable>
                    <Pressable style={styles.timePresetChip} onPress={() => setPresetTime(18, 0)}>
                      <Text style={styles.timePresetText}>18:00</Text>
                    </Pressable>
                    <Pressable style={styles.timePresetChip} onPress={() => setPresetTime(20, 30)}>
                      <Text style={styles.timePresetText}>20:30</Text>
                    </Pressable>
                    <Pressable style={[styles.timePresetChip, { backgroundColor: THEME.popYellow }]} onPress={setNowTime}>
                      <Text style={styles.timePresetText}>Bây giờ</Text>
                    </Pressable>
                  </View>

                  {/* Hour & Minute Steppers */}
                  <View style={styles.stepperContainer}>
                    <View style={styles.stepperBox}>
                      <Text style={styles.stepperLabel}>GIỜ</Text>
                      <View style={styles.stepperControlRow}>
                        <Pressable style={styles.stepperBtn} onPress={() => adjustHour(-1)}>
                          <Ionicons name="remove" size={16} color="#000000" />
                        </Pressable>
                        <Text style={styles.stepperValue}>
                          {String(selectedDate.getHours()).padStart(2, '0')}
                        </Text>
                        <Pressable style={styles.stepperBtn} onPress={() => adjustHour(1)}>
                          <Ionicons name="add" size={16} color="#000000" />
                        </Pressable>
                      </View>
                    </View>

                    <Text style={styles.stepperColon}>:</Text>

                    <View style={styles.stepperBox}>
                      <Text style={styles.stepperLabel}>PHÚT</Text>
                      <View style={styles.stepperControlRow}>
                        <Pressable style={styles.stepperBtn} onPress={() => adjustMinute(-5)}>
                          <Ionicons name="remove" size={16} color="#000000" />
                        </Pressable>
                        <Text style={styles.stepperValue}>
                          {String(selectedDate.getMinutes()).padStart(2, '0')}
                        </Text>
                        <Pressable style={styles.stepperBtn} onPress={() => adjustMinute(5)}>
                          <Ionicons name="add" size={16} color="#000000" />
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {/* Save Time Button */}
                  <Pressable
                    style={styles.saveTimeBtn}
                    onPress={handleSaveTime}
                    disabled={isUpdating}
                  >
                    <Ionicons name="checkmark-done" size={18} color="#000000" />
                    <Text style={styles.saveTimeBtnText}>Lưu thời gian mới</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Category Section with Change Category Feature */}
            {canChangeCategory && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleGroup}>
                    <Ionicons name="pricetags-outline" size={18} color="#000000" />
                    <Text style={styles.sectionTitle}>Danh mục</Text>
                  </View>
                  <Pressable
                    style={styles.actionToggleBtn}
                    onPress={() => {
                      hapticLight();
                      setIsChangingCategory(!isChangingCategory);
                    }}
                  >
                    <Ionicons
                      name={isChangingCategory ? 'chevron-up' : 'create-outline'}
                      size={15}
                      color="#000000"
                    />
                    <Text style={styles.actionToggleText}>
                      {isChangingCategory ? 'Thu gọn' : 'Đổi danh mục'}
                    </Text>
                  </Pressable>
                </View>

                {/* Current Category Card */}
                <View style={styles.currentCategoryCard}>
                  <View
                    style={[
                      styles.categoryIconBox,
                      { backgroundColor: transaction.category_color || THEME.popPink },
                    ]}
                  >
                    <Ionicons
                      name={(transaction.category_icon as any) || 'cart-outline'}
                      size={20}
                      color="#000000"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.currentCategoryName}>
                      {transaction.category_name || 'Chưa phân loại'}
                    </Text>
                    <Text style={styles.currentCategorySub}>
                      {isChangingCategory
                        ? 'Chọn danh mục mới bên dưới:'
                        : 'Chạm "Đổi danh mục" nếu muốn phân loại lại'}
                    </Text>
                  </View>
                </View>

                {/* Categories Picker Grid */}
                {isChangingCategory && (
                  <View style={styles.pickerContainer}>
                    <Text style={styles.pickerLabel}>Danh sách danh mục có sẵn:</Text>
                    <View style={styles.categoriesGrid}>
                      {availableCategories.map(cat => {
                        const isSelected = transaction.category_id === cat.id;
                        return (
                          <Pressable
                            key={cat.id}
                            style={[
                              styles.catChip,
                              isSelected && styles.catChipSelected,
                            ]}
                            onPress={() => handleSelectCategory(cat)}
                            disabled={isUpdating}
                          >
                            <View
                              style={[
                                styles.catChipIconBox,
                                { backgroundColor: cat.color || THEME.primary },
                              ]}
                            >
                              <Ionicons
                                name={(cat.icon as any) || 'pricetag-outline'}
                                size={16}
                                color="#000000"
                              />
                            </View>
                            <Text
                              style={[
                                styles.catChipText,
                                isSelected && styles.catChipTextSelected,
                              ]}
                              numberOfLines={1}
                            >
                              {cat.name}
                            </Text>
                            {isSelected && (
                              <Ionicons name="checkmark-circle" size={16} color="#000000" />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Note & Debt Partner Info */}
            {(transaction.note || (isDebt && transaction.person_name)) && (
              <View style={styles.sectionCard}>
                {isDebt && transaction.person_name && (
                  <View style={styles.infoDetailRow}>
                    <View style={styles.infoLabelGroup}>
                      <Ionicons name="person-outline" size={17} color="#D97706" />
                      <Text style={styles.infoDetailLabel}>Đối tác / Người liên quan:</Text>
                    </View>
                    <View style={[styles.infoValueBadge, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.infoValueText, { color: '#92400E', fontWeight: '800' }]}>
                        {transaction.person_name}
                      </Text>
                    </View>
                  </View>
                )}

                {transaction.note && (
                  <View style={[styles.infoDetailRow, isDebt && transaction.person_name && { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' }]}>
                    <View style={styles.infoLabelGroup}>
                      <Ionicons name="chatbubble-ellipses-outline" size={17} color="#6B7280" />
                      <Text style={styles.infoDetailLabel}>Ghi chú:</Text>
                    </View>
                    <Text style={styles.noteValueText}>{transaction.note}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Actions: Split Bill & Delete */}
            <View style={styles.actionsSection}>
              {transaction.type === 'expense' && onSplit && (
                <Pressable
                  style={styles.splitActionBtn}
                  onPress={() => {
                    hapticLight();
                    onClose();
                    onSplit(transaction);
                  }}
                >
                  <View style={styles.splitActionInner}>
                    <Ionicons name="people-outline" size={20} color="#000000" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.splitActionTitle}>Tách tiền (Chia hóa đơn)</Text>
                      <Text style={styles.splitActionSub}>
                        Chuyển một phần chi tiêu này thành khoản người khác nợ
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#000000" />
                  </View>
                </Pressable>
              )}

              {/* Custom Delete Trigger */}
              <Pressable
                style={styles.deleteActionBtn}
                onPress={() => {
                  hapticLight();
                  setShowDeleteConfirm(true);
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={styles.deleteActionText}>Xóa giao dịch này</Text>
              </Pressable>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>

      {/* Custom Neo-brutalist Delete Confirmation Modal (NO system Alert) */}
      <DeleteConfirmModal
        visible={showDeleteConfirm}
        transaction={transaction}
        isBalanceHidden={isBalanceHidden}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirmDelete={async (tx) => {
          await removeTransaction(tx.id);
          onDelete?.(tx);
          setShowDeleteConfirm(false);
          onClose();
        }}
        onRecreate={onRecreate ? (tx) => {
          setShowDeleteConfirm(false);
          onClose();
          onRecreate(tx);
        } : undefined}
      />
      {AlertModalComponent}
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: THEME.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingHorizontal: 20,
    maxHeight: '90%',
    borderTopWidth: 3,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },
  scrollArea: {
    flexGrow: 1,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#000000',
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#000000',
    marginBottom: 10,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  incomeColor: {
    color: '#15803D',
  },
  expenseColor: {
    color: '#E11D48',
  },
  transferColor: {
    color: '#0284C7',
  },
  heroSubDate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 14,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
  },
  actionToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  actionToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  walletDisplayBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  walletItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  walletDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
  },
  walletRoleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  walletNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
  walletBalanceBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  transferTargetTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  transferTargetTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#F3F4F6',
  },
  transferTargetTabActive: {
    backgroundColor: THEME.primary,
  },
  transferTargetTabText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#4B5563',
  },
  transferTargetTabTextActive: {
    color: '#000000',
  },
  walletsGrid: {
    gap: 8,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  walletChipSelected: {
    backgroundColor: '#FEF08A',
  },
  walletChipDisabled: {
    opacity: 0.5,
    borderColor: '#D1D5DB',
  },
  walletChipIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletChipName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#000000',
  },
  walletChipNameSelected: {
    fontWeight: '900',
  },
  walletChipSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  disabledChipTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  timeDisplayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  timeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: THEME.popYellow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeMainText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
  timeSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  quickDateChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  quickChip: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#F3F4F6',
  },
  quickChipActive: {
    backgroundColor: '#000000',
  },
  quickChipText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#000000',
  },
  quickChipTextActive: {
    color: '#FFFFFF',
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  monthNavBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#F3F4F6',
  },
  monthNavTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  weekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  weekHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    width: 32,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 4,
    marginBottom: 12,
  },
  dayCellEmpty: {
    width: 34,
    height: 34,
  },
  dayCell: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  dayCellSelected: {
    backgroundColor: THEME.popYellow,
    borderColor: '#000000',
    borderWidth: 1.5,
  },
  dayCellToday: {
    borderColor: '#000000',
    borderWidth: 1.5,
  },
  dayCellText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  dayCellTextSelected: {
    fontWeight: '900',
  },
  dayCellTextToday: {
    fontWeight: '900',
  },
  timeSectionLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  timePresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  timePresetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#F3F4F6',
  },
  timePresetText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#000000',
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  stepperBox: {
    alignItems: 'center',
  },
  stepperLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 4,
  },
  stepperControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    padding: 3,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    minWidth: 32,
    textAlign: 'center',
  },
  stepperColon: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    marginTop: 14,
  },
  saveTimeBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.popYellow,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
  },
  saveTimeBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  currentCategoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  categoryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentCategoryName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  currentCategorySub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  pickerContainer: {
    marginTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  pickerLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  catChipSelected: {
    backgroundColor: '#FEF08A',
    borderColor: '#000000',
  },
  catChipIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  catChipTextSelected: {
    fontWeight: '900',
  },
  infoDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoDetailLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  infoValueBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  infoValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  noteValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  actionsSection: {
    gap: 10,
    marginTop: 6,
  },
  splitActionBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  splitActionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#FEF08A',
    borderRadius: 14,
  },
  splitActionTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#000000',
  },
  splitActionSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 2,
  },
  deleteActionBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  deleteActionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EF4444',
  },


});
