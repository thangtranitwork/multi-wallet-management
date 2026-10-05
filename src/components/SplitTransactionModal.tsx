import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCustomAlert } from './CustomAlertModal';
import dayjs from 'dayjs';
import { useWallet } from '../context/WalletContext';
import {
  Transaction,
  BillMember,
  BillItem,
  BillAdjustment,
  BillMemberShare,
} from '../types';
import { THEME, formatVND } from '../constants';
import { hapticLight, hapticSuccess, hapticError } from '../utils/haptics';
import { calculateItemizedBillShares } from '../utils/splitBillCalculator';
import { ContactPickerSheet } from './ContactPickerSheet';
import { ErrorBoundary } from './ErrorBoundary';

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
  const { categories, splitTransaction, updateTransactionCategory } = useWallet();
  const { showAlert, AlertModalComponent } = useCustomAlert(false);

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<'itemized' | 'quick'>('itemized');
  const [isChangingCat, setIsChangingCat] = useState<boolean>(false);

  // ── Contact Picker State ──
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactPickerTarget, setContactPickerTarget] = useState<'itemized' | string>('itemized');

  // ==================== TAB 1: CHIA THEO MÓN (ITEMIZED) ====================
  const [billMembers, setBillMembers] = useState<BillMember[]>([
    { id: 'me', name: 'Tôi (Chủ chi)', isPayer: true },
  ]);

  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [billAdjustments, setBillAdjustments] = useState<BillAdjustment[]>([]);

  // Form thêm món mới inline
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');

  // Form thêm adjustment inline
  const [showAddAdjustment, setShowAddAdjustment] = useState(false);
  const [adjType, setAdjType] = useState<'fee' | 'discount'>('fee');
  const [adjName, setAdjName] = useState('');
  const [adjAmount, setAdjAmount] = useState('');

  // ==================== TAB 2: CHIA NHANH (QUICK AMOUNT) ====================
  const [quickMembers, setQuickMembers] = useState<MemberSplit[]>([
    { id: '1', name: '', phone: '', amountStr: '0', note: '' },
  ]);
  const [activeInputId, setActiveInputId] = useState<string>('1');

  // Khởi tạo state khi mở modal
  useEffect(() => {
    if (visible && transaction) {
      // 1. Khởi tạo Quick Split
      const half = Math.floor(transaction.amount / 2);
      setQuickMembers([
        {
          id: '1',
          name: '',
          phone: '',
          amountStr: half.toString(),
          note: '',
        },
      ]);
      setActiveInputId('1');
      setIsChangingCat(false);

      // 2. Khởi tạo Itemized Split
      const defaultPayer: BillMember = { id: 'me', name: 'Tôi (Chủ chi)', isPayer: true };
      setBillMembers([defaultPayer]);
      setBillAdjustments([]);
      setNewItemName('');
      setNewItemPrice('');
      setNewItemQty('1');
      setShowAddAdjustment(false);

      // Kiểm tra xem transaction đã có items lưu từ trước không
      if (transaction.items) {
        try {
          const parsed = JSON.parse(transaction.items);
          if (Array.isArray(parsed)) {
            // Danh sách items đơn thuần
            setBillItems(
              parsed.map((it: any, idx: number) => ({
                id: it.id || `item_${idx}_${Date.now()}`,
                name: it.name || `Món #${idx + 1}`,
                quantity: Math.max(1, Number(it.quantity) || 1),
                price: Math.max(0, Number(it.price) || 0),
                assignedMemberIds: Array.isArray(it.assignedMemberIds) && it.assignedMemberIds.length > 0
                  ? it.assignedMemberIds
                  : ['me'],
              }))
            );
          } else if (parsed && typeof parsed === 'object') {
            const hasCustomMembers = Array.isArray(parsed.members) && parsed.members.length > 0;
            const validMembers: BillMember[] = hasCustomMembers ? parsed.members : [defaultPayer];
            setBillMembers(validMembers);

            const validMemberIds = validMembers.map((m: BillMember) => m.id);

            if (Array.isArray(parsed.items)) {
              setBillItems(
                parsed.items.map((it: any, idx: number) => {
                  const rawAssigned = Array.isArray(it.assignedMemberIds) ? it.assignedMemberIds : [];
                  const assignedMemberIds = rawAssigned.length > 0
                    ? rawAssigned.filter((mid: string) => validMemberIds.includes(mid))
                    : validMemberIds;

                  return {
                    id: it.id || `item_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    name: it.name || `Món #${idx + 1}`,
                    quantity: Math.max(1, Number(it.quantity) || 1),
                    price: Math.max(0, Number(it.price) || 0),
                    assignedMemberIds: assignedMemberIds.length > 0 ? assignedMemberIds : ['me'],
                  };
                })
              );
            }
            if (Array.isArray(parsed.adjustments)) {
              setBillAdjustments(
                parsed.adjustments.map((adj: any, idx: number) => ({
                  id: adj.id || `adj_${idx}_${Date.now()}`,
                  type: adj.type === 'discount' ? 'discount' : 'fee',
                  name: adj.name || (adj.type === 'discount' ? 'Giảm giá' : 'Phụ phí'),
                  amount: Math.max(0, Number(adj.amount) || 0),
                }))
              );
            }
          }
        } catch (parseErr) {
          console.warn('[SplitModal] Lỗi phân tích items JSON:', parseErr);
          setBillItems([]);
        }
      } else {
        // Mặc định tạo 1 món tương đương giao dịch gốc để người dùng dễ chỉnh sửa
        setBillItems([
          {
            id: `item_init_${Date.now()}`,
            name: transaction.note?.trim() || transaction.category_name || 'Món chính',
            quantity: 1,
            price: transaction.amount,
            assignedMemberIds: ['me'],
          },
        ]);
      }
    }
  }, [visible, transaction]);

  const totalAmount = transaction?.amount || 0;

  // ── Tính toán cho Tab Itemized ──
  const calcResult = useMemo(() => {
    if (!transaction) {
      return {
        shares: [],
        itemsSum: 0,
        adjustmentsSum: 0,
        calculatedTotal: 0,
        diffWithTransaction: 0,
        unassignedItemsCount: 0,
      };
    }
    return calculateItemizedBillShares(
      totalAmount,
      billMembers,
      billItems,
      billAdjustments
    );
  }, [transaction, totalAmount, billMembers, billItems, billAdjustments]);

  // ── Tính toán cho Tab Quick ──
  const totalQuickSplit = quickMembers.reduce(
    (sum, m) => sum + (parseInt(m.amountStr, 10) || 0),
    0
  );
  const remainingForMeQuick = totalAmount - totalQuickSplit;

  if (!transaction) return null;

  // ==================== ITEM MANAGEMENT ====================
  const handleAddItem = () => {
    const name = newItemName.trim();
    const price = parseInt(newItemPrice.replace(/\D/g, ''), 10) || 0;
    const qty = parseInt(newItemQty.replace(/\D/g, ''), 10) || 1;

    if (!name) {
      hapticError();
      showAlert('Thiếu tên món', 'Vui lòng nhập tên món ăn / dịch vụ');
      return;
    }
    if (price <= 0) {
      hapticError();
      showAlert('Giá không hợp lệ', 'Vui lòng nhập đơn giá lớn hơn 0');
      return;
    }

    hapticSuccess();
    const newItem: BillItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      quantity: Math.max(1, qty),
      price,
      // Mặc định gán cho tất cả thành viên hiện có
      assignedMemberIds: billMembers.map(m => m.id),
    };

    setBillItems(prev => [...prev, newItem]);
    setNewItemName('');
    setNewItemPrice('');
    setNewItemQty('1');
  };

  const handleRemoveItem = (itemId: string) => {
    hapticLight();
    setBillItems(prev => prev.filter(it => it.id !== itemId));
  };

  const toggleMemberForItem = (itemId: string, memberId: string) => {
    hapticLight();
    setBillItems(prev =>
      prev.map(it => {
        if (it.id !== itemId) return it;
        const currentAssigned = it.assignedMemberIds || [];
        const exists = currentAssigned.includes(memberId);
        const nextIds = exists
          ? currentAssigned.filter(id => id !== memberId)
          : [...currentAssigned, memberId];
        return { ...it, assignedMemberIds: nextIds };
      })
    );
  };

  const handleAssignAllForItem = (itemId: string) => {
    hapticLight();
    setBillItems(prev =>
      prev.map(it => {
        if (it.id !== itemId) return it;
        const allIds = billMembers.map(m => m.id);
        const currentAssigned = it.assignedMemberIds || [];
        const isAllSelected = allIds.length > 0 && allIds.every(id => currentAssigned.includes(id));
        return {
          ...it,
          assignedMemberIds: isAllSelected ? ['me'] : allIds,
        };
      })
    );
  };

  // ==================== ADJUSTMENT MANAGEMENT ====================
  const handleAddAdjustment = () => {
    const name = adjName.trim();
    const amount = parseInt(adjAmount.replace(/\D/g, ''), 10) || 0;

    if (!name) {
      hapticError();
      showAlert('Thiếu tên', 'Vui lòng nhập tên loại phí hoặc giảm giá');
      return;
    }
    if (amount <= 0) {
      hapticError();
      showAlert('Số tiền không hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0');
      return;
    }

    hapticSuccess();
    const newAdj: BillAdjustment = {
      id: `adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: adjType,
      name,
      amount,
    };
    setBillAdjustments(prev => [...prev, newAdj]);
    setAdjName('');
    setAdjAmount('');
    setShowAddAdjustment(false);
  };

  const handleRemoveAdjustment = (id: string) => {
    hapticLight();
    setBillAdjustments(prev => prev.filter(a => a.id !== id));
  };

  // ==================== CONTACT SELECTION ====================
  const handleOpenContactPickerFor = (target: 'itemized' | string) => {
    hapticLight();
    setContactPickerTarget(target);
    setShowContactPicker(true);
  };

  const handleContactSelected = (contact: { name: string; phone?: string | null }) => {
    if (contactPickerTarget === 'itemized') {
      // Thêm 1 người vào billMembers
      const exists = billMembers.some(
        m => m.name.toLowerCase() === contact.name.toLowerCase()
      );
      if (exists) {
        showAlert('Đã có trong danh sách', `${contact.name} đã được thêm vào đơn.`);
        return;
      }
      const newMember: BillMember = {
        id: `member_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: contact.name,
        phone: contact.phone,
        isPayer: false,
      };
      setBillMembers(prev => [...prev, newMember]);
    } else {
      // Gán cho quickMember cụ thể
      setQuickMembers(prev =>
        prev.map(m =>
          m.id === contactPickerTarget
            ? { ...m, name: contact.name, phone: contact.phone || '' }
            : m
        )
      );
    }
  };

  const handleMultiContactsSelected = (contacts: Array<{ name: string; phone?: string | null }>) => {
    if (contactPickerTarget === 'itemized') {
      const existingNames = new Set(billMembers.map(m => m.name.toLowerCase()));
      const newMembers: BillMember[] = [];

      contacts.forEach((c, idx) => {
        if (!existingNames.has(c.name.toLowerCase())) {
          newMembers.push({
            id: `member_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            name: c.name,
            phone: c.phone,
            isPayer: false,
          });
          existingNames.add(c.name.toLowerCase());
        }
      });

      if (newMembers.length > 0) {
        setBillMembers(prev => [...prev, ...newMembers]);
      }
    }
  };

  const handleRemoveBillMember = (memberId: string) => {
    hapticLight();
    if (memberId === 'me') return; // Không được xóa chủ chi
    setBillMembers(prev => prev.filter(m => m.id !== memberId));
    // Gỡ memberId khỏi tất cả billItems
    setBillItems(prev =>
      prev.map(it => ({
        ...it,
        assignedMemberIds: (it.assignedMemberIds || []).filter(id => id !== memberId),
      }))
    );
  };

  // ==================== SUBMIT: CHIA THEO MÓN ====================
  const handleConfirmItemized = async () => {
    const othersWithShare = calcResult.shares.filter(
      s => !s.isPayer && s.finalAmount > 0
    );

    if (othersWithShare.length === 0) {
      hapticError();
      showAlert(
        'Chưa có người cùng chia',
        'Vui lòng thêm bạn bè và phân bổ món ăn trước khi xác nhận tách đơn.'
      );
      return;
    }

    try {
      const splits = othersWithShare.map(s => {
        const userItems = billItems
          .filter(it => (it.assignedMemberIds || []).includes(s.memberId))
          .map(it => `${it.name}${it.quantity > 1 ? ` (x${it.quantity})` : ''}`)
          .join(', ');

        return {
          personName: s.memberName,
          personPhone: s.memberPhone,
          amount: s.finalAmount,
          itemsSummary: userItems || 'Chia đều món & chi phí',
        };
      });

      const serializedBill = JSON.stringify({
        items: billItems,
        adjustments: billAdjustments,
        members: billMembers,
      });

      await splitTransaction(transaction.id, splits, serializedBill);
      hapticSuccess();

      const payerShare = calcResult.shares.find(s => s.isPayer)?.finalAmount || 0;
      const totalSplitOthers = splits.reduce((sum, s) => sum + s.amount, 0);

      showAlert(
        'Tách đơn theo món thành công',
        `Đã tạo ${splits.length} khoản nợ cho bạn bè với tổng cộng ${formatVND(totalSplitOthers)}.\nPhần chi tiêu của bạn là ${formatVND(payerShare)}.`,
        () => onClose()
      );
    } catch (err: any) {
      hapticError();
      showAlert('Lỗi', err?.message || 'Không thể tách đơn theo món');
    }
  };

  // ==================== KEYPAD: CHIA NHANH ====================
  const handleDigitPress = (digit: string) => {
    hapticLight();
    setQuickMembers(prev =>
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
    setQuickMembers(prev =>
      prev.map(m => {
        if (m.id !== activeInputId) return m;
        const nextStr = m.amountStr.length <= 1 ? '0' : m.amountStr.slice(0, -1);
        return { ...m, amountStr: nextStr };
      })
    );
  };

  const handlePresetSplit = (percentage: number) => {
    hapticLight();
    const splitVal = Math.floor((totalAmount * percentage) / 100);
    setQuickMembers(prev =>
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
    const count = quickMembers.length + 1;
    const each = Math.floor(totalAmount / count);
    setQuickMembers(prev =>
      prev.map(m => ({ ...m, amountStr: each.toString() }))
    );
  };

  const addQuickMember = () => {
    hapticLight();
    const newId = Date.now().toString();
    setQuickMembers(prev => [
      ...prev,
      { id: newId, name: '', phone: '', amountStr: '0', note: '' },
    ]);
    setActiveInputId(newId);
  };

  const removeQuickMember = (id: string) => {
    hapticLight();
    if (quickMembers.length <= 1) return;
    setQuickMembers(prev => prev.filter(m => m.id !== id));
    if (activeInputId === id) {
      setActiveInputId(quickMembers[0].id);
    }
  };

  const updateQuickMember = (id: string, field: keyof MemberSplit, val: string) => {
    setQuickMembers(prev =>
      prev.map(m => (m.id === id ? { ...m, [field]: val } : m))
    );
  };

  const handleConfirmQuick = async () => {
    if (totalQuickSplit <= 0) {
      hapticError();
      showAlert('Chưa nhập số tiền', 'Vui lòng nhập số tiền tách cho người khác');
      return;
    }

    if (totalQuickSplit > totalAmount) {
      hapticError();
      showAlert(
        'Vượt quá số tiền gốc',
        `Tổng tiền tách (${formatVND(totalQuickSplit)}) không được vượt quá số tiền giao dịch gốc (${formatVND(totalAmount)})`
      );
      return;
    }

    for (const m of quickMembers) {
      const amt = parseInt(m.amountStr, 10) || 0;
      if (amt > 0 && !m.name.trim()) {
        hapticError();
        showAlert('Thiếu tên người', 'Vui lòng nhập tên cho người nhận phần nợ này');
        return;
      }
    }

    try {
      const validSplits = quickMembers
        .filter(m => (parseInt(m.amountStr, 10) || 0) > 0 && m.name.trim())
        .map(m => ({
          personName: m.name.trim(),
          personPhone: m.phone.trim() || null,
          amount: parseInt(m.amountStr, 10) || 0,
          note: m.note.trim() || undefined,
        }));

      await splitTransaction(transaction.id, validSplits);
      hapticSuccess();
      showAlert(
        'Tách tiền thành công',
        `Đã chuyển ${formatVND(totalQuickSplit)} thành khoản nợ trong Sổ nợ.\nChi tiêu của bạn cho giao dịch này giảm còn ${formatVND(remainingForMeQuick)}.`,
        () => onClose()
      );
    } catch (err: any) {
      hapticError();
      showAlert('Lỗi', err?.message || 'Không thể tách giao dịch');
    }
  };

  const activeQuickMember = quickMembers.find(m => m.id === activeInputId) || quickMembers[0];
  const activeQuickAmount = parseInt(activeQuickMember?.amountStr || '0', 10);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <ErrorBoundary fallbackTitle="Lỗi giao diện Tách tiền & Chia đơn" onReset={onClose}>
          <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Tách Tiền & Chia Đơn
              </Text>
              <Text style={styles.headerSub}>
                Chuyển một phần chi tiêu thành khoản người khác nợ
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={THEME.text} />
            </Pressable>
          </View>

          {/* Original Transaction Summary Card */}
          <View style={styles.origCard}>
            <View style={styles.origTopRow}>
              <View
                style={[
                  styles.origIconBox,
                  { backgroundColor: transaction.category_color || THEME.popPink },
                ]}
              >
                <Ionicons
                  name={(transaction.category_icon as any) || 'cart-outline'}
                  size={20}
                  color="#000000"
                />
              </View>
              <View style={styles.origInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.origTitle} numberOfLines={1}>
                    {transaction.category_name || 'Chi tiêu'}
                  </Text>
                  <Pressable
                    style={styles.origCatEditBtn}
                    onPress={() => {
                      hapticLight();
                      setIsChangingCat(!isChangingCat);
                    }}
                  >
                    <Text style={styles.origCatEditText}>{isChangingCat ? 'Đóng' : 'Đổi'}</Text>
                  </Pressable>
                </View>
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

            {isChangingCat && (
              <View style={styles.catPickerWrapper}>
                <Text style={styles.catPickerTitle}>Chọn danh mục mới:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catPickerScroll}>
                  {categories
                    .filter(c => c.type === 'expense')
                    .map(c => {
                      const isSel = transaction.category_id === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          style={[styles.catPickerChip, isSel && styles.catPickerChipSelected]}
                          onPress={async () => {
                            hapticLight();
                            try {
                              await updateTransactionCategory(transaction.id, c.id);
                              hapticSuccess();
                              setIsChangingCat(false);
                            } catch (e: any) {
                              hapticError();
                              showAlert('Lỗi', e?.message || 'Không thể đổi danh mục');
                            }
                          }}
                        >
                          <View style={[styles.catPickerIconBox, { backgroundColor: c.color || THEME.primary }]}>
                            <Ionicons name={(c.icon as any) || 'pricetag-outline'} size={13} color="#000000" />
                          </View>
                          <Text style={[styles.catPickerText, isSel && styles.catPickerTextSelected]}>
                            {c.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                </ScrollView>
              </View>
            )}

            {transaction.note ? (
              <View style={styles.origNoteRow}>
                <Ionicons name="chatbubble-outline" size={13} color="#6B7280" />
                <Text style={styles.origNoteText} numberOfLines={2}>
                  {transaction.note}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Mode Tabs: Chia theo món vs Chia nhanh */}
          <View style={styles.tabContainer}>
            <Pressable
              style={[styles.modeTab, activeTab === 'itemized' && styles.modeTabActive]}
              onPress={() => {
                hapticLight();
                setActiveTab('itemized');
              }}
            >
              <Ionicons
                name="restaurant"
                size={16}
                color={activeTab === 'itemized' ? '#000000' : THEME.textSecondary}
              />
              <Text
                style={[
                  styles.modeTabText,
                  activeTab === 'itemized' && styles.modeTabTextActive,
                ]}
              >
                Chia theo món
              </Text>
            </Pressable>

            <Pressable
              style={[styles.modeTab, activeTab === 'quick' && styles.modeTabActive]}
              onPress={() => {
                hapticLight();
                setActiveTab('quick');
              }}
            >
              <Ionicons
                name="flash"
                size={16}
                color={activeTab === 'quick' ? '#000000' : THEME.textSecondary}
              />
              <Text
                style={[
                  styles.modeTabText,
                  activeTab === 'quick' && styles.modeTabTextActive,
                ]}
              >
                Chia nhanh
              </Text>
            </Pressable>
          </View>

          {/* Scroll Content based on Active Tab */}
          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {activeTab === 'itemized' ? (
              // ==================== TAB 1: CHIA THEO MÓN ====================
              <View style={{ paddingBottom: 20 }}>
                {/* 1. Danh sách người tham gia */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>NGƯỜI THAM GIA ({billMembers.length})</Text>
                  <Pressable
                    style={styles.addMemberHeaderBtn}
                    onPress={() => handleOpenContactPickerFor('itemized')}
                  >
                    <Ionicons name="person-add" size={13} color="#000000" />
                    <Text style={styles.addMemberHeaderText}>+ Thêm bạn</Text>
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.membersChipScroll}
                >
                  {billMembers.map(m => {
                    const isPayer = m.isPayer;
                    return (
                      <View
                        key={m.id}
                        style={[
                          styles.memberPill,
                          isPayer && styles.memberPillPayer,
                        ]}
                      >
                        <Ionicons
                          name={isPayer ? 'card' : 'person'}
                          size={13}
                          color="#000000"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.memberPillText} numberOfLines={1}>
                          {m.name}
                        </Text>
                        {!isPayer && (
                          <Pressable
                            style={styles.memberPillClose}
                            onPress={() => handleRemoveBillMember(m.id)}
                            hitSlop={6}
                          >
                            <Ionicons name="close" size={13} color="#000000" />
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>

                {/* 2. Danh sách các món ăn */}
                <View style={[styles.sectionHeader, { marginTop: 14 }]}>
                  <Text style={styles.sectionTitle}>
                    DANH SÁCH MÓN ({billItems.length})
                  </Text>
                  <Text style={styles.sectionSubtitleText}>
                    Tổng món: {formatVND(calcResult.itemsSum)}
                  </Text>
                </View>

                {billItems.map((item, idx) => {
                  const itemTotal = item.price * item.quantity;
                  const currentAssigned = item.assignedMemberIds || [];
                  const allSelected =
                    billMembers.length > 0 &&
                    billMembers.every(m => currentAssigned.includes(m.id));

                  return (
                    <View key={item.id || `item_${idx}`} style={styles.itemCard}>
                      <View style={styles.itemCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>
                            #{idx + 1} {item.name}
                          </Text>
                          <Text style={styles.itemPriceMeta}>
                            {formatVND(item.price)} × {item.quantity} ={' '}
                            <Text style={{ fontWeight: '900', color: '#000000' }}>
                              {formatVND(itemTotal)}
                            </Text>
                          </Text>
                        </View>
                        <Pressable
                          style={styles.deleteItemBtn}
                          onPress={() => handleRemoveItem(item.id)}
                          hitSlop={8}
                        >
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </Pressable>
                      </View>

                      {/* Phân bổ người ăn món này */}
                      <View style={styles.itemAssignRow}>
                        <Text style={styles.assignLabel}>Ai dùng món này:</Text>
                        <Pressable
                          style={[
                            styles.allToggleBtn,
                            allSelected && styles.allToggleBtnActive,
                          ]}
                          onPress={() => handleAssignAllForItem(item.id)}
                        >
                          <Text
                            style={[
                              styles.allToggleText,
                              allSelected && styles.allToggleTextActive,
                            ]}
                          >
                            Tất cả
                          </Text>
                        </Pressable>
                      </View>

                      <View style={styles.memberTagWrap}>
                        {billMembers.map(m => {
                          const isAssigned = currentAssigned.includes(m.id);
                          return (
                            <Pressable
                              key={m.id}
                              style={[
                                styles.memberTag,
                                isAssigned && styles.memberTagActive,
                              ]}
                              onPress={() => toggleMemberForItem(item.id, m.id)}
                            >
                              <Ionicons
                                name={isAssigned ? 'checkmark-circle' : 'ellipse-outline'}
                                size={14}
                                color={isAssigned ? '#000000' : THEME.textMuted}
                              />
                              <Text
                                style={[
                                  styles.memberTagText,
                                  isAssigned && styles.memberTagTextActive,
                                ]}
                              >
                                {m.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}

                {/* Form thêm món mới */}
                <View style={styles.addDishBox}>
                  <Text style={styles.addDishTitle}>+ Thêm món mới vào đơn</Text>
                  <View style={styles.addDishInputs}>
                    <TextInput
                      style={[styles.input, { flex: 2 }]}
                      placeholder="Tên món (*)"
                      placeholderTextColor={THEME.textMuted}
                      value={newItemName}
                      onChangeText={setNewItemName}
                    />
                    <TextInput
                      style={[styles.input, { flex: 1.5 }]}
                      placeholder="Giá (*)"
                      placeholderTextColor={THEME.textMuted}
                      keyboardType="numeric"
                      value={newItemPrice}
                      onChangeText={setNewItemPrice}
                    />
                    <TextInput
                      style={[styles.input, { width: 44, textAlign: 'center' }]}
                      placeholder="SL"
                      placeholderTextColor={THEME.textMuted}
                      keyboardType="numeric"
                      value={newItemQty}
                      onChangeText={setNewItemQty}
                    />
                  </View>
                  <Pressable style={styles.addDishSubmitBtn} onPress={handleAddItem}>
                    <Ionicons name="add-circle" size={16} color="#000000" />
                    <Text style={styles.addDishSubmitText}>Thêm món</Text>
                  </Pressable>
                </View>

                {/* 3. Phụ phí & Giảm giá (Chia đều theo đầu người) */}
                <View style={[styles.sectionHeader, { marginTop: 14 }]}>
                  <View>
                    <Text style={styles.sectionTitle}>PHÍ SHIP & VOUCHER</Text>
                    <Text style={styles.subtextMuted}>Mặc định chia đều theo đầu người</Text>
                  </View>
                  {!showAddAdjustment && (
                    <Pressable
                      style={styles.addAdjHeaderBtn}
                      onPress={() => setShowAddAdjustment(true)}
                    >
                      <Ionicons name="add" size={13} color="#000000" />
                      <Text style={styles.addAdjHeaderText}>+ Thêm phí / voucher</Text>
                    </Pressable>
                  )}
                </View>

                {billAdjustments.map(adj => (
                  <View key={adj.id} style={styles.adjRow}>
                    <View
                      style={[
                        styles.adjBadge,
                        adj.type === 'fee' ? styles.adjBadgeFee : styles.adjBadgeDiscount,
                      ]}
                    >
                      <Text style={styles.adjBadgeText}>
                        {adj.type === 'fee' ? 'Phí' : 'Voucher'}
                      </Text>
                    </View>
                    <Text style={styles.adjName} numberOfLines={1}>
                      {adj.name}
                    </Text>
                    <Text
                      style={[
                        styles.adjAmount,
                        adj.type === 'discount' && { color: '#059669' },
                      ]}
                    >
                      {adj.type === 'discount' ? '-' : '+'}
                      {formatVND(adj.amount)}
                    </Text>
                    <Pressable
                      onPress={() => handleRemoveAdjustment(adj.id)}
                      hitSlop={6}
                      style={{ marginLeft: 8 }}
                    >
                      <Ionicons name="close-circle" size={18} color="#EF4444" />
                    </Pressable>
                  </View>
                ))}

                {showAddAdjustment && (
                  <View style={styles.addAdjBox}>
                    <View style={styles.adjTypeSelector}>
                      <Pressable
                        style={[
                          styles.adjTypeBtn,
                          adjType === 'fee' && styles.adjTypeBtnFeeActive,
                        ]}
                        onPress={() => setAdjType('fee')}
                      >
                        <Text
                          style={[
                            styles.adjTypeBtnText,
                            adjType === 'fee' && styles.adjTypeBtnTextActive,
                          ]}
                        >
                          + Phí ship / Phụ thu
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.adjTypeBtn,
                          adjType === 'discount' && styles.adjTypeBtnDiscountActive,
                        ]}
                        onPress={() => setAdjType('discount')}
                      >
                        <Text
                          style={[
                            styles.adjTypeBtnText,
                            adjType === 'discount' && styles.adjTypeBtnTextActive,
                          ]}
                        >
                          - Voucher / Giảm giá
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.adjInputRow}>
                      <TextInput
                        style={[styles.input, { flex: 2 }]}
                        placeholder={
                          adjType === 'fee'
                            ? 'Tên phí (VD: Phí ship, Khăn lạnh)'
                            : 'Tên giảm giá (VD: Voucher Grab, Giảm 10%)'
                        }
                        placeholderTextColor={THEME.textMuted}
                        value={adjName}
                        onChangeText={setAdjName}
                      />
                      <TextInput
                        style={[styles.input, { flex: 1.2 }]}
                        placeholder="Số tiền"
                        placeholderTextColor={THEME.textMuted}
                        keyboardType="numeric"
                        value={adjAmount}
                        onChangeText={setAdjAmount}
                      />
                    </View>

                    <View style={styles.adjActionRow}>
                      <Pressable
                        style={styles.adjCancelBtn}
                        onPress={() => setShowAddAdjustment(false)}
                      >
                        <Text style={styles.adjCancelText}>Hủy</Text>
                      </Pressable>
                      <Pressable style={styles.adjSaveBtn} onPress={handleAddAdjustment}>
                        <Text style={styles.adjSaveText}>Lưu</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* 4. Tổng kết phân bổ cho từng người */}
                <View style={[styles.sectionHeader, { marginTop: 16 }]}>
                  <Text style={styles.sectionTitle}>KẾT QUẢ CHIA TIỀN TỪNG NGƯỜI</Text>
                </View>

                <View style={styles.summaryCard}>
                  {calcResult.shares.map(share => {
                    return (
                      <View key={share.memberId} style={styles.shareRow}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={styles.shareMemberName}>{share.memberName}</Text>
                            {share.isPayer && (
                              <View style={styles.payerTag}>
                                <Text style={styles.payerTagText}>Chủ chi</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.shareSubDetail}>
                            Món: {formatVND(share.itemsSubtotal)}
                            {share.adjustmentShare !== 0 &&
                              ` · Phí/Voucher: ${share.adjustmentShare > 0 ? '+' : ''}${formatVND(share.adjustmentShare)}`}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.shareFinalAmount,
                            share.isPayer ? { color: '#047857' } : { color: '#0F766E' },
                          ]}
                        >
                          {formatVND(share.finalAmount)}
                        </Text>
                      </View>
                    );
                  })}

                  <View style={styles.breakdownDivider} />

                  <View style={styles.calcCheckRow}>
                    <Text style={styles.calcCheckText}>
                      Tổng tính toán: <Text style={{ fontWeight: '900' }}>{formatVND(calcResult.calculatedTotal)}</Text>
                    </Text>
                    {calcResult.diffWithTransaction === 0 ? (
                      <View style={styles.matchBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#047857" />
                        <Text style={styles.matchBadgeText}>Khớp 100%</Text>
                      </View>
                    ) : (
                      <View style={styles.diffBadge}>
                        <Ionicons name="information-circle" size={14} color="#B45309" />
                        <Text style={styles.diffBadgeText}>
                          Lệch: {calcResult.diffWithTransaction > 0 ? '+' : ''}
                          {formatVND(calcResult.diffWithTransaction)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Confirm Button for Itemized Split */}
                <Pressable
                  style={({ pressed }) => [
                    styles.confirmBtn,
                    pressed && { opacity: 0.9 },
                    calcResult.shares.filter(s => !s.isPayer).length === 0 &&
                      styles.confirmBtnDisabled,
                  ]}
                  disabled={calcResult.shares.filter(s => !s.isPayer).length === 0}
                  onPress={handleConfirmItemized}
                >
                  <Ionicons name="checkmark-done" size={22} color="#000000" />
                  <Text style={styles.confirmBtnText}>
                    Xác nhận · Tách đơn theo món
                  </Text>
                </Pressable>
              </View>
            ) : (
              // ==================== TAB 2: CHIA NHANH ====================
              <View style={{ paddingBottom: 20 }}>
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
                  <Pressable style={styles.addMemberHeaderBtn} onPress={addQuickMember}>
                    <Ionicons name="add" size={14} color="#000000" />
                    <Text style={styles.addMemberHeaderText}>Thêm người</Text>
                  </Pressable>
                </View>

                {quickMembers.map((m, idx) => {
                  const isActive = m.id === activeInputId;
                  const mAmt = parseInt(m.amountStr, 10) || 0;

                  return (
                    <View
                      key={m.id}
                      style={[styles.memberCard, isActive && styles.memberCardActive]}
                    >
                      <View style={styles.memberCardTop}>
                        <Text style={styles.memberIndex}>Người #{idx + 1}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Pressable
                            style={styles.quickContactPickBtn}
                            onPress={() => handleOpenContactPickerFor(m.id)}
                          >
                            <Ionicons name="people" size={12} color="#000000" />
                            <Text style={styles.quickContactPickText}>Danh bạ</Text>
                          </Pressable>
                          {quickMembers.length > 1 && (
                            <Pressable
                              style={styles.deleteMemberBtn}
                              onPress={() => removeQuickMember(m.id)}
                            >
                              <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </Pressable>
                          )}
                        </View>
                      </View>

                      <View style={styles.memberInputsRow}>
                        <TextInput
                          style={[styles.input, { flex: 1 }]}
                          placeholder="Tên người (*)"
                          placeholderTextColor={THEME.textMuted}
                          value={m.name}
                          onChangeText={val => updateQuickMember(m.id, 'name', val)}
                        />
                        <TextInput
                          style={[styles.input, { flex: 1 }]}
                          placeholder="SĐT (tùy chọn)"
                          placeholderTextColor={THEME.textMuted}
                          keyboardType="phone-pad"
                          value={m.phone}
                          onChangeText={val => updateQuickMember(m.id, 'phone', val)}
                        />
                      </View>

                      {/* Tap to set active for keypad */}
                      <Pressable
                        style={[
                          styles.amountTriggerBtn,
                          isActive && styles.amountTriggerBtnActive,
                        ]}
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
                      -{formatVND(totalQuickSplit)}
                    </Text>
                  </View>
                  <View style={styles.breakdownDivider} />
                  <View style={styles.breakdownRow}>
                    <Text style={styles.myExpenseKey}>Chi tiêu thực của tôi:</Text>
                    <Text
                      style={[
                        styles.myExpenseVal,
                        remainingForMeQuick < 0
                          ? { color: '#EF4444' }
                          : { color: '#15803D' },
                      ]}
                    >
                      {formatVND(remainingForMeQuick)}
                    </Text>
                  </View>
                </View>

                {/* Notice / Explanation */}
                <View style={styles.infoBox}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#059669" />
                  <Text style={styles.infoText}>
                    Số dư ví hiện tại không đổi. Chi tiêu thực của bạn sẽ được điều chỉnh còn{' '}
                    <Text style={{ fontWeight: '900', color: '#047857' }}>
                      {formatVND(Math.max(0, remainingForMeQuick))}
                    </Text>
                    . Khi người này trả nợ, tiền sẽ tự động cộng lại vào ví mà không tính thành thu nhập mới.
                  </Text>
                </View>

                {/* Keypad */}
                <View style={styles.keypadWrapper}>
                  <Text style={styles.keypadTargetLabel}>
                    Nhập số tiền cho:{' '}
                    <Text style={{ fontWeight: '900', color: '#000000' }}>
                      {activeQuickMember?.name ||
                        `Người #${quickMembers.findIndex(m => m.id === activeInputId) + 1}`}
                    </Text>
                  </Text>
                  <Text style={styles.keypadDisplayAmount}>
                    {formatVND(activeQuickAmount)}
                  </Text>

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

                {/* Confirm Button for Quick Split */}
                <Pressable
                  style={({ pressed }) => [
                    styles.confirmBtn,
                    pressed && { opacity: 0.9 },
                    remainingForMeQuick < 0 && styles.confirmBtnDisabled,
                  ]}
                  disabled={remainingForMeQuick < 0}
                  onPress={handleConfirmQuick}
                >
                  <Ionicons name="checkmark-done" size={22} color="#000000" />
                  <Text style={styles.confirmBtnText}>
                    {remainingForMeQuick === 0
                      ? 'Tách toàn bộ 100% thành khoản nợ'
                      : `Xác nhận · Tách ${formatVND(totalQuickSplit)}`}
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </ErrorBoundary>

        {/* Global Contact Picker Modal */}
        <ContactPickerSheet
          visible={showContactPicker}
          onClose={() => setShowContactPicker(false)}
          multiSelect={contactPickerTarget === 'itemized'}
          selectedNames={
            contactPickerTarget === 'itemized'
              ? billMembers.map(m => m.name)
              : []
          }
          onSelectContact={handleContactSelected}
          onConfirmMultiSelect={handleMultiContactsSelected}
          title={
            contactPickerTarget === 'itemized'
              ? 'Chọn bạn bè vào đơn'
              : 'Chọn người trả nợ'
          }
        />

        {AlertModalComponent}
      </KeyboardAvoidingView>
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
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    paddingHorizontal: 16,
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
    marginBottom: 12,
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
  origCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 10,
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
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  origInfo: {
    flex: 1,
    marginRight: 8,
  },
  origTitle: {
    fontSize: 14,
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
    fontSize: 9,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  origAmount: {
    fontSize: 17,
    fontWeight: '900',
    color: '#E11D48',
  },
  origNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
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
  origCatEditBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
  },
  origCatEditText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
  },
  catPickerWrapper: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  catPickerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  catPickerScroll: {
    flexDirection: 'row',
  },
  catPickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3F4F6',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000000',
    marginRight: 6,
  },
  catPickerChipSelected: {
    backgroundColor: '#FEF08A',
  },
  catPickerIconBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catPickerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },
  catPickerTextSelected: {
    fontWeight: '900',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 3,
    marginBottom: 12,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    gap: 6,
  },
  modeTabActive: {
    backgroundColor: THEME.popYellow,
    borderWidth: 1.5,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textSecondary,
  },
  modeTabTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  scrollArea: {
    maxHeight: 560,
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
  sectionSubtitleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F766E',
  },
  subtextMuted: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.textMuted,
    marginTop: 1,
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
    fontWeight: '900',
    color: '#000000',
  },
  membersChipScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
  },
  memberPillPayer: {
    backgroundColor: THEME.primaryLight,
    borderColor: '#047857',
  },
  memberPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  memberPillClose: {
    marginLeft: 6,
    padding: 1,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  itemCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
  itemPriceMeta: {
    fontSize: 11,
    color: THEME.textSecondary,
    fontWeight: '700',
    marginTop: 2,
  },
  deleteItemBtn: {
    padding: 4,
  },
  itemAssignRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  assignLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textSecondary,
  },
  allToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
  },
  allToggleBtnActive: {
    backgroundColor: THEME.popYellow,
    borderColor: '#000000',
  },
  allToggleText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textSecondary,
  },
  allToggleTextActive: {
    color: '#000000',
  },
  memberTagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  memberTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  memberTagActive: {
    backgroundColor: THEME.popYellowLight,
    borderColor: '#000000',
  },
  memberTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  memberTagTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  addDishBox: {
    backgroundColor: THEME.surface,
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  addDishTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 6,
  },
  addDishInputs: {
    flexDirection: 'row',
    gap: 6,
  },
  addDishSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.popLime,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    paddingVertical: 6,
    marginTop: 8,
  },
  addDishSubmitText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  addAdjHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.popPinkLight,
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  addAdjHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  adjRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
  },
  adjBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#000000',
    marginRight: 8,
  },
  adjBadgeFee: {
    backgroundColor: THEME.popOrangeLight,
  },
  adjBadgeDiscount: {
    backgroundColor: THEME.primaryLight,
  },
  adjBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
  },
  adjName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  adjAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  addAdjBox: {
    backgroundColor: THEME.surface,
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  adjTypeSelector: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  adjTypeBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
  },
  adjTypeBtnFeeActive: {
    backgroundColor: THEME.popOrange,
    borderColor: '#000000',
  },
  adjTypeBtnDiscountActive: {
    backgroundColor: THEME.primary,
    borderColor: '#000000',
  },
  adjTypeBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textSecondary,
  },
  adjTypeBtnTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  adjInputRow: {
    flexDirection: 'row',
    gap: 6,
  },
  adjActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  adjCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  adjCancelText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  adjSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: THEME.primary,
  },
  adjSaveText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#000000',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  shareMemberName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  payerTag: {
    backgroundColor: THEME.primaryLight,
    borderWidth: 1,
    borderColor: '#047857',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  payerTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#047857',
  },
  shareSubDetail: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.textMuted,
    marginTop: 1,
  },
  shareFinalAmount: {
    fontSize: 15,
    fontWeight: '900',
  },
  calcCheckRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  calcCheckText: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#047857',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  matchBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#047857',
  },
  diffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#B45309',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  diffBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#B45309',
  },
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
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
  quickContactPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: THEME.popYellow,
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  quickContactPickText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
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
    marginVertical: 4,
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
