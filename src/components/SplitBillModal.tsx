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
import { THEME, formatVND } from '../constants';
import { hapticLight, hapticSuccess, hapticError } from '../utils/haptics';

interface SplitMember {
  key: string;
  name: string;
  phone: string;
  amountStr: string;
}

interface SplitBillModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SplitBillModal: React.FC<SplitBillModalProps> = ({ visible, onClose }) => {
  const { wallets, addDebt } = useWallet();

  const [totalAmountStr, setTotalAmountStr] = useState('0');
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [note, setNote] = useState('');
  const [members, setMembers] = useState<SplitMember[]>([
    { key: '1', name: '', phone: '', amountStr: '0' },
  ]);
  // Which keypad is active: 'total' | member key
  const [activeInput, setActiveInput] = useState<string>('total');

  useEffect(() => {
    if (visible) {
      setTotalAmountStr('0');
      setNote('');
      setMembers([{ key: '1', name: '', phone: '', amountStr: '0' }]);
      setActiveInput('total');
      if (wallets.length > 0) setSelectedWalletId(wallets[0].id);
    }
  }, [visible, wallets]);

  // ── Keypad helpers ────────────────────────────────────────────
  const pressDigit = (digit: string) => {
    hapticLight();
    if (activeInput === 'total') {
      setTotalAmountStr(prev => {
        if (digit === '000') return prev === '0' ? '0' : prev + '000';
        if (prev === '0') return digit;
        return prev + digit;
      });
    } else {
      setMembers(prev =>
        prev.map(m => {
          if (m.key !== activeInput) return m;
          const prev2 = m.amountStr;
          let next: string;
          if (digit === '000') next = prev2 === '0' ? '0' : prev2 + '000';
          else if (prev2 === '0') next = digit;
          else next = prev2 + digit;
          return { ...m, amountStr: next };
        })
      );
    }
  };

  const pressBackspace = () => {
    hapticLight();
    if (activeInput === 'total') {
      setTotalAmountStr(prev => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
    } else {
      setMembers(prev =>
        prev.map(m => {
          if (m.key !== activeInput) return m;
          const next = m.amountStr.length <= 1 ? '0' : m.amountStr.slice(0, -1);
          return { ...m, amountStr: next };
        })
      );
    }
  };

  // ── Member management ─────────────────────────────────────────
  const addMember = () => {
    hapticLight();
    const key = Date.now().toString();
    setMembers(prev => [...prev, { key, name: '', phone: '', amountStr: '0' }]);
    setActiveInput(key);
  };

  const removeMember = (key: string) => {
    hapticLight();
    setMembers(prev => prev.filter(m => m.key !== key));
    if (activeInput === key) setActiveInput('total');
  };

  const updateMemberField = (key: string, field: 'name' | 'phone', value: string) => {
    setMembers(prev => prev.map(m => (m.key === key ? { ...m, [field]: value } : m)));
  };

  // ── Auto-split evenly ─────────────────────────────────────────
  const autoSplit = () => {
    hapticLight();
    const total = parseInt(totalAmountStr, 10) || 0;
    if (total <= 0 || members.length === 0) return;
    const each = Math.floor(total / members.length);
    setMembers(prev => prev.map(m => ({ ...m, amountStr: each.toString() })));
  };

  // ── Computed values ───────────────────────────────────────────
  const totalAmount = parseInt(totalAmountStr, 10) || 0;
  const assignedTotal = members.reduce((s, m) => s + (parseInt(m.amountStr, 10) || 0), 0);
  const remaining = totalAmount - assignedTotal;

  const activeMember = members.find(m => m.key === activeInput);
  const activeAmountStr =
    activeInput === 'total' ? totalAmountStr : activeMember?.amountStr ?? '0';
  const activeAmount = parseInt(activeAmountStr, 10) || 0;

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (totalAmount <= 0) {
      hapticError();
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tổng số tiền');
      return;
    }
    if (!selectedWalletId) {
      hapticError();
      Alert.alert('Chưa chọn ví', 'Vui lòng chọn ví để trừ tiền');
      return;
    }
    for (const m of members) {
      if (!m.name.trim()) {
        hapticError();
        Alert.alert('Thiếu tên', 'Vui lòng nhập tên cho tất cả các thành viên');
        return;
      }
      if ((parseInt(m.amountStr, 10) || 0) <= 0) {
        hapticError();
        Alert.alert('Số tiền không hợp lệ', `Số tiền của "${m.name}" phải lớn hơn 0`);
        return;
      }
    }

    try {
      // Tạo khoản nợ (lend) riêng cho từng người
      // Mỗi khoản dùng type 'debt_lend' (không phải 'expense')
      // -> không ảnh hưởng thống kê chi tiêu/thu nhập thật
      for (const m of members) {
        const amount = parseInt(m.amountStr, 10) || 0;
        await addDebt({
          type: 'lend',
          person_name: m.name.trim(),
          person_phone: m.phone.trim() || null,
          initial_amount: amount,
          wallet_id: selectedWalletId,
          due_date: new Date(Date.now() + 30 * 86400000).toISOString(),
          note: note.trim() ? `[Chia bill] ${note.trim()}` : '[Chia bill]',
        });
      }
      hapticSuccess();
      onClose();
    } catch (err: any) {
      hapticError();
      Alert.alert('Lỗi', err?.message || 'Không thể tạo chia bill');
    }
  };

