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
import { Transaction } from '../types';
import { THEME, formatVND } from '../constants';
import { hapticLight, hapticSuccess, hapticError } from '../utils/haptics';

interface MemberSplit {
  id: string;
  name: string;
  phone: string;
  amountStr: string;
  note: string;
}

interface SplitTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

export const SplitTransactionModal: React.FC<SplitTransactionModalProps> = ({
  visible,
  onClose,
  transaction,
}) => {
  const { splitTransaction } = useWallet();

  const [members, setMembers] = useState<MemberSplit[]>([
    { id: '1', name: '', phone: '', amountStr: '0', note: '' },
  ]);
  const [activeInputId, setActiveInputId] = useState<string>('1');

  useEffect(() => {
    if (visible && transaction) {
      // Mặc định khởi tạo 1 người với 50% số tiền nếu chẵn, hoặc để 0
      const half = Math.floor(transaction.amount / 2);
      setMembers([
        {
          id: '1',
          name: '',
          phone: '',
          amountStr: half.toString(),
          note: '',
        },
      ]);
      setActiveInputId('1');
    }
  }, [visible, transaction]);

  if (!transaction) return null;

  const totalAmount = transaction.amount;
  const totalSplitAmount = members.reduce(
    (sum, m) => sum + (parseInt(m.amountStr, 10) || 0),
    0
  );
  const remainingForMe = totalAmount - totalSplitAmount;

  // ── Keypad handlers ──
  const handleDigitPress = (digit: string) => {
    hapticLight();
    setMembers(prev =>
      prev.map(m => {
        if (m.id !== activeInputId) return m;
        let nextStr = m.amountStr;
        if (digit === '000') {
          nextStr = nextStr === '0' ? '0' : nextStr + '000';
        } else if (nextStr === '0') {
          nextStr = digit;
        } else {
          nextStr = nextStr + digit;
        }
        return { ...m, amountStr: nextStr };
      })
    );
  };

  const handleBackspace = () => {
    hapticLight();
    setMembers(prev =>
      prev.map(m => {
        if (m.id !== activeInputId) return m;
        const nextStr = m.amountStr.length <= 1 ? '0' : m.amountStr.slice(0, -1);
        return { ...m, amountStr: nextStr };
      })
    );
  };

  // ── Quick presets ──
  const handlePresetSplit = (percentage: number) => {
    hapticLight();
    const splitVal = Math.floor((totalAmount * percentage) / 100);
    setMembers(prev =>
      prev.map((m, idx) => {
        if (idx === 0) {
          return { ...m, amountStr: splitVal.toString() };
        }
        return m;
      })
    );
  };

  const handleEvenSplit = () => {
    hapticLight();
    // Chia đều cho (số người + 1 người là chính mình)
    const count = members.length + 1;
    const each = Math.floor(totalAmount / count);
    setMembers(prev =>
      prev.map(m => ({ ...m, amountStr: each.toString() }))
    );
  };

  // ── Member management ──
  const addMember = () => {
    hapticLight();
    const newId = Date.now().toString();
    setMembers(prev => [
      ...prev,
      { id: newId, name: '', phone: '', amountStr: '0', note: '' },
    ]);
    setActiveInputId(newId);
  };

  const removeMember = (id: string) => {
    hapticLight();
    if (members.length <= 1) return;
    setMembers(prev => prev.filter(m => m.id !== id));
    if (activeInputId === id) {
      setActiveInputId(members[0].id);
    }
  };

  const updateMember = (id: string, field: keyof MemberSplit, val: string) => {
    setMembers(prev =>
      prev.map(m => (m.id === id ? { ...m, [field]: val } : m))
    );
  };

  // ── Submit ──
  const handleConfirm = async () => {
    if (totalSplitAmount <= 0) {
      hapticError();
      Alert.alert('Chưa nhập số tiền', 'Vui lòng nhập số tiền tách cho người khác');
      return;
    }

    if (totalSplitAmount > totalAmount) {
      hapticError();
      Alert.alert(
        'Vượt quá số tiền gốc',
        `Tổng tiền tách (${formatVND(totalSplitAmount)}) không được vượt quá số tiền giao dịch gốc (${formatVND(totalAmount)})`
      );
      return;
    }

    for (const m of members) {
      const amt = parseInt(m.amountStr, 10) || 0;
      if (amt > 0 && !m.name.trim()) {
        hapticError();
        Alert.alert('Thiếu tên người', 'Vui lòng nhập tên cho người nhận phần nợ này');
        return;
      }
    }

    try {
      const validSplits = members
        .filter(m => (parseInt(m.amountStr, 10) || 0) > 0 && m.name.trim())
        .map(m => ({
          personName: m.name.trim(),
          personPhone: m.phone.trim() || null,
          amount: parseInt(m.amountStr, 10) || 0,
          note: m.note.trim() || undefined,
        }));

      await splitTransaction(transaction.id, validSplits);
      hapticSuccess();
      Alert.alert(
        'Tách tiền thành công! 🎉',
        `Đã chuyển ${formatVND(totalSplitAmount)} thành khoản nợ trong Sổ nợ.\nChi tiêu của bạn cho giao dịch này giảm còn ${formatVND(remainingForMe)}.`
      );
      onClose();
    } catch (err: any) {
      hapticError();
      Alert.alert('Lỗi', err?.message || 'Không thể tách giao dịch');
    }
  };

  const activeMember = members.find(m => m.id === activeInputId) || members[0];
  const activeAmount = parseInt(activeMember?.amountStr || '0', 10);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>✂️ Tách Tiền Giao Dịch</Text>
              <Text style={styles.headerSub}>Chuyển một phần chi tiêu thành khoản người khác nợ</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={THEME.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Original Transaction Summary Card */}
            <View style={styles.origCard}>
              <View style={styles.origTopRow}>
                <View style={[styles.origIconBox, { backgroundColor: transaction.category_color || THEME.popPink }]}>
                  <Ionicons
                    name={(transaction.category_icon as any) || 'cart-outline'}
                    size={20}
                    color="#000000"
                  />
                </View>
                <View style={styles.origInfo}>
                  <Text style={styles.origTitle}>
                    {transaction.category_name || 'Chi tiêu'}
                  </Text>
                  <Text style={styles.origMeta}>
                    {transaction.wallet_name ? `Ví: ${transaction.wallet_name} · ` : ''}
                    {dayjs(transaction.transacted_at).format('DD/MM/YYYY, HH:mm')}
                  </Text>
                </View>
                <View style={styles.origAmountBox}>
                  <Text style={styles.origAmountLabel}>GỐC</Text>
                  <Text style={styles.origAmount}>{formatVND(transaction.amount)}</Text>
                </View>
              </View>

              {transaction.note ? (
                <View style={styles.origNoteRow}>
                  <Ionicons name="chatbubble-outline" size={13} color="#6B7280" />
                  <Text style={styles.origNoteText} numberOfLines={2}>
                    {transaction.note}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Quick Presets Row */}
            <View style={styles.presetsRow}>
              <Text style={styles.presetLabel}>Chia nhanh:</Text>
              <Pressable style={styles.presetChip} onPress={() => handlePresetSplit(50)}>
                <Text style={styles.presetChipText}>Nửa tiền (50%)</Text>
              </Pressable>
              <Pressable style={styles.presetChip} onPress={handleEvenSplit}>
                <Text style={styles.presetChipText}>Chia đều</Text>
              </Pressable>
              <Pressable style={styles.presetChip} onPress={() => handlePresetSplit(100)}>
                <Text style={styles.presetChipText}>Toàn bộ (100%)</Text>
              </Pressable>
            </View>

            {/* Members Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>NGƯỜI CẦN TRẢ LẠI BẠN</Text>
              <Pressable style={styles.addMemberHeaderBtn} onPress={addMember}>
                <Ionicons name="add" size={14} color="#000000" />
                <Text style={styles.addMemberHeaderText}>Thêm người</Text>
              </Pressable>
            </View>

            {members.map((m, idx) => {
              const isActive = m.id === activeInputId;
              const mAmt = parseInt(m.amountStr, 10) || 0;

              return (
                <View
                  key={m.id}
                  style={[styles.memberCard, isActive && styles.memberCardActive]}
                >
                  <View style={styles.memberCardTop}>
                    <Text style={styles.memberIndex}>Người #{idx + 1}</Text>
                    {members.length > 1 && (
                      <Pressable
                        style={styles.deleteMemberBtn}
                        onPress={() => removeMember(m.id)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.memberInputsRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Tên người (*)"
                      placeholderTextColor={THEME.textMuted}
                      value={m.name}
                      onChangeText={val => updateMember(m.id, 'name', val)}
                    />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="SĐT (tùy chọn)"
                      placeholderTextColor={THEME.textMuted}
                      keyboardType="phone-pad"
                      value={m.phone}
                      onChangeText={val => updateMember(m.id, 'phone', val)}
                    />
                  </View>

                  {/* Tap to set active for keypad */}
                  <Pressable
                    style={[styles.amountTriggerBtn, isActive && styles.amountTriggerBtnActive]}
                    onPress={() => {
                      hapticLight();
                      setActiveInputId(m.id);
                    }}
                  >
                    <Text style={styles.amountTriggerLabel}>Phần tiền họ nợ:</Text>
                    <Text
                      style={[
                        styles.amountTriggerValue,
                        mAmt > 0 ? { color: '#0F766E' } : { color: '#9CA3AF' },
                      ]}
                    >
                      {formatVND(mAmt)}
                    </Text>
                    <Ionicons
                      name="calculator-outline"
                      size={16}
                      color={isActive ? '#0F766E' : '#6B7280'}
                    />
                  </Pressable>
                </View>
              );
            })}

            {/* Smart Summary Breakdown Bar */}
            <View style={styles.breakdownCard}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownKey}>Giao dịch gốc:</Text>
                <Text style={styles.breakdownVal}>{formatVND(totalAmount)}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownKey}>Tách cho người khác:</Text>
                <Text style={[styles.breakdownVal, { color: '#0F766E' }]}>
                  -{formatVND(totalSplitAmount)}
                </Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownRow}>
                <Text style={styles.myExpenseKey}>Chi tiêu thực của tôi:</Text>
                <Text
                  style={[
                    styles.myExpenseVal,
                    remainingForMe < 0 ? { color: '#EF4444' } : { color: '#15803D' },
                  ]}
                >
                  {formatVND(remainingForMe)}
                </Text>
              </View>
            </View>

            {/* Notice / Explanation */}
            <View style={styles.infoBox}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#059669" />
              <Text style={styles.infoText}>
                Số dư ví hiện tại không đổi. Chi tiêu thực của bạn sẽ được điều chỉnh còn{' '}
                <Text style={{ fontWeight: '900', color: '#047857' }}>
                  {formatVND(Math.max(0, remainingForMe))}
                </Text>
                . Khi người này trả nợ, tiền sẽ tự động cộng lại vào ví mà không tính thành thu nhập mới.
              </Text>
            </View>

            {/* Keypad */}
            <View style={styles.keypadWrapper}>
              <Text style={styles.keypadTargetLabel}>
                Nhập số tiền cho: <Text style={{ fontWeight: '900', color: '#000000' }}>{activeMember?.name || `Người #${members.findIndex(m => m.id === activeInputId) + 1}`}</Text>
              </Text>
              <Text style={styles.keypadDisplayAmount}>{formatVND(activeAmount)}</Text>

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
                        if (key === 'DEL') handleBackspace();
                        else handleDigitPress(key);
                      }}
                    >
                      {key === 'DEL' ? (
                        <Ionicons name="backspace-outline" size={22} color="#EF4444" />
                      ) : (
                        <Text style={styles.keypadText}>{key}</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>

            {/* Confirm Button */}
            <Pressable
              style={({ pressed }) => [
                styles.confirmBtn,
                pressed && { opacity: 0.9 },
                remainingForMe < 0 && styles.confirmBtnDisabled,
              ]}
              disabled={remainingForMe < 0}
              onPress={handleConfirm}
            >
              <Ionicons name="checkmark-done" size={22} color="#000000" />
              <Text style={styles.confirmBtnText}>
                {remainingForMe === 0
                  ? 'Tách toàn bộ 100% thành khoản nợ'
                  : `Xác nhận · Tách ${formatVND(totalSplitAmount)}`}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
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
    paddingBottom: 36,
    paddingHorizontal: 20,
    maxHeight: '94%',
    borderTopWidth: 3,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  scrollArea: {
    maxHeight: 620,
  },
  origCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  origTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  origIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  origInfo: {
    flex: 1,
  },
  origTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
  },
  origMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginTop: 2,
  },
  origAmountBox: {
    alignItems: 'flex-end',
  },
  origAmountLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  origAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#E11D48',
  },
  origNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  origNoteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    fontStyle: 'italic',
    flex: 1,
  },
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  presetChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  addMemberHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.popYellow,
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  addMemberHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 10,
    gap: 8,
  },
  memberCardActive: {
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
    shadowColor: '#059669',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  memberCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberIndex: {
    fontSize: 11,
    fontWeight: '900',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  deleteMemberBtn: {
    padding: 2,
  },
  memberInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    backgroundColor: '#FAF8F5',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  amountTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  amountTriggerBtnActive: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  amountTriggerLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4B5563',
  },
  amountTriggerValue: {
    fontSize: 16,
    fontWeight: '900',
    flex: 1,
    textAlign: 'right',
    marginRight: 8,
  },
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 2,
    borderColor: '#000000',
    marginTop: 4,
    marginBottom: 12,
    gap: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownKey: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  breakdownVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 2,
  },
  myExpenseKey: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  myExpenseVal: {
    fontSize: 17,
    fontWeight: '900',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#059669',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  infoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    flex: 1,
    lineHeight: 18,
  },
  keypadWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 2.5,
    borderColor: '#000000',
    marginBottom: 14,
  },
  keypadTargetLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 2,
  },
  keypadDisplayAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F766E',
    textAlign: 'center',
    marginBottom: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  keypadBtn: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
    backgroundColor: '#FAF8F5',
    borderRadius: 10,
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
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
  },
  confirmBtn: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.primary,
    borderWidth: 2.5,
    borderColor: '#000000',
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  confirmBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
  },
});
