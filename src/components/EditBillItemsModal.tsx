import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ReceiptItem, BillAdjustment } from '../types';
import { THEME, formatVND } from '../constants';
import { hapticLight, hapticMedium, hapticSuccess } from '../utils/haptics';
import { generateId } from '../utils/idGenerator';

export interface EditableItem {
  id: string;
  name: string;
  price: number;
  priceStr: string;
  quantity: number;
  assignedMemberIds?: string[];
  memberQuantities?: { [memberId: string]: number };
}

export interface EditableAdjustment {
  id: string;
  name: string;
  amount: number;
  amountStr: string;
  type: 'fee' | 'discount';
}

export interface EditBillItemsModalProps {
  visible: boolean;
  onClose: () => void;
  initialItems?: ReceiptItem[] | null;
  initialAdjustments?: BillAdjustment[] | null;
  targetAmount?: number;
  isSplitBill?: boolean;
  myShareAmount?: number;
  onSave: (
    newItems: ReceiptItem[],
    newAdjustments: BillAdjustment[],
    newTotal: number
  ) => void;
}

export const EditBillItemsModal: React.FC<EditBillItemsModalProps> = ({
  visible,
  onClose,
  initialItems,
  initialAdjustments,
  targetAmount,
  isSplitBill,
  myShareAmount,
  onSave,
}) => {
  const [items, setItems] = useState<EditableItem[]>([]);
  const [adjustments, setAdjustments] = useState<EditableAdjustment[]>([]);

  // Khởi tạo state khi mở modal
  useEffect(() => {
    if (visible) {
      const mappedItems: EditableItem[] = (initialItems || []).map((it) => ({
        id: it.id || generateId('item'),
        name: it.name || '',
        price: it.price || 0,
        priceStr: it.price ? it.price.toString() : '',
        quantity: Math.max(1, it.quantity || 1),
        assignedMemberIds: it.assignedMemberIds,
        memberQuantities: it.memberQuantities,
      }));

      const mappedAdjustments: EditableAdjustment[] = (initialAdjustments || []).map((adj) => ({
        id: adj.id || generateId('adj'),
        name: adj.name || '',
        amount: adj.amount || 0,
        amountStr: adj.amount ? adj.amount.toString() : '',
        type: adj.type || 'fee',
      }));

      setItems(mappedItems);
      setAdjustments(mappedAdjustments);
    }
  }, [visible, initialItems, initialAdjustments]);

  // Tính toán tổng tiền realtime
  const rawItemsSum = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 1), 0);
  }, [items]);

  const netAdjustments = useMemo(() => {
    return adjustments.reduce((sum, adj) => {
      const amt = adj.amount || 0;
      return sum + (adj.type === 'fee' ? amt : -amt);
    }, 0);
  }, [adjustments]);

  const calculatedTotal = useMemo(() => {
    return Math.max(0, rawItemsSum + netAdjustments);
  }, [rawItemsSum, netAdjustments]);

  const diffWithTarget = useMemo(() => {
    if (targetAmount === undefined || targetAmount === null) return 0;
    return calculatedTotal - targetAmount;
  }, [calculatedTotal, targetAmount]);

  // Các thao tác món (Item operations)
  const handleAddItem = () => {
    hapticLight();
    setItems(prev => [
      ...prev,
      {
        id: generateId('item'),
        name: '',
        price: 0,
        priceStr: '',
        quantity: 1,
      },
    ]);
  };

  const handleUpdateItemName = (id: string, name: string) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, name } : it)));
  };

  const handleUpdateItemPrice = (id: string, priceStr: string) => {
    const cleanDigits = priceStr.replace(/[^0-9]/g, '');
    const price = cleanDigits ? parseInt(cleanDigits, 10) : 0;
    setItems(prev =>
      prev.map(it => (it.id === id ? { ...it, price, priceStr: cleanDigits } : it))
    );
  };

  const handleChangeItemQty = (id: string, delta: number) => {
    hapticLight();
    setItems(prev =>
      prev.map(it => {
        if (it.id !== id) return it;
        const newQty = Math.max(1, (it.quantity || 1) + delta);
        return { ...it, quantity: newQty };
      })
    );
  };

  const handleDeleteItem = (id: string) => {
    hapticMedium();
    setItems(prev => prev.filter(it => it.id !== id));
  };

  // Các thao tác phí / voucher (Adjustment operations)
  const handleAddAdjustment = (type: 'fee' | 'discount') => {
    hapticLight();
    setAdjustments(prev => [
      ...prev,
      {
        id: generateId('adj'),
        name: type === 'fee' ? 'Phí dịch vụ' : 'Giảm giá',
        amount: 0,
        amountStr: '',
        type,
      },
    ]);
  };

  const handleUpdateAdjName = (id: string, name: string) => {
    setAdjustments(prev => prev.map(a => (a.id === id ? { ...a, name } : a)));
  };

  const handleUpdateAdjAmount = (id: string, amountStr: string) => {
    const cleanDigits = amountStr.replace(/[^0-9]/g, '');
    const amount = cleanDigits ? parseInt(cleanDigits, 10) : 0;
    setAdjustments(prev =>
      prev.map(a => (a.id === id ? { ...a, amount, amountStr: cleanDigits } : a))
    );
  };

  const handleToggleAdjType = (id: string) => {
    hapticLight();
    setAdjustments(prev =>
      prev.map(a =>
        a.id === id ? { ...a, type: a.type === 'fee' ? 'discount' : 'fee' } : a
      )
    );
  };

  const handleDeleteAdjustment = (id: string) => {
    hapticMedium();
    setAdjustments(prev => prev.filter(a => a.id !== id));
  };

  // Lưu thay đổi
  const handleSave = () => {
    hapticSuccess();
    const finalItems: ReceiptItem[] = items.map(it => ({
      id: it.id,
      name: it.name.trim() || 'Món không tên',
      price: it.price || 0,
      quantity: it.quantity || 1,
      assignedMemberIds: it.assignedMemberIds,
      memberQuantities: it.memberQuantities,
    }));

    const finalAdjustments: BillAdjustment[] = adjustments.map(a => ({
      id: a.id,
      name: a.name.trim() || (a.type === 'fee' ? 'Phí khác' : 'Voucher'),
      amount: a.amount || 0,
      type: a.type,
    }));

    onSave(finalItems, finalAdjustments, calculatedTotal);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="receipt-outline" size={20} color="#000000" />
              <Text style={styles.headerTitle}>Chỉnh Sửa Món & Phí</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Sửa đơn giá, số lượng hoặc bổ sung các món trong đơn
            </Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color="#000000" />
          </Pressable>
        </View>

        {/* Live Calculation Banner */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Tiền món ({items.length})</Text>
              <Text style={styles.summaryVal}>{formatVND(rawItemsSum)}</Text>
            </View>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Phí / Voucher</Text>
              <Text
                style={[
                  styles.summaryVal,
                  netAdjustments < 0 && { color: '#059669' },
                  netAdjustments > 0 && { color: '#2563EB' },
                ]}
              >
                {netAdjustments > 0 ? '+' : ''}
                {formatVND(netAdjustments)}
              </Text>
            </View>
            <View style={[styles.summaryCol, { alignItems: 'flex-end' }]}>
              <Text style={styles.summaryLabel}>Tổng tính toán</Text>
              <Text style={[styles.summaryVal, styles.summaryValTotal]}>
                {formatVND(calculatedTotal)}
              </Text>
            </View>
          </View>

          {targetAmount !== undefined && targetAmount !== null && (
            <View style={styles.targetDiffBox}>
              {Math.abs(diffWithTarget) <= 100 ? (
                <View style={[styles.diffBadge, styles.diffBadgeMatch]}>
                  <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                  <Text style={styles.diffBadgeTextMatch} numberOfLines={1}>
                    {isSplitBill
                      ? `Khớp hóa đơn gốc (${formatVND(targetAmount)}${myShareAmount !== undefined ? ` • Bạn trả: ${formatVND(myShareAmount)}` : ''})`
                      : `Khớp 100% với số tiền thanh toán (${formatVND(targetAmount)})`}
                  </Text>
                </View>
              ) : (
                <View style={[styles.diffBadge, styles.diffBadgeMismatch]}>
                  <Ionicons name="alert-circle" size={14} color="#92400E" />
                  <Text style={styles.diffBadgeTextMismatch} numberOfLines={1}>
                    {isSplitBill
                      ? `Lệch ${formatVND(Math.abs(diffWithTarget))} (Hóa đơn gốc: ${formatVND(targetAmount)})`
                      : `Lệch ${formatVND(Math.abs(diffWithTarget))} (GD: ${formatVND(targetAmount)})`}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Content list */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Section 1: Danh sách món */}
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="fast-food-outline" size={16} color="#000000" />
                <Text style={styles.sectionTitle}>
                  DANH SÁCH MÓN ({items.length})
                </Text>
              </View>
              <Pressable style={styles.addSmallBtn} onPress={handleAddItem}>
                <Ionicons name="add-circle" size={16} color="#000000" />
                <Text style={styles.addSmallBtnText}>Thêm món</Text>
              </Pressable>
            </View>

            {items.length === 0 ? (
              <View style={styles.emptyItemsBox}>
                <Text style={styles.emptyItemsText}>Chưa có món nào trong danh sách.</Text>
                <Pressable style={styles.addFirstBtn} onPress={handleAddItem}>
                  <Text style={styles.addFirstBtnText}>+ Thêm món đầu tiên</Text>
                </Pressable>
              </View>
            ) : (
              items.map((it, idx) => (
                <View key={it.id || idx} style={styles.itemCard}>
                  {/* Row 1: Tên món + nút xóa */}
                  <View style={styles.itemTopRow}>
                    <View style={styles.itemIndexBadge}>
                      <Text style={styles.itemIndexText}>{idx + 1}</Text>
                    </View>
                    <TextInput
                      style={styles.itemNameInput}
                      placeholder="Tên món ăn / sản phẩm..."
                      placeholderTextColor="#9CA3AF"
                      value={it.name}
                      onChangeText={val => handleUpdateItemName(it.id, val)}
                    />
                    <Pressable
                      style={styles.deleteItemBtn}
                      onPress={() => handleDeleteItem(it.id)}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={17} color="#DC2626" />
                    </Pressable>
                  </View>

                  {/* Row 2: Số lượng, Đơn giá, Thành tiền */}
                  <View style={styles.itemBottomRow}>
                    {/* Số lượng */}
                    <View style={styles.qtyContainer}>
                      <Text style={styles.fieldLabel}>SL</Text>
                      <View style={styles.qtyStepper}>
                        <Pressable
                          style={styles.qtyStepBtn}
                          onPress={() => handleChangeItemQty(it.id, -1)}
                        >
                          <Ionicons name="remove" size={14} color="#000000" />
                        </Pressable>
                        <Text style={styles.qtyValText}>{it.quantity || 1}</Text>
                        <Pressable
                          style={styles.qtyStepBtn}
                          onPress={() => handleChangeItemQty(it.id, 1)}
                        >
                          <Ionicons name="add" size={14} color="#000000" />
                        </Pressable>
                      </View>
                    </View>

                    {/* Đơn giá */}
                    <View style={styles.priceContainer}>
                      <Text style={styles.fieldLabel}>Đơn giá (₫)</Text>
                      <TextInput
                        style={styles.priceInput}
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={it.priceStr}
                        onChangeText={val => handleUpdateItemPrice(it.id, val)}
                      />
                    </View>

                    {/* Thành tiền */}
                    <View style={styles.totalItemContainer}>
                      <Text style={styles.fieldLabel}>Thành tiền</Text>
                      <Text style={styles.itemTotalVal}>
                        {formatVND((it.price || 0) * (it.quantity || 1))}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}

            {/* Section 2: Phí & Voucher */}
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="pricetags-outline" size={16} color="#000000" />
                <Text style={styles.sectionTitle}>
                  PHÍ & VOUCHER GIẢM GIÁ ({adjustments.length})
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable
                  style={styles.addAdjSmallBtn}
                  onPress={() => handleAddAdjustment('fee')}
                >
                  <Text style={styles.addAdjSmallBtnText}>+ Phí</Text>
                </Pressable>
                <Pressable
                  style={[styles.addAdjSmallBtn, { backgroundColor: '#DCFCE7' }]}
                  onPress={() => handleAddAdjustment('discount')}
                >
                  <Text style={[styles.addAdjSmallBtnText, { color: '#15803D' }]}>
                    - Voucher
                  </Text>
                </Pressable>
              </View>
            </View>

            {adjustments.length === 0 ? (
              <View style={styles.emptyAdjBox}>
                <Text style={styles.emptyItemsText}>
                  Không có phụ phí hoặc voucher giảm giá.
                </Text>
              </View>
            ) : (
              adjustments.map((adj, idx) => {
                const isFee = adj.type === 'fee';
                return (
                  <View key={adj.id || idx} style={styles.adjCard}>
                    {/* Switch type */}
                    <Pressable
                      style={[
                        styles.adjTypeToggle,
                        { backgroundColor: isFee ? '#DBEAFE' : '#DCFCE7' },
                      ]}
                      onPress={() => handleToggleAdjType(adj.id)}
                    >
                      <Text
                        style={[
                          styles.adjTypeToggleText,
                          { color: isFee ? '#1D4ED8' : '#15803D' },
                        ]}
                      >
                        {isFee ? '+ Phí' : '- Voucher'}
                      </Text>
                    </Pressable>

                    {/* Name */}
                    <TextInput
                      style={styles.adjNameInput}
                      placeholder={isFee ? 'Tên phí...' : 'Tên voucher...'}
                      placeholderTextColor="#9CA3AF"
                      value={adj.name}
                      onChangeText={val => handleUpdateAdjName(adj.id, val)}
                    />

                    {/* Amount */}
                    <TextInput
                      style={[
                        styles.adjAmountInput,
                        { color: isFee ? '#1D4ED8' : '#15803D' },
                      ]}
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={adj.amountStr}
                      onChangeText={val => handleUpdateAdjAmount(adj.id, val)}
                    />

                    {/* Delete */}
                    <Pressable
                      style={styles.deleteAdjBtn}
                      onPress={() => handleDeleteAdjustment(adj.id)}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    </Pressable>
                  </View>
                );
              })
            )}

            <View style={{ height: 120 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Bottom Fixed Action Bar */}
        <View style={styles.bottomBar}>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
          </Pressable>

          <Pressable style={styles.saveBtnShadow} onPress={handleSave}>
            <View style={styles.saveBtnInner}>
              <Ionicons name="checkmark-done" size={18} color="#000000" />
              <Text style={styles.saveBtnText}>
                Lưu thay đổi • {formatVND(calculatedTotal)}
              </Text>
            </View>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  summaryBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: '#E5E7EB',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCol: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  summaryValTotal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
  },
  targetDiffBox: {
    marginTop: 8,
  },
  diffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  diffBadgeMatch: {
    backgroundColor: '#DCFCE7',
    borderColor: '#15803D',
  },
  diffBadgeTextMatch: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  diffBadgeMismatch: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  diffBadgeTextMismatch: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#374151',
    letterSpacing: 0.5,
  },
  addSmallBtn: {
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
  addSmallBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
  },
  addAdjSmallBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  addAdjSmallBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1D4ED8',
  },
  emptyItemsBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyAdjBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  emptyItemsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  addFirstBtn: {
    marginTop: 8,
    backgroundColor: THEME.popYellow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  addFirstBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  itemIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIndexText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
  },
  itemNameInput: {
    flex: 1,
    height: 38,
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  deleteItemBtn: {
    padding: 4,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  qtyContainer: {
    width: 90,
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    height: 38,
  },
  qtyStepBtn: {
    width: 26,
    height: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: '900',
    color: '#000000',
    includeFontPadding: false,
  },
  priceContainer: {
    flex: 1,
  },
  priceInput: {
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 0,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#000000',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  totalItemContainer: {
    width: 85,
    alignItems: 'flex-end',
  },
  itemTotalVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    lineHeight: 38,
  },
  adjCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
  },
  adjTypeToggle: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
  },
  adjTypeToggleText: {
    fontSize: 11,
    fontWeight: '900',
  },
  adjNameInput: {
    flex: 1,
    height: 36,
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 8,
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  adjAmountInput: {
    width: 85,
    height: 36,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 0,
    textAlign: 'right',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  deleteAdjBtn: {
    padding: 4,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderTopColor: '#000000',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#000000',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#374151',
  },
  saveBtnShadow: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.popYellow,
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
});