  const selectedWallet = wallets.find(w => w.id === selectedWalletId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>✂️ Chia Bill</Text>
              <Text style={styles.headerSub}>Bạn trả trước, người khác trả lại sau</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={THEME.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* ── Wallet picker ── */}
            <Text style={styles.sectionLabel}>Trừ tiền từ ví nào</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {wallets.map(w => {
                const sel = selectedWalletId === w.id;
                return (
                  <Pressable
                    key={w.id}
                    style={[styles.chip, sel && styles.chipSelected]}
                    onPress={() => { hapticLight(); setSelectedWalletId(w.id); }}
                  >
                    <Ionicons name={(w.icon as any) || 'wallet-outline'} size={15} color={sel ? '#FACC15' : '#000'} />
                    <Text style={[styles.chipText, sel && styles.chipTextSelected]}>{w.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* ── Note ── */}
            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Ghi chú (tùy chọn)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ví dụ: Ăn tối sinh nhật Nam..."
              placeholderTextColor={THEME.textMuted}
              value={note}
              onChangeText={setNote}
            />

            {/* ── Total amount display ── */}
            <Pressable
              style={[styles.amountBox, activeInput === 'total' && styles.amountBoxActive]}
              onPress={() => setActiveInput('total')}
            >
              <Text style={styles.amountBoxLabel}>TỔNG TÔI ĐÃ TRẢ</Text>
              <Text style={[styles.amountBoxValue, { color: '#0F766E' }]}>
                {formatVND(totalAmount)}
              </Text>
              {selectedWallet && (
                <Text style={styles.amountBoxSub}>
                  Ví: {selectedWallet.name} · Số dư: {formatVND(selectedWallet.balance)}
                </Text>
              )}
            </Pressable>

            {/* ── Members ── */}
            <View style={styles.membersHeader}>
              <Text style={styles.sectionLabel}>Danh sách thành viên</Text>
              <Pressable style={styles.splitBtn} onPress={autoSplit}>
                <Ionicons name="calculator-outline" size={14} color="#000" />
                <Text style={styles.splitBtnText}>Chia đều</Text>
              </Pressable>
            </View>

            {members.map((m, idx) => {
              const isActiveMember = activeInput === m.key;
              const mAmount = parseInt(m.amountStr, 10) || 0;
              return (
                <View key={m.key} style={[styles.memberCard, isActiveMember && styles.memberCardActive]}>
                  <View style={styles.memberCardHeader}>
                    <Text style={styles.memberIdx}>#{idx + 1}</Text>
                    {members.length > 1 && (
                      <Pressable onPress={() => removeMember(m.key)}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </Pressable>
                    )}
                  </View>
                  <TextInput
                    style={styles.memberInput}
                    placeholder="Tên người (*)"
                    placeholderTextColor={THEME.textMuted}
                    value={m.name}
                    onChangeText={v => updateMemberField(m.key, 'name', v)}
                  />
                  <TextInput
                    style={styles.memberInput}
                    placeholder="Số điện thoại (tùy chọn)"
                    placeholderTextColor={THEME.textMuted}
                    keyboardType="phone-pad"
                    value={m.phone}
                    onChangeText={v => updateMemberField(m.key, 'phone', v)}
                  />
                  <Pressable
                    style={[styles.memberAmountBtn, isActiveMember && styles.memberAmountBtnActive]}
                    onPress={() => setActiveInput(m.key)}
                  >
                    <Text style={styles.memberAmountLabel}>Phần của họ</Text>
                    <Text style={[styles.memberAmountValue, { color: mAmount > 0 ? '#0F766E' : '#9CA3AF' }]}>
                      {formatVND(mAmount)}
                    </Text>
                    <Ionicons
                      name="keypad-outline"
                      size={14}
                      color={isActiveMember ? '#059669' : '#9CA3AF'}
                    />
                  </Pressable>
                </View>
              );
            })}

            <Pressable style={styles.addMemberBtn} onPress={addMember}>
              <Ionicons name="person-add-outline" size={16} color="#000" />
              <Text style={styles.addMemberText}>Thêm người</Text>
            </Pressable>

            {/* ── Summary bar ── */}
            <View style={styles.summaryBar}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryKey}>Tổng đã trả</Text>
                <Text style={[styles.summaryVal, { color: '#0F766E' }]}>{formatVND(totalAmount)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryKey}>Đã phân bổ</Text>
                <Text style={styles.summaryVal}>{formatVND(assignedTotal)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryKey}>Chưa phân bổ</Text>
                <Text style={[styles.summaryVal, { color: remaining !== 0 ? '#EF4444' : '#10B981' }]}>
                  {formatVND(remaining)}
                </Text>
              </View>
            </View>

            {/* ── Notice ── */}
            <View style={styles.noticeBox}>
              <Ionicons name="information-circle-outline" size={16} color="#0F766E" />
              <Text style={styles.noticeText}>
                Tiền chia bill dùng loại <Text style={{ fontWeight: '900' }}>Cho vay</Text> — không ảnh hưởng thống kê chi tiêu thật của bạn. Khi ai đó trả lại, thu nợ trong tab Sổ Nợ.
              </Text>
            </View>

            {/* ── Keypad ── */}
            <View style={styles.keypadWrap}>
              <Text style={styles.keypadLabel}>
                {activeInput === 'total'
                  ? 'Nhập: TỔNG TÔI ĐÃ TRẢ'
                  : `Nhập: Phần của ${activeMember?.name || 'thành viên'}`}
              </Text>
              <Text style={styles.keypadAmount}>{formatVND(activeAmount)}</Text>
              {[
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
                ['000', '0', 'DEL'],
              ].map((row, ri) => (
                <View key={ri} style={styles.keypadRow}>
                  {row.map(k => (
                    <Pressable
                      key={k}
                      style={({ pressed }) => [
                        styles.keypadBtn,
                        pressed && styles.keypadBtnPressed,
                        k === 'DEL' && styles.keypadDeleteBtn,
                      ]}
                      onPress={() => (k === 'DEL' ? pressBackspace() : pressDigit(k))}
                    >
                      {k === 'DEL'
                        ? <Ionicons name="backspace-outline" size={22} color="#EF4444" />
                        : <Text style={styles.keypadText}>{k}</Text>
                      }
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>

            {/* ── Submit ── */}
            <Pressable
              style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.9 }]}
              onPress={handleSubmit}
            >
              <Ionicons name="checkmark-sharp" size={22} color="#000" />
              <Text style={styles.submitText}>
                Xác nhận · Tạo {members.length} khoản nợ
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: THEME.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingBottom: 36,
    paddingHorizontal: 20,
    maxHeight: '92%',
    borderTopWidth: 3,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
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
    borderColor: '#000',
    backgroundColor: '#FFF',
  },
  body: { maxHeight: 600 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: { flexDirection: 'row', marginBottom: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#000',
  },
  chipSelected: { backgroundColor: '#000' },
  chipText: { fontSize: 13, fontWeight: '800', color: '#000' },
  chipTextSelected: { color: '#FFF' },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 4,
  },
  amountBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    marginBottom: 14,
    borderWidth: 2.5,
    borderColor: '#000',
    alignItems: 'center',
  },
  amountBoxActive: {
    borderColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  amountBoxLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 1,
    marginBottom: 4,
  },
  amountBoxValue: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  amountBoxSub: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginTop: 4,
  },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  splitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.popYellow,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  splitBtnText: { fontSize: 12, fontWeight: '800', color: '#000' },
  memberCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#000',
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
  memberCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberIdx: { fontSize: 12, fontWeight: '900', color: THEME.textSecondary },
  memberInput: {
    backgroundColor: '#FAF8F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  memberAmountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  memberAmountBtnActive: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  memberAmountLabel: { fontSize: 12, fontWeight: '800', color: THEME.textSecondary },
  memberAmountValue: { fontSize: 16, fontWeight: '900', flex: 1, textAlign: 'right', marginRight: 8 },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#000',
    borderStyle: 'dashed',
    marginBottom: 14,
  },
  addMemberText: { fontSize: 14, fontWeight: '800', color: '#000' },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000',
    overflow: 'hidden',
    marginBottom: 14,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  summaryKey: { fontSize: 10, fontWeight: '800', color: THEME.textSecondary, marginBottom: 2 },
  summaryVal: { fontSize: 13, fontWeight: '900', color: '#000' },
  keypadWrap: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 12,
    marginBottom: 14,
    borderWidth: 2.5,
    borderColor: '#000',
  },
  keypadLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  keypadAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F766E',
    textAlign: 'center',
    marginBottom: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  keypadBtn: {
    flex: 1,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
    backgroundColor: '#FAF8F5',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000',
  },
  keypadBtnPressed: { backgroundColor: THEME.popYellow },
  keypadDeleteBtn: { backgroundColor: '#FEE2E2' },
  keypadText: { fontSize: 18, fontWeight: '900', color: '#000' },
  noticeBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#059669',
    alignItems: 'flex-start',
  },
  noticeText: { fontSize: 12, fontWeight: '700', color: '#065F46', flex: 1, lineHeight: 18 },
  submitBtn: {
    flexDirection: 'row',
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.primary,
    borderWidth: 2.5,
    borderColor: '#000',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  submitText: { fontSize: 16, fontWeight: '900', color: '#000' },
});
