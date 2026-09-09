import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useWallet } from '../context/WalletContext';
import { NeoDropdown } from './NeoDropdown';
import { THEME, formatVND } from '../constants';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '../utils/haptics';

interface QuickAddModalProps {
  visible: boolean;
  onClose: () => void;
  defaultType?: 'expense' | 'income' | 'transfer';
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  visible,
  onClose,
  defaultType = 'expense',
}) => {
  const { wallets, categories, addTransaction } = useWallet();

  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(defaultType);
  const [amountStr, setAmountStr] = useState<string>('0');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [selectedToWalletId, setSelectedToWalletId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [note, setNote] = useState<string>('');

  // Date & Time states
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isPickerExpanded, setIsPickerExpanded] = useState<boolean>(false);
  const [pickerMonth, setPickerMonth] = useState<Date>(new Date());

  useEffect(() => {
    if (visible) {
      setType(defaultType);
      setAmountStr('0');
      setNote('');
      setSelectedDate(new Date());
      setIsPickerExpanded(false);
      setPickerMonth(new Date());
      if (wallets.length > 0) {
        setSelectedWalletId(wallets[0].id);
        if (wallets.length > 1) {
          setSelectedToWalletId(wallets[1].id);
        }
      }
    }
  }, [visible, defaultType, wallets]);

  // Set default category according to type
  useEffect(() => {
    const filteredCats = categories.filter(c => c.type === (type === 'income' ? 'income' : 'expense'));
    if (filteredCats.length > 0) {
      setSelectedCategoryId(filteredCats[0].id);
    }
  }, [type, categories]);

  const filteredCategories = categories.filter(
    c => c.type === (type === 'income' ? 'income' : 'expense')
  );

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const categoryDropdownOptions = filteredCategories.map(c => ({
    id: c.id,
    label: c.name,
    icon: c.icon,
    color: c.color,
  }));

  const amountNumber = parseInt(amountStr, 10) || 0;

  // Keypad actions
  const handleDigitPress = (digit: string) => {
    hapticLight();
    if (digit === '000') {
      if (amountStr === '0') return;
      if (amountStr.length + 3 > 12) return;
      setAmountStr(prev => prev + '000');
    } else {
      if (amountStr === '0') {
        setAmountStr(digit);
      } else {
        if (amountStr.length >= 12) return;
        setAmountStr(prev => prev + digit);
      }
    }
  };

  const handleBackspace = () => {
    hapticLight();
    if (amountStr.length <= 1) {
      setAmountStr('0');
    } else {
      setAmountStr(prev => prev.slice(0, -1));
    }
  };

  // Date & Time helpers
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
    // Monday = 0, Sunday = 6
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

  const handleSave = async () => {
    if (amountNumber <= 0) {
      hapticError();
      Alert.alert('Số tiền không hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0');
      return;
    }
    if (!selectedWalletId) {
      hapticError();
      Alert.alert('Chưa chọn ví', 'Vui lòng chọn nguồn tiền');
      return;
    }
    if (type === 'transfer') {
      if (!selectedToWalletId) {
        hapticError();
        Alert.alert('Chưa chọn ví đích', 'Vui lòng chọn ví nhận tiền');
        return;
      }
      if (selectedWalletId === selectedToWalletId) {
        hapticError();
        Alert.alert('Ví trùng nhau', 'Ví nguồn và ví đích không được trùng nhau');
        return;
      }
    }

    try {
      await addTransaction({
        type,
        amount: amountNumber,
        wallet_id: selectedWalletId,
        to_wallet_id: type === 'transfer' ? selectedToWalletId : null,
        category_id: type === 'transfer' ? null : selectedCategoryId,
        note: note.trim(),
        transacted_at: selectedDate.toISOString(),
      });
      hapticSuccess();
      onClose();
    } catch (error: any) {
      hapticError();
      Alert.alert('Lỗi lưu giao dịch', error?.message || 'Đã có lỗi xảy ra');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Ghi chép giao dịch</Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={THEME.textSecondary} />
            </Pressable>
          </View>

          {/* Type Segment Tabs */}
          <View style={styles.tabContainer}>
            <Pressable
              style={[styles.tab, type === 'expense' && styles.tabActiveExpense]}
              onPress={() => setType('expense')}
            >
              <Text
                style={[
                  styles.tabText,
                  type === 'expense' && styles.tabTextActive,
                ]}
              >
                Chi tiêu
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tab, type === 'income' && styles.tabActiveIncome]}
              onPress={() => setType('income')}
            >
              <Text
                style={[
                  styles.tabText,
                  type === 'income' && styles.tabTextActive,
                ]}
              >
                Thu nhập
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tab, type === 'transfer' && styles.tabActiveTransfer]}
              onPress={() => setType('transfer')}
            >
              <Text
                style={[
                  styles.tabText,
                  type === 'transfer' && styles.tabTextActive,
                ]}
              >
                Chuyển tiền
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Wallet Selection */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>
                {type === 'transfer' ? 'Từ nguồn tiền (Ví nguồn)' : 'Nguồn tiền (Ví)'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalChips}
              >
                {wallets.map(w => {
                  const isSelected = selectedWalletId === w.id;
                  return (
                    <Pressable
                      key={w.id}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                      onPress={() => setSelectedWalletId(w.id)}
                    >
                      <Ionicons
                        name={(w.icon as any) || 'wallet-outline'}
                        size={16}
                        color={isSelected ? '#FACC15' : '#000000'}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {w.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* If Transfer: Destination Wallet */}
            {type === 'transfer' && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionLabel}>Đến nguồn tiền (Ví đích)</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.horizontalChips}
                >
                  {wallets
                    .filter(w => w.id !== selectedWalletId)
                    .map(w => {
                      const isSelected = selectedToWalletId === w.id;
                      return (
                        <Pressable
                          key={w.id}
                          style={[
                            styles.chip,
                            isSelected && styles.chipSelected,
                          ]}
                          onPress={() => setSelectedToWalletId(w.id)}
                        >
                          <Ionicons
                            name={(w.icon as any) || 'wallet-outline'}
                            size={16}
                            color={isSelected ? '#38BDF8' : '#000000'}
                          />
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextSelected,
                            ]}
                          >
                            {w.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                </ScrollView>
              </View>
            )}

            {/* Categories (for Expense / Income) as Dropdown */}
            {type !== 'transfer' && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionLabel}>Hạng mục danh mục</Text>
                <NeoDropdown
                  title={type === 'income' ? 'Chọn hạng mục thu nhập' : 'Chọn hạng mục chi tiêu'}
                  triggerLabel={selectedCategory?.name || 'Chọn hạng mục'}
                  triggerIcon={(selectedCategory?.icon as any) || 'pricetag-outline'}
                  isActive={true}
                  options={categoryDropdownOptions}
                  selectedValue={selectedCategoryId}
                  onSelect={val => val && setSelectedCategoryId(val)}
                />
              </View>
            )}

            {/* Date & Time Selection Section */}
            <View style={styles.sectionContainer}>
              <View style={styles.dateSectionHeaderRow}>
                <Text style={styles.sectionLabel}>Thời gian ghi nhận</Text>
                <Pressable
                  style={styles.dateToggleBtn}
                  onPress={() => setIsPickerExpanded(prev => !prev)}
                >
                  <Ionicons
                    name={isPickerExpanded ? 'chevron-up-circle' : 'calendar-outline'}
                    size={16}
                    color="#000000"
                  />
                  <Text style={styles.dateToggleText}>
                    {isPickerExpanded ? 'Thu gọn' : 'Đổi ngày/giờ'}
                  </Text>
                </Pressable>
              </View>

              {/* Quick Date Chips */}
              <View style={styles.quickDateChipsContainer}>
                <Pressable
                  style={[
                    styles.quickDateChip,
                    isSelectedToday && styles.quickDateChipActive,
                  ]}
                  onPress={setToday}
                >
                  <Text
                    style={[
                      styles.quickDateChipText,
                      isSelectedToday && styles.quickDateChipTextActive,
                    ]}
                  >
                    Hôm nay
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.quickDateChip,
                    isSelectedYesterday && styles.quickDateChipActive,
                  ]}
                  onPress={setYesterday}
                >
                  <Text
                    style={[
                      styles.quickDateChipText,
                      isSelectedYesterday && styles.quickDateChipTextActive,
                    ]}
                  >
                    Hôm qua
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.quickDateChip,
                    isSelectedTwoDaysAgo && styles.quickDateChipActive,
                  ]}
                  onPress={setTwoDaysAgo}
                >
                  <Text
                    style={[
                      styles.quickDateChipText,
                      isSelectedTwoDaysAgo && styles.quickDateChipTextActive,
                    ]}
                  >
                    2 ngày trước
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.quickDateChip,
                    isPickerExpanded && styles.quickDateChipActive,
                  ]}
                  onPress={() => setIsPickerExpanded(prev => !prev)}
                >
                  <Ionicons
                    name="calendar"
                    size={13}
                    color={isPickerExpanded ? '#FFFFFF' : '#000000'}
                  />
                  <Text
                    style={[
                      styles.quickDateChipText,
                      isPickerExpanded && styles.quickDateChipTextActive,
                    ]}
                  >
                    Lịch & Giờ
                  </Text>
                </Pressable>
              </View>

              {/* Selected Date & Time Indicator Bar */}
              <Pressable
                style={styles.selectedDateBanner}
                onPress={() => setIsPickerExpanded(prev => !prev)}
              >
                <View style={styles.dateBannerLeft}>
                  <View style={styles.dateBannerIconBox}>
                    <Ionicons name="time" size={16} color="#000000" />
                  </View>
                  <View>
                    <Text style={styles.dateBannerTitle}>
                      {getFormattedDateLabel(selectedDate)}
                    </Text>
                    <Text style={styles.dateBannerSubtitle}>
                      {dayjs(selectedDate).format('DD/MM/YYYY - HH:mm')}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={isPickerExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#000000"
                />
              </Pressable>

              {/* Expandable Calendar & Time Picker Panel */}
              {isPickerExpanded && (
                <View style={styles.calendarPanel}>
                  {/* Month Navigation */}
                  <View style={styles.monthNavRow}>
                    <Pressable
                      style={styles.monthNavBtn}
                      onPress={() =>
                        setPickerMonth(prev => dayjs(prev).subtract(1, 'month').toDate())
                      }
                    >
                      <Ionicons name="chevron-back" size={18} color="#000000" />
                    </Pressable>

                    <Text style={styles.monthNavTitle}>
                      Tháng {dayjs(pickerMonth).format('M, YYYY')}
                    </Text>

                    <Pressable
                      style={styles.monthNavBtn}
                      onPress={() =>
                        setPickerMonth(prev => dayjs(prev).add(1, 'month').toDate())
                      }
                    >
                      <Ionicons name="chevron-forward" size={18} color="#000000" />
                    </Pressable>
                  </View>

                  {/* Weekday Headers */}
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
                    {getCalendarDays().map((slot, idx) => {
                      if (slot.dayNum === null) {
                        return <View key={idx} style={styles.dayCellEmpty} />;
                      }

                      const cellDate = dayjs(pickerMonth).date(slot.dayNum);
                      const isSelected =
                        dayjs(selectedDate).isSame(cellDate, 'day');
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

                  {/* Time Section Divider */}
                  <View style={styles.timeSectionDivider} />

                  {/* Time Presets Row */}
                  <Text style={styles.timeSectionLabel}>Khung giờ thông dụng</Text>
                  <View style={styles.timePresetsRow}>
                    <Pressable
                      style={styles.timePresetChip}
                      onPress={() => setPresetTime(8, 0)}
                    >
                      <Text style={styles.timePresetText}>Sáng 08:00</Text>
                    </Pressable>
                    <Pressable
                      style={styles.timePresetChip}
                      onPress={() => setPresetTime(12, 30)}
                    >
                      <Text style={styles.timePresetText}>Trưa 12:30</Text>
                    </Pressable>
                    <Pressable
                      style={styles.timePresetChip}
                      onPress={() => setPresetTime(18, 0)}
                    >
                      <Text style={styles.timePresetText}>Chiều 18:00</Text>
                    </Pressable>
                    <Pressable
                      style={styles.timePresetChip}
                      onPress={() => setPresetTime(20, 30)}
                    >
                      <Text style={styles.timePresetText}>Tối 20:30</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.timePresetChip, { backgroundColor: THEME.popYellow }]}
                      onPress={setNowTime}
                    >
                      <Text style={styles.timePresetText}>Bây giờ</Text>
                    </Pressable>
                  </View>

                  {/* Hour & Minute Steppers */}
                  <View style={styles.stepperContainer}>
                    {/* Hour Stepper */}
                    <View style={styles.stepperBox}>
                      <Text style={styles.stepperLabel}>GIỜ</Text>
                      <View style={styles.stepperControlRow}>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => adjustHour(-1)}
                        >
                          <Ionicons name="remove" size={16} color="#000000" />
                        </Pressable>
                        <Text style={styles.stepperValue}>
                          {String(selectedDate.getHours()).padStart(2, '0')}
                        </Text>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => adjustHour(1)}
                        >
                          <Ionicons name="add" size={16} color="#000000" />
                        </Pressable>
                      </View>
                    </View>

                    <Text style={styles.stepperColon}>:</Text>

                    {/* Minute Stepper */}
                    <View style={styles.stepperBox}>
                      <Text style={styles.stepperLabel}>PHÚT</Text>
                      <View style={styles.stepperControlRow}>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => adjustMinute(-5)}
                        >
                          <Ionicons name="remove" size={16} color="#000000" />
                        </Pressable>
                        <Text style={styles.stepperValue}>
                          {String(selectedDate.getMinutes()).padStart(2, '0')}
                        </Text>
                        <Pressable
                          style={styles.stepperBtn}
                          onPress={() => adjustMinute(5)}
                        >
                          <Ionicons name="add" size={16} color="#000000" />
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {/* Collapse Button */}
                  <Pressable
                    style={styles.collapsePickerBtn}
                    onPress={() => setIsPickerExpanded(false)}
                  >
                    <Ionicons name="checkmark-done" size={16} color="#000000" />
                    <Text style={styles.collapsePickerBtnText}>Xong ngày & giờ</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Note Input */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>Ghi chú (tùy chọn)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Ví dụ: Ăn bún chả với đồng nghiệp..."
                placeholderTextColor={THEME.textMuted}
                value={note}
                onChangeText={setNote}
              />
            </View>

            {/* Amount Display - Placed right above the keypad */}
            <View style={styles.amountDisplayContainer}>
              <Text style={styles.amountLabel}>
                {type === 'expense'
                  ? 'Số tiền chi'
                  : type === 'income'
                  ? 'Số tiền thu'
                  : 'Số tiền chuyển'}
              </Text>
              <Text
                style={[
                  styles.amountNumber,
                  type === 'expense' && styles.textExpense,
                  type === 'income' && styles.textIncome,
                  type === 'transfer' && styles.textTransfer,
                ]}
              >
                {formatVND(amountNumber)}
              </Text>
            </View>

            {/* Mobile Touch Keypad */}
            <View style={styles.keypadContainer}>
              {[
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
                ['000', '0', 'DEL'],
              ].map((row, rIdx) => (
                <View key={rIdx} style={styles.keypadRow}>
                  {row.map(key => (
                    <Pressable
                      key={key}
                      style={({ pressed }) => [
                        styles.keypadBtn,
                        pressed && styles.keypadBtnPressed,
                        key === 'DEL' && styles.keypadDeleteBtn,
                      ]}
                      onPress={() => {
                        if (key === 'DEL') {
                          handleBackspace();
                        } else {
                          handleDigitPress(key);
                        }
                      }}
                    >
                      {key === 'DEL' ? (
                        <Ionicons name="backspace-outline" size={24} color="#EF4444" />
                      ) : (
                        <Text style={styles.keypadText}>{key}</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>

            {/* Save Button */}
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                type === 'expense' && styles.saveBtnExpense,
                type === 'income' && styles.saveBtnIncome,
                type === 'transfer' && styles.saveBtnTransfer,
                pressed && { opacity: 0.9 },
              ]}
              onPress={handleSave}
            >
              <Ionicons name="checkmark-sharp" size={22} color="#000000" />
              <Text style={styles.saveBtnText}>Lưu giao dịch</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: THEME.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingBottom: 28,
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
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#000000',
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tabActiveExpense: {
    backgroundColor: THEME.popPinkLight,
    borderColor: '#000000',
  },
  tabActiveIncome: {
    backgroundColor: THEME.primaryLight,
    borderColor: '#000000',
  },
  tabActiveTransfer: {
    backgroundColor: THEME.popBlueLight,
    borderColor: '#000000',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  scrollArea: {
    maxHeight: 520,
  },
  amountDisplayContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2.5,
    borderColor: '#000000',
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  amountNumber: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  textExpense: {
    color: '#E11D48',
  },
  textIncome: {
    color: '#15803D',
  },
  textTransfer: {
    color: '#0284C7',
  },
  sectionContainer: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 8,
  },
  horizontalChips: {
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#000000',
  },
  chipSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
    borderWidth: 2.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
  },
  categoryItemSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
    borderWidth: 2.5,
  },
  catIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  catName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  catNameSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  noteInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    borderWidth: 2,
    borderColor: '#000000',
  },
  keypadContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    marginTop: 8,
    marginBottom: 14,
    borderWidth: 2.5,
    borderColor: '#000000',
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  keypadBtn: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    backgroundColor: '#FAF8F5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
  },
  keypadBtnPressed: {
    backgroundColor: THEME.popYellow,
  },
  keypadDeleteBtn: {
    backgroundColor: '#FEE2E2',
  },
  keypadText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
  },
  saveBtn: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
    borderWidth: 2.5,
    borderColor: '#000000',
    backgroundColor: THEME.popYellow,
  },
  saveBtnExpense: {
    backgroundColor: THEME.popYellow,
  },
  saveBtnIncome: {
    backgroundColor: THEME.primary,
  },
  saveBtnTransfer: {
    backgroundColor: THEME.popBlue,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  // Date & Time Styles
  dateSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  dateToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  quickDateChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  quickDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  quickDateChipActive: {
    backgroundColor: '#000000',
  },
  quickDateChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  quickDateChipTextActive: {
    color: '#FFFFFF',
  },
  selectedDateBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 2,
    borderColor: '#000000',
  },
  dateBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateBannerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: THEME.popYellow,
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateBannerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  dateBannerSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 1,
  },
  calendarPanel: {
    marginTop: 8,
    backgroundColor: '#FAF8F5',
    borderRadius: 16,
    padding: 12,
    borderWidth: 2,
    borderColor: '#000000',
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  monthNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
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
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  weekHeaderText: {
    width: '13.5%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: '#4B5563',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
    justifyContent: 'space-between',
  },
  dayCell: {
    width: '13.5%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellEmpty: {
    width: '13.5%',
    aspectRatio: 1,
  },
  dayCellSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  dayCellToday: {
    borderColor: '#FACC15',
    borderWidth: 2,
    backgroundColor: '#FEF9C3',
  },
  dayCellText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  dayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  dayCellTextToday: {
    color: '#854D0E',
    fontWeight: '900',
  },
  timeSectionDivider: {
    height: 1.5,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
  },
  timeSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  timePresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 10,
  },
  timePresetChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  timePresetText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 6,
  },
  stepperBox: {
    alignItems: 'center',
  },
  stepperLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#6B7280',
    marginBottom: 2,
  },
  stepperControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    overflow: 'hidden',
  },
  stepperBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FAF8F5',
  },
  stepperValue: {
    minWidth: 32,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  stepperColon: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    marginTop: 12,
  },
  collapsePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.popYellow,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingVertical: 8,
    marginTop: 8,
  },
  collapsePickerBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
});
