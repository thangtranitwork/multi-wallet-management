import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { Wallet, WalletType } from '../types';
import { THEME, WALLET_TYPES, WALLET_COLORS, WALLET_ICONS, formatVND } from '../constants';

interface WalletModalProps {
  visible: boolean;
  onClose: () => void;
  targetWallet?: Wallet | null;
  wallet?: Wallet | null;
  isAdjustMode?: boolean;
  mode?: 'create' | 'edit' | 'adjust';
}

export const WalletModal: React.FC<WalletModalProps> = ({
  visible,
  onClose,
  targetWallet = null,
  wallet = null,
  isAdjustMode = false,
  mode,
}) => {
  const { addWallet, editWallet, adjustBalance, removeWallet } = useWallet();

  const currentWallet = wallet || targetWallet || null;
  const isAdjust = mode === 'adjust' || isAdjustMode;

  const [name, setName] = useState<string>('');
  const [type, setType] = useState<WalletType>('bank');
  const [balanceStr, setBalanceStr] = useState<string>('0');
  const [creditLimitStr, setCreditLimitStr] = useState<string>('0');
  const [color, setColor] = useState<string>(WALLET_COLORS[0]);
  const [icon, setIcon] = useState<string>(WALLET_ICONS[0]);
  const [isExcluded, setIsExcluded] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');

  // Cho chế độ Điều chỉnh số dư
  const [adjustBalanceStr, setAdjustBalanceStr] = useState<string>('0');
  const [adjustNote, setAdjustNote] = useState<string>('');

  useEffect(() => {
    if (visible) {
      if (currentWallet) {
        if (isAdjust) {
          setAdjustBalanceStr(currentWallet.balance.toString());
          setAdjustNote('');
        } else {
          setName(currentWallet.name);
          setType(currentWallet.type);
          setBalanceStr(currentWallet.balance.toString());
          setCreditLimitStr((currentWallet.credit_limit || 0).toString());
          setColor(currentWallet.color || WALLET_COLORS[0]);
          setIcon(currentWallet.icon || WALLET_ICONS[0]);
          setIsExcluded(currentWallet.is_excluded === 1);
          setNote(currentWallet.note || '');
        }
      } else {
        setName('');
        setType('bank');
        setBalanceStr('0');
        setCreditLimitStr('0');
        setColor(WALLET_COLORS[1]);
        setIcon('business-outline');
        setIsExcluded(false);
        setNote('');
      }
    }
  }, [visible, currentWallet, isAdjust]);

  const handleSave = async () => {
    if (isAdjust && currentWallet) {
      const newBal = parseInt(adjustBalanceStr.replace(/[^0-9-]/g, ''), 10);
      if (isNaN(newBal)) {
        Alert.alert('Thiếu thông tin', 'Vui lòng nhập số dư thực tế mới hợp lệ');
        return;
      }
      try {
        await adjustBalance(currentWallet.id, newBal, adjustNote.trim());
        onClose();
      } catch (err: any) {
        Alert.alert('Lỗi', err?.message || 'Không thể điều chỉnh số dư');
      }
      return;
    }

    if (!name.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên nguồn tiền / ví');
      return;
    }

    const bal = parseInt(balanceStr.replace(/[^0-9-]/g, ''), 10) || 0;
    const limit = parseInt(creditLimitStr.replace(/[^0-9-]/g, ''), 10) || 0;

    try {
      if (currentWallet) {
        await editWallet({
          id: currentWallet.id,
          name: name.trim(),
          type,
          credit_limit: type === 'credit' ? limit : 0,
          color,
          icon,
          is_excluded: isExcluded ? 1 : 0,
          note: note.trim(),
        });
      } else {
        await addWallet({
          name: name.trim(),
          type,
          balance: bal,
          credit_limit: type === 'credit' ? limit : 0,
          currency: 'VND',
          color,
          icon,
          is_excluded: isExcluded ? 1 : 0,
          note: note.trim(),
        });
      }
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể lưu ví');
    }
  };

  const handleDelete = () => {
    if (!currentWallet) return;
    Alert.alert(
      'Xóa nguồn tiền',
      `Ngài có chắc chắn muốn xóa "${currentWallet.name}"? Toàn bộ giao dịch liên quan sẽ bị xóa.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            await removeWallet(currentWallet.id);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {isAdjust
                ? `Cân đối: ${currentWallet?.name}`
                : currentWallet
                ? 'Chỉnh sửa nguồn tiền'
                : 'Thêm nguồn tiền mới'}
            </Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={THEME.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {isAdjust && currentWallet ? (
              <>
                <View style={styles.adjustInfoBox}>
                  <Text style={styles.adjustLabel}>Số dư hiện tại trên sổ sách:</Text>
                  <Text style={styles.adjustCurrentVal}>{formatVND(currentWallet.balance)}</Text>
                  {(() => {
                    const parsedNew = parseInt(adjustBalanceStr.replace(/[^0-9-]/g, ''), 10);
                    if (isNaN(parsedNew)) return null;
                    const diff = parsedNew - currentWallet.balance;
                    if (diff === 0) {
                      return (
                        <View style={[styles.diffBadge, { backgroundColor: '#F3F4F6' }]}>
                          <Ionicons name="checkmark-circle-outline" size={16} color="#6B7280" />
                          <Text style={[styles.diffText, { color: '#6B7280' }]}>
                            Số dư không thay đổi
                          </Text>
                        </View>
                      );
                    }
                    const isIncrease = diff > 0;
                    return (
                      <View
                        style={[
                          styles.diffBadge,
                          { backgroundColor: isIncrease ? '#DCFCE7' : '#FEE2E2' },
                        ]}
                      >
                        <Ionicons
                          name={isIncrease ? 'arrow-up-circle' : 'arrow-down-circle'}
                          size={16}
                          color={isIncrease ? '#15803D' : '#E11D48'}
                        />
                        <Text
                          style={[
                            styles.diffText,
                            { color: isIncrease ? '#15803D' : '#E11D48' },
                          ]}
                        >
                          Chênh lệch: {isIncrease ? '+' : ''}{formatVND(diff)} ({isIncrease ? 'Ghi nhận tiền vào' : 'Ghi nhận hao hụt'})
                        </Text>
                      </View>
                    );
                  })()}
                </View>

                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionLabel}>Số dư thực tế mới (VNĐ) (*)</Text>
                  <TextInput
                    style={styles.inputLarge}
                    keyboardType="numeric"
                    value={adjustBalanceStr}
                    onChangeText={setAdjustBalanceStr}
                    placeholder="0"
                    placeholderTextColor={THEME.textMuted}
                    autoFocus={true}
                    selectTextOnFocus={true}
                  />
                </View>

                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionLabel}>Lý do điều chỉnh (tùy chọn)</Text>
                  <TextInput
                    style={styles.input}
                    value={adjustNote}
                    onChangeText={setAdjustNote}
                    placeholder="Ví dụ: Kiểm đếm tiền mặt, lãi phát sinh..."
                    placeholderTextColor={THEME.textMuted}
                  />
                </View>
              </>
            ) : (
              <>
                {/* Wallet Name */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionLabel}>Tên nguồn tiền / Ví (*)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ví dụ: Vietcombank, Ví tiền mặt, MoMo..."
                    placeholderTextColor={THEME.textMuted}
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                {/* Wallet Type */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionLabel}>Loại nguồn tiền</Text>
                  <View style={styles.typeGrid}>
                    {WALLET_TYPES.map(t => {
                      const isSelected = type === t.id;
                      return (
                        <Pressable
                          key={t.id}
                          style={[styles.typeItem, isSelected && styles.typeItemSelected]}
                          onPress={() => {
                            setType(t.id as WalletType);
                            setColor(t.defaultColor);
                            setIcon(t.icon);
                          }}
                        >
                          <Ionicons
                            name={(t.icon as any) || 'wallet-outline'}
                            size={18}
                            color={isSelected ? '#000000' : THEME.textSecondary}
                          />
                          <Text
                            style={[
                              styles.typeText,
                              isSelected && { color: '#000000', fontWeight: '900' },
                            ]}
                          >
                            {t.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Initial Balance (Only when create) */}
                {!currentWallet && (
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionLabel}>Số dư ban đầu (VNĐ)</Text>
                    <TextInput
                      style={styles.inputLarge}
                      keyboardType="numeric"
                      value={balanceStr}
                      onChangeText={setBalanceStr}
                      placeholder="0"
                      placeholderTextColor={THEME.textMuted}
                    />
                  </View>
                )}

                {/* Credit Limit (If Credit Card) */}
                {type === 'credit' && (
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionLabel}>Hạn mức thẻ tín dụng (VNĐ)</Text>
                    <TextInput
                      style={styles.inputLarge}
                      keyboardType="numeric"
                      value={creditLimitStr}
                      onChangeText={setCreditLimitStr}
                      placeholder="0"
                      placeholderTextColor={THEME.textMuted}
                    />
                  </View>
                )}

                {/* Color Palette */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionLabel}>Màu sắc đại diện</Text>
                  <View style={styles.colorPalette}>
                    {WALLET_COLORS.map(c => (
                      <Pressable
                        key={c}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: c },
                          color === c && styles.colorCircleSelected,
                        ]}
                        onPress={() => setColor(c)}
                      >
                        {color === c && (
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Icon Selection */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionLabel}>Biểu tượng Icon</Text>
                  <View style={styles.iconPalette}>
                    {WALLET_ICONS.map(ic => (
                      <Pressable
                        key={ic}
                        style={[styles.iconBox, icon === ic && styles.iconBoxSelected]}
                        onPress={() => setIcon(ic)}
                      >
                        <Ionicons
                          name={ic as any}
                          size={22}
                          color={icon === ic ? THEME.primary : THEME.textSecondary}
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Exclude from Net Worth Toggle */}
                <View style={styles.switchRow}>
                  <View style={styles.switchTextContainer}>
                    <Text style={styles.switchTitle}>Không tính vào Tổng tài sản</Text>
                    <Text style={styles.switchSubtitle}>
                      Bỏ qua ví này khi tính Tài sản ròng (Net Worth)
                    </Text>
                  </View>
                  <Switch
                    value={isExcluded}
                    onValueChange={setIsExcluded}
                    trackColor={{ false: THEME.surfaceLight, true: THEME.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Note */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionLabel}>Ghi chú</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ghi chú thêm về ví này..."
                    placeholderTextColor={THEME.textMuted}
                    value={note}
                    onChangeText={setNote}
                  />
                </View>
              </>
            )}

            {/* Action Buttons */}
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <Ionicons name="checkmark-sharp" size={20} color="#000000" />
              <Text style={styles.saveBtnText}>
                {isAdjust
                  ? 'Cập nhật số dư thực tế'
                  : currentWallet
                  ? 'Lưu thay đổi'
                  : 'Tạo nguồn tiền'}
              </Text>
            </Pressable>

            {currentWallet && !isAdjust && (
              <Pressable style={styles.deleteBtn} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={styles.deleteBtnText}>Xóa nguồn tiền này</Text>
              </Pressable>
            )}
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
    marginBottom: 16,
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
  scrollArea: {
    maxHeight: 520,
  },
  adjustInfoBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#000000',
  },
  adjustLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 4,
  },
  adjustCurrentVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
  },
  diffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    marginTop: 10,
  },
  diffText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sectionContainer: {
    marginBottom: 16,
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
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    borderWidth: 2,
    borderColor: '#000000',
  },
  inputLarge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
    borderWidth: 2,
    borderColor: '#000000',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
  },
  typeItemSelected: {
    borderColor: '#000000',
    backgroundColor: THEME.popYellow,
  },
  typeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  colorPalette: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  colorCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#000000',
    transform: [{ scale: 1.15 }],
  },
  iconPalette: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  iconBoxSelected: {
    borderColor: '#000000',
    backgroundColor: THEME.popYellow,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#000000',
  },
  switchTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 2,
  },
  switchSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveBtn: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: THEME.popYellow,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 2.5,
    borderColor: '#000000',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  deleteBtn: {
    flexDirection: 'row',
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
});
