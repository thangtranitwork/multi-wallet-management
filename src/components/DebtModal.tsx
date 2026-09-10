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
import { useWallet } from '../context/WalletContext';
import { Debt } from '../types';
import { THEME, formatVND } from '../constants';
import { hapticLight, hapticSuccess, hapticError } from '../utils/haptics';

interface DebtModalProps {
  visible: boolean;
  onClose: () => void;
  targetDebt?: Debt | null;
  debtToPay?: Debt | null;
  defaultType?: 'lend' | 'borrow';
}

export const DebtModal: React.FC<DebtModalProps> = ({
  visible,
  onClose,
  targetDebt = null,
  debtToPay = null,
  defaultType = 'lend',
}) => {
  const { wallets, addDebt, payOrCollectDebt, isBalanceHidden } = useWallet();
  const effectiveDebt = debtToPay !== null ? debtToPay : targetDebt;

  // State cho Mode Create
  const [type, setType] = useState<'lend' | 'borrow'>(defaultType);
  const [personName, setPersonName] = useState<string>('');
  const [personPhone, setPersonPhone] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('0');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [dueDays, setDueDays] = useState<string>('7');
  const [note, setNote] = useState<string>('');

  // State cho Mode Payment
  const [payAmountStr, setPayAmountStr] = useState<string>('0');

  useEffect(() => {
    if (visible) {
      if (effectiveDebt) {
        // Payment mode
        setPayAmountStr(effectiveDebt.remaining_amount.toString());
        if (wallets.length > 0) {
          setSelectedWalletId(effectiveDebt.wallet_id || wallets[0].id);
        }
        setNote('');
      } else {
        // Create mode
        setType(defaultType);
        setPersonName('');
        setPersonPhone('');
        setAmountStr('0');
        setDueDays('7');
        setNote('');
        if (wallets.length > 0) {
          setSelectedWalletId(wallets[0].id);
        }
      }
    }
  }, [visible, effectiveDebt, defaultType, wallets]);

  const handleDigitPress = (digit: string, isPayment: boolean) => {
    hapticLight();
    const setter = isPayment ? setPayAmountStr : setAmountStr;
    setter(prev => {
      if (digit === '000') {
        if (prev === '0') return '0';
        return prev + '000';
      }
      if (prev === '0') return digit;
      return prev + digit;
    });
  };

  const handleBackspace = (isPayment: boolean) => {
    hapticLight();
    const setter = isPayment ? setPayAmountStr : setAmountStr;
    setter(prev => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  };

  const handleSaveCreate = async () => {
    const amount = parseInt(amountStr, 10) || 0;
    if (!personName.trim()) {
      hapticError();
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên người');
      return;
    }
    if (amount <= 0) {
      hapticError();
      Alert.alert('Số tiền không hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0');
      return;
    }

    const days = parseInt(dueDays, 10) || 7;
    const dueDate = new Date(Date.now() + days * 86400000).toISOString();

    try {
      await addDebt({
        type,
        person_name: personName.trim(),
        person_phone: personPhone.trim() || null,
        initial_amount: amount,
        wallet_id: selectedWalletId || null,
        due_date: dueDate,
        note: note.trim(),
      });
      hapticSuccess();
      onClose();
    } catch (err: any) {
      hapticError();
      Alert.alert('Lỗi', err?.message || 'Không thể tạo khoản nợ');
    }
  };

  const handleSavePayment = async () => {
    if (!targetDebt) return;
    const payAmount = parseInt(payAmountStr, 10) || 0;
    if (payAmount <= 0) {
      hapticError();
      Alert.alert('Số tiền không hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0');
      return;
    }
    if (!selectedWalletId) {
      hapticError();
      Alert.alert('Chưa chọn ví', 'Vui lòng chọn ví biến động');
      return;
    }

    try {
      await payOrCollectDebt({
        debtId: targetDebt.id,
        amount: payAmount,
        walletId: selectedWalletId,
        note: note.trim(),
      });
      hapticSuccess();
      onClose();
    } catch (err: any) {
      hapticError();
      Alert.alert('Lỗi thanh toán', err?.message || 'Đã có lỗi xảy ra');
    }
  };

  const isPaymentMode = !!targetDebt;
  const currentAmount = isPaymentMode
    ? parseInt(payAmountStr, 10) || 0
    : parseInt(amountStr, 10) || 0;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {isPaymentMode
                ? targetDebt.type === 'lend'
                  ? `Thu nợ từ ${targetDebt.person_name}`
                  : `Trả nợ cho ${targetDebt.person_name}`
                : 'Tạo khoản nợ mới'}
            </Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={THEME.textSecondary} />
            </Pressable>
          </View>

          {/* If Create: Tabs Cho vay vs Đi vay */}
          {!isPaymentMode && (
            <View style={styles.tabContainer}>
              <Pressable
                style={[styles.tab, type === 'lend' && styles.tabActiveLend]}
                onPress={() => setType('lend')}
              >
                <Text style={[styles.tabText, type === 'lend' && styles.tabTextActive]}>
                  Người khác nợ tôi
                </Text>
              </Pressable>

              <Pressable
                style={[styles.tab, type === 'borrow' && styles.tabActiveBorrow]}
                onPress={() => setType('borrow')}
              >
                <Text style={[styles.tabText, type === 'borrow' && styles.tabTextActive]}>
                  Tôi nợ người khác
                </Text>
              </Pressable>
            </View>
          )}

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Payment Summary Info if payment mode */}
            {isPaymentMode && targetDebt && (
              <View style={styles.targetDebtInfo}>
                <View style={styles.targetDebtRow}>
                  <Text style={styles.targetLabel}>Tổng số tiền ban đầu:</Text>
                  <Text style={styles.targetValue}>
                    {isBalanceHidden ? '••••••' : formatVND(targetDebt.initial_amount)}
                  </Text>
                </View>
                <View style={styles.targetDebtRow}>
                  <Text style={styles.targetLabel}>Số tiền còn nợ:</Text>
                  <Text style={[styles.targetValue, { color: '#F43F5E', fontWeight: '800' }]}>
                    {isBalanceHidden ? '••••••' : formatVND(targetDebt.remaining_amount)}
                  </Text>
                </View>
              </View>
            )}

            {/* If Create Mode: Person Details */}
            {!isPaymentMode && (
              <>
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionLabel}>
                    Tên {type === 'lend' ? 'người mượn tiền' : 'chủ nợ'} (*)
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ví dụ: Anh Nam, Bạn Tuấn, Chị Mai..."
                    placeholderTextColor={THEME.textMuted}
                    value={personName}
                    onChangeText={setPersonName}
                  />
                </View>

                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionLabel}>Số điện thoại (tùy chọn)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0987654321"
                    placeholderTextColor={THEME.textMuted}
                    keyboardType="phone-pad"
                    value={personPhone}
                    onChangeText={setPersonPhone}
                  />
                </View>

                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionLabel}>Hạn thanh toán (sau bao nhiêu ngày)</Text>
                  <View style={styles.dueDaysRow}>
                    {['3', '7', '15', '30', '60'].map(d => (
                      <Pressable
                        key={d}
                        style={[
                          styles.dueDayChip,
                          dueDays === d && styles.dueDayChipSelected,
                        ]}
                        onPress={() => setDueDays(d)}
                      >
                        <Text
                          style={[
                            styles.dueDayText,
                            dueDays === d && styles.dueDayTextSelected,
                          ]}
                        >
                          {d} ngày
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* Wallet Selection */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>
                {isPaymentMode
                  ? targetDebt?.type === 'lend'
                    ? 'Tiền thu về ví nào'
                    : 'Trích tiền từ ví nào'
                  : type === 'lend'
                  ? 'Trích tiền cho vay từ ví'
                  : 'Nhận tiền vay vào ví'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
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

            {/* Note Input */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>Ghi chú</Text>
              <TextInput
                style={styles.input}
                placeholder="Ví dụ: Mượn mua laptop, ăn uống chung..."
                placeholderTextColor={THEME.textMuted}
                value={note}
                onChangeText={setNote}
              />
            </View>

            {/* Amount Display - Placed right above the keypad */}
            <View style={styles.amountDisplayContainer}>
              <Text style={styles.amountLabel}>
                {isPaymentMode
                  ? targetDebt?.type === 'lend'
                    ? 'Số tiền thu nợ'
                    : 'Số tiền trả nợ'
                  : 'Số tiền'}
              </Text>
              <Text
                style={[
                  styles.amountNumber,
                  (isPaymentMode ? targetDebt?.type === 'lend' : type === 'lend')
                    ? styles.textLend
                    : styles.textBorrow,
                ]}
              >
                {formatVND(currentAmount)}
              </Text>
            </View>

            {/* Numeric Keypad */}
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
                          handleBackspace(isPaymentMode);
                        } else {
                          handleDigitPress(key, isPaymentMode);
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
                (isPaymentMode ? targetDebt?.type === 'lend' : type === 'lend')
                  ? styles.saveBtnLend
                  : styles.saveBtnBorrow,
                pressed && { opacity: 0.9 },
              ]}
              onPress={isPaymentMode ? handleSavePayment : handleSaveCreate}
            >
              <Ionicons name="checkmark-sharp" size={22} color="#000000" />
              <Text style={styles.saveBtnText}>
                {isPaymentMode ? 'Xác nhận thanh toán' : 'Tạo khoản nợ'}
              </Text>
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
    marginBottom: 16,
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
  tabActiveLend: {
    backgroundColor: THEME.primaryLight,
    borderColor: '#000000',
  },
  tabActiveBorrow: {
    backgroundColor: THEME.popPinkLight,
    borderColor: '#000000',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  scrollArea: {
    maxHeight: 520,
  },
  targetDebtInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#000000',
  },
  targetDebtRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  targetLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  targetValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
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
  textLend: {
    color: '#15803D',
  },
  textBorrow: {
    color: '#E11D48',
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
  input: {
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
  dueDaysRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dueDayChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  dueDayChipSelected: {
    borderColor: '#000000',
    backgroundColor: THEME.popYellow,
  },
  dueDayText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  dueDayTextSelected: {
    color: '#000000',
    fontWeight: '900',
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
    paddingVertical: 9,
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
  },
  saveBtnLend: {
    backgroundColor: THEME.primary,
  },
  saveBtnBorrow: {
    backgroundColor: THEME.popPink,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
});
