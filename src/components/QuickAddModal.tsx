import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSQLiteContext } from 'expo-sqlite';
import { useCustomAlert } from './CustomAlertModal';
import dayjs from 'dayjs';
import { useWallet } from '../context/WalletContext';
import { useSecurity } from '../context/SecurityContext';
import { NeoDropdown } from './NeoDropdown';
import { THEME, formatVND } from '../constants';
import { Wallet, ReceiptScanResult, ReceiptItem } from '../types';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '../utils/haptics';
import { predictCategory, PredictionResult } from '../services/predictionService';
import {
  analyzeReceiptImages,
  saveReceiptImages,
  getGeminiApiKey,
  savePreferredGeminiModel,
  formatGeminiErrorMessage,
} from '../services/geminiService';

interface QuickAddModalProps {
  visible: boolean;
  onClose: () => void;
  defaultType?: 'expense' | 'income' | 'transfer';
  prefillCategoryId?: string;
  prefillAmount?: number;
  prefillNote?: string;
  prefillWalletId?: string;
  prefillToWalletId?: string;
  prefillDate?: Date;
  initialReceiptImageUri?: string | null;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  visible,
  onClose,
  defaultType = 'expense',
  prefillCategoryId,
  prefillAmount,
  prefillNote,
  prefillWalletId,
  prefillToWalletId,
  prefillDate,
  initialReceiptImageUri,
}) => {
  const {
    wallets,
    categories,
    transactions,
    addTransaction,
    addCreditExpenseWithPlan,
  } = useWallet();
  const { showAlert, showConfirm, AlertModalComponent } = useCustomAlert(false);

  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(defaultType);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [amountStr, setAmountStr] = useState<string>('0');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [selectedToWalletId, setSelectedToWalletId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [note, setNote] = useState<string>('');

  // Date & Time states
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isPickerExpanded, setIsPickerExpanded] = useState<boolean>(false);
  const [pickerMonth, setPickerMonth] = useState<Date>(new Date());

  // Credit Card & Installment features
  const [creditMode, setCreditMode] = useState<'single' | 'installment'>('single');
  const [creditDueDate, setCreditDueDate] = useState<string>(dayjs().add(30, 'day').format('YYYY-MM-DD'));
  const [installmentCount, setInstallmentCount] = useState<number>(3);
  const [paidInstallmentCount, setPaidInstallmentCount] = useState<number>(0);
  const [feePerInstallmentStr, setFeePerInstallmentStr] = useState<string>('0');
  const [enableCreditPlan, setEnableCreditPlan] = useState<boolean>(true);
  const [showManualCreditDate, setShowManualCreditDate] = useState<boolean>(false);
  const [installmentInputMode, setInstallmentInputMode] = useState<'total' | 'per_term'>('total');
  const [termAmountStr, setTermAmountStr] = useState<string>('0');
  const [isScheduleExpanded, setIsScheduleExpanded] = useState<boolean>(false);

  const db = useSQLiteContext();
  const { temporarilyBypassLock } = useSecurity();

  // Receipt Images & Gemini AI OCR states
  const [receiptImages, setReceiptImages] = useState<string[]>([]);
  const [isScanningReceipt, setIsScanningReceipt] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [showItemsBreakdown, setShowItemsBreakdown] = useState<boolean>(false);
  const [viewingImageUri, setViewingImageUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const scanRequestIdRef = useRef<number>(0);

  // Editable receipt items states
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editItemName, setEditItemName] = useState<string>('');
  const [editItemPrice, setEditItemPrice] = useState<string>('');
  const [editItemQty, setEditItemQty] = useState<string>('1');

  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemPrice, setNewItemPrice] = useState<string>('');
  const [newItemQty, setNewItemQty] = useState<string>('1');
  const [showAddItemBox, setShowAddItemBox] = useState<boolean>(false);

  const itemsSum = useMemo(() => {
    return receiptItems.reduce((acc, it) => {
      const q = Math.max(1, it.quantity || 1);
      const p = Math.max(0, it.price || 0);
      return acc + (q * p);
    }, 0);
  }, [receiptItems]);

  const handleAddItem = () => {
    const name = newItemName.trim();
    const price = parseInt(newItemPrice.replace(/\D/g, ''), 10) || 0;
    const qty = parseInt(newItemQty.replace(/\D/g, ''), 10) || 1;

    if (!name) {
      hapticError();
      showAlert('Thiếu tên món', 'Vui lòng nhập tên món.');
      return;
    }
    if (price <= 0) {
      hapticError();
      showAlert('Thiếu giá', 'Vui lòng nhập đơn giá món lớn hơn 0.');
      return;
    }

    hapticSuccess();
    setReceiptItems(prev => [...prev, { name, price, quantity: qty }]);
    setNewItemName('');
    setNewItemPrice('');
    setNewItemQty('1');
    setShowAddItemBox(false);
  };

  const handleDeleteItem = (index: number) => {
    hapticLight();
    setReceiptItems(prev => prev.filter((_, idx) => idx !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const handleStartEdit = (index: number) => {
    hapticLight();
    const item = receiptItems[index];
    if (!item) return;
    setEditingIndex(index);
    setEditItemName(item.name || '');
    setEditItemPrice((item.price || 0).toString());
    setEditItemQty((item.quantity || 1).toString());
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const name = editItemName.trim();
    const price = parseInt(editItemPrice.replace(/\D/g, ''), 10) || 0;
    const qty = parseInt(editItemQty.replace(/\D/g, ''), 10) || 1;

    if (!name) {
      hapticError();
      showAlert('Thiếu tên món', 'Vui lòng nhập tên món.');
      return;
    }

    hapticSuccess();
    setReceiptItems(prev =>
      prev.map((it, idx) => (idx === editingIndex ? { name, price, quantity: qty } : it))
    );
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    hapticLight();
    setEditingIndex(null);
  };

  const handleSyncAmountFromItems = () => {
    hapticSuccess();
    if (itemsSum > 0) {
      setAmountStr(itemsSum.toString());
    }
  };

  const triggerGeminiScan = async (imagesToScan: string[]) => {
    if (!imagesToScan || imagesToScan.length === 0) return;
    const currentRequestId = ++scanRequestIdRef.current;
    try {
      const apiKey = await getGeminiApiKey(db);
      if (currentRequestId !== scanRequestIdRef.current) return;
      if (!apiKey) {
        hapticLight();
        showAlert(
          'Đã đính kèm ảnh',
          'Ảnh đã được thêm vào giao dịch. Bạn có thể vào Cài đặt để thêm Gemini API Key nếu muốn AI tự động đọc số tiền & thông tin từ ảnh/hóa đơn.'
        );
        return;
      }

      hapticMedium();
      setIsScanningReceipt(true);
      const res = await analyzeReceiptImages(db, imagesToScan, categories, wallets);
      if (currentRequestId !== scanRequestIdRef.current) return;
      setScanResult(res);
      if (res.items && res.items.length > 0) {
        setReceiptItems(res.items);
        setShowItemsBreakdown(true);
      }

      if (res.amount && res.amount > 0) {
        setAmountStr(res.amount.toString());
      }
      if (res.note) {
        setNote(res.note);
      }
      if (res.category_id && categories.some((c) => c.id === res.category_id)) {
        setSelectedCategoryId(res.category_id);
      }
      // Tự động nhận diện và gán ví thanh toán
      if (res.wallet_id && wallets.some((w) => w.id === res.wallet_id)) {
        setSelectedWalletId(res.wallet_id);
      } else if (res.detected_payment_method) {
        const lowerMethod = res.detected_payment_method.toLowerCase();
        const matchedWallet = wallets.find((w) => {
          const wName = w.name.toLowerCase();
          if (lowerMethod.includes('momo') && (wName.includes('momo') || w.type === 'e_wallet')) return true;
          if (lowerMethod.includes('zalopay') && (wName.includes('zalo') || w.type === 'e_wallet')) return true;
          if (lowerMethod.includes('shopee') && (wName.includes('shopee') || w.type === 'e_wallet')) return true;
          if (lowerMethod.includes('tiền mặt') || lowerMethod.includes('cash')) return w.type === 'cash' || wName.includes('tiền mặt');
          if (lowerMethod.includes('vcb') || lowerMethod.includes('vietcombank')) return wName.includes('vietcombank') || wName.includes('vcb');
          if (lowerMethod.includes('tcb') || lowerMethod.includes('techcombank')) return wName.includes('techcombank') || wName.includes('tcb');
          if (lowerMethod.includes('mbbank') || lowerMethod.includes('mb bank') || lowerMethod.includes('quân đội')) return wName.includes('mb');
          if (lowerMethod.includes('tpbank') || lowerMethod.includes('tpb')) return wName.includes('tpbank') || wName.includes('tpb');
          if (lowerMethod.includes('acb')) return wName.includes('acb');
          if (lowerMethod.includes('bidv')) return wName.includes('bidv');
          if (lowerMethod.includes('vpbank') || lowerMethod.includes('vpb')) return wName.includes('vpbank') || wName.includes('vpb');
          if (lowerMethod.includes('credit') || lowerMethod.includes('visa') || lowerMethod.includes('master')) return w.type === 'credit';
          return wName.includes(lowerMethod);
        });
        if (matchedWallet) {
          setSelectedWalletId(matchedWallet.id);
        }
      }
      if (res.transacted_at) {
        const parsed = dayjs(res.transacted_at);
        if (parsed.isValid()) {
          setSelectedDate(parsed.toDate());
          setPickerMonth(parsed.toDate());
        }
      }
      hapticSuccess();

      // Nếu xảy ra fallback sang model khác, hỏi người dùng có muốn đổi sang model mới không
      if (res.is_fallback && res.used_model && res.original_model && res.used_model !== res.original_model) {
        setTimeout(() => {
          hapticMedium();
          showConfirm(
            'Đổi mô hình mặc định?',
            `Mô hình "${res.original_model}" đang gặp sự cố. AI đã hoàn tất đọc ảnh bằng mô hình dự phòng "${res.used_model}".\n\nBạn có muốn đổi mô hình mặc định sang "${res.used_model}" không?`,
            async () => {
              await savePreferredGeminiModel(db, res.used_model!);
              hapticSuccess();
              showAlert('Đã đổi mô hình', `Đã chuyển mô hình mặc định sang "${res.used_model}".`);
            },
            {
              confirmText: 'Đồng ý đổi',
              cancelText: 'Giữ nguyên',
              type: 'info',
            }
          );
        }, 500);
      }
    } catch (err: any) {
      if (currentRequestId !== scanRequestIdRef.current) return;
      hapticError();
      showAlert('Lỗi nhận diện ảnh', formatGeminiErrorMessage(err));
    } finally {
      if (currentRequestId === scanRequestIdRef.current) {
        setIsScanningReceipt(false);
      }
    }
  };

  const handlePickImagesFromLibrary = async () => {
    try {
      temporarilyBypassLock(120000);
      hapticLight();
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showAlert('Cần cấp quyền', 'Vui lòng cấp quyền truy cập thư viện ảnh để đính kèm hình ảnh.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUris = result.assets.map((a) => a.uri);
        const updated = [...receiptImages, ...newUris];
        setReceiptImages(updated);
        await triggerGeminiScan(updated);
      }
    } catch (err: any) {
      hapticError();
      showAlert('Lỗi', err?.message || 'Không thể chọn ảnh từ thư viện');
    }
  };

  const handleTakePhoto = async () => {
    try {
      temporarilyBypassLock(120000);
      hapticLight();
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showAlert('Cần cấp quyền', 'Vui lòng cấp quyền sử dụng máy ảnh để chụp ảnh.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUri = result.assets[0].uri;
        const updated = [...receiptImages, newUri];
        setReceiptImages(updated);
        await triggerGeminiScan(updated);
      }
    } catch (err: any) {
      hapticError();
      showAlert('Lỗi', err?.message || 'Không thể chụp ảnh');
    }
  };

  const handleRemoveReceiptImage = (indexToRemove: number) => {
    hapticLight();
    scanRequestIdRef.current++;
    setIsScanningReceipt(false);
    const updated = receiptImages.filter((_, idx) => idx !== indexToRemove);
    setReceiptImages(updated);
    if (updated.length === 0) {
      setScanResult(null);
    }
  };

  // Helper tính ngày đến hạn gợi ý theo chu kỳ thẻ
  const getSuggestedDueDate = (wallet?: Wallet, baseDate: Date = new Date()): string => {
    const dueDay = wallet?.due_day;
    const stmtDay = wallet?.statement_day;
    const base = dayjs(baseDate);

    if (dueDay && dueDay >= 1 && dueDay <= 31) {
      let target = base.date(dueDay);
      if (stmtDay && stmtDay >= 1 && stmtDay <= 31) {
        if (base.date() > stmtDay) {
          target = target.add(dueDay <= stmtDay ? 2 : 1, 'month');
        } else {
          target = target.add(dueDay <= stmtDay ? 1 : 0, 'month');
        }
      } else {
        if (target.isBefore(base) || target.isSame(base, 'day')) {
          target = target.add(1, 'month');
        }
      }
      return target.format('YYYY-MM-DD');
    }
    return base.add(30, 'day').format('YYYY-MM-DD');
  };

  useEffect(() => {
    if (visible) {
      setType(defaultType);
      const initialAmt = prefillAmount ? prefillAmount.toString() : '0';
      const initialNote = prefillNote || '';
      setAmountStr(initialAmt);
      setNote(initialNote);
      const baseD = prefillDate || new Date();
      setSelectedDate(baseD);
      setPickerMonth(baseD);
      setIsPickerExpanded(false);

      // Reset receipt images & AI scan states
      if (initialReceiptImageUri) {
        setReceiptImages([initialReceiptImageUri]);
        setScanResult(null);
        setReceiptItems([]);
        setEditingIndex(null);
        setShowAddItemBox(false);
        setNewItemName('');
        setNewItemPrice('');
        setNewItemQty('1');
        setShowItemsBreakdown(false);
        setViewingImageUri(null);
        triggerGeminiScan([initialReceiptImageUri]);
      } else {
        setReceiptImages([]);
        setScanResult(null);
        setReceiptItems([]);
        setEditingIndex(null);
        setShowAddItemBox(false);
        setNewItemName('');
        setNewItemPrice('');
        setNewItemQty('1');
        setIsScanningReceipt(false);
        setShowItemsBreakdown(false);
        setViewingImageUri(null);
      }

      let currentWId = selectedWalletId;
      if (prefillWalletId) {
        currentWId = prefillWalletId;
        setSelectedWalletId(prefillWalletId);
      } else if (wallets.length > 0 && !selectedWalletId) {
        currentWId = wallets[0].id;
        setSelectedWalletId(wallets[0].id);
      }
      if (prefillToWalletId) {
        setSelectedToWalletId(prefillToWalletId);
      } else if (wallets.length > 1 && !selectedToWalletId) {
        setSelectedToWalletId(wallets[1].id);
      }

      // Reset credit card options
      const targetW = wallets.find(w => w.id === currentWId);
      setCreditDueDate(getSuggestedDueDate(targetW, baseD));
      setCreditMode('single');
      setInstallmentCount(3);
      setPaidInstallmentCount(0);
      setFeePerInstallmentStr('0');
      setEnableCreditPlan(true);
      setInstallmentInputMode('total');
      setTermAmountStr('0');
      setIsScheduleExpanded(false);

      // Run smart category prediction
      if (defaultType !== 'transfer') {
        const pred = predictCategory({
          type: defaultType,
          currentDate: baseD,
          note: initialNote,
          transactions,
          categories,
        });
        setPrediction(pred);

        if (prefillCategoryId) {
          setSelectedCategoryId(prefillCategoryId);
        } else if (pred.primarySuggestion) {
          setSelectedCategoryId(pred.primarySuggestion.category.id);
        } else {
          const filteredCats = categories.filter(c => c.type === (defaultType === 'income' ? 'income' : 'expense'));
          if (filteredCats.length > 0) {
            setSelectedCategoryId(filteredCats[0].id);
          }
        }
      }
    }
  }, [visible, defaultType, wallets, prefillCategoryId, prefillAmount, prefillNote, transactions, categories]);

  const handleWalletSelect = (walletId: string) => {
    setSelectedWalletId(walletId);
    const targetW = wallets.find(w => w.id === walletId);
    if (targetW?.type === 'credit') {
      setCreditDueDate(getSuggestedDueDate(targetW, selectedDate));
    }
  };

  const handleTypeChange = (newType: 'expense' | 'income' | 'transfer') => {
    setType(newType);
    if (newType !== 'transfer') {
      const pred = predictCategory({
        type: newType,
        currentDate: selectedDate,
        note,
        transactions,
        categories,
      });
      setPrediction(pred);
      if (pred.primarySuggestion) {
        setSelectedCategoryId(pred.primarySuggestion.category.id);
      } else {
        const filteredCats = categories.filter(c => c.type === (newType === 'income' ? 'income' : 'expense'));
        if (filteredCats.length > 0) {
          setSelectedCategoryId(filteredCats[0].id);
        }
      }
    }
  };

  const handleNoteChange = (text: string) => {
    setNote(text);
    if (type !== 'transfer' && text.trim().length >= 2) {
      const pred = predictCategory({
        type,
        currentDate: selectedDate,
        note: text,
        transactions,
        categories,
      });
      setPrediction(pred);
      // If a high-confidence semantic match is found, auto-switch selected category
      if (pred.primarySuggestion && pred.primarySuggestion.confidence === 'high') {
        setSelectedCategoryId(pred.primarySuggestion.category.id);
      }
    }
  };

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

  const selectedWallet = wallets.find(w => w.id === selectedWalletId);
  const isCreditWallet = type === 'expense' && selectedWallet?.type === 'credit';

  const amountNumber = parseInt(amountStr, 10) || 0;

  const feeNumber = parseInt(feePerInstallmentStr.replace(/[^0-9]/g, ''), 10) || 0;
  const count = creditMode === 'installment' ? Math.max(1, installmentCount) : 1;
  const paidCount = creditMode === 'installment' ? Math.min(count - 1, Math.max(0, paidInstallmentCount)) : 0;
  const basePrincipalPerTerm = Math.floor(amountNumber / count);
  const remainder = amountNumber - (basePrincipalPerTerm * (count - 1));
  const totalInstallmentFee = creditMode === 'installment' ? feeNumber * count : 0;
  const totalOriginalAmount = amountNumber + totalInstallmentFee;

  const installmentPreviewList = useMemo(() => {
    if (creditMode !== 'installment' || amountNumber <= 0) return [];
    const list: Array<{
      term: number;
      date: string;
      principal: number;
      fee: number;
      total: number;
      isPaid: boolean;
    }> = [];
    const parts = creditDueDate.split('-');
    const y = parseInt(parts[0], 10) || dayjs().year();
    const m = parseInt(parts[1], 10) || (dayjs().month() + 1);
    const d = parseInt(parts[2], 10) || dayjs().date();

    for (let i = 1; i <= count; i++) {
      const termPrincipal = i === count ? remainder : basePrincipalPerTerm;
      const termTotal = termPrincipal + feeNumber;
      const isPaid = i <= paidCount;
      const monthOffset = i - (paidCount + 1);
      const targetDateObj = new Date(y, (m - 1) + monthOffset, d);
      const targetDate = [
        String(targetDateObj.getDate()).padStart(2, '0'),
        String(targetDateObj.getMonth() + 1).padStart(2, '0'),
        targetDateObj.getFullYear(),
      ].join('/');

      list.push({
        term: i,
        date: isPaid ? 'Đã thanh toán trước' : targetDate,
        principal: termPrincipal,
        fee: feeNumber,
        total: termTotal,
        isPaid,
      });
    }
    return list;
  }, [creditMode, amountNumber, count, paidCount, feeNumber, creditDueDate, basePrincipalPerTerm, remainder]);

  const totalRemainingPayable = useMemo(() => {
    if (creditMode !== 'installment') return amountNumber;
    return installmentPreviewList
      .filter(item => !item.isPaid)
      .reduce((sum, item) => sum + item.total, 0);
  }, [creditMode, amountNumber, installmentPreviewList]);

  const handleInstallmentCountChange = (num: number) => {
    hapticLight();
    setInstallmentCount(num);
    const newPaidCount = Math.min(paidInstallmentCount, num - 1);
    setPaidInstallmentCount(newPaidCount);
    if (installmentInputMode === 'per_term') {
      const termTotal = parseInt(termAmountStr.replace(/[^0-9]/g, ''), 10) || 0;
      const termPrincipal = Math.max(0, termTotal - feeNumber);
      setAmountStr((termPrincipal * num).toString());
    }
  };

  const handleFeeChange = (text: string) => {
    setFeePerInstallmentStr(text);
    const newFee = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
    if (installmentInputMode === 'per_term') {
      const termTotal = parseInt(termAmountStr.replace(/[^0-9]/g, ''), 10) || 0;
      const termPrincipal = Math.max(0, termTotal - newFee);
      setAmountStr((termPrincipal * count).toString());
    }
  };

  const handleSwitchInstallmentMode = (mode: 'total' | 'per_term') => {
    hapticLight();
    setInstallmentInputMode(mode);
    if (mode === 'per_term') {
      const currentPerTerm = basePrincipalPerTerm + feeNumber;
      setTermAmountStr(currentPerTerm > 0 ? currentPerTerm.toString() : '0');
    }
  };

  const handleTermAmountChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '');
    setTermAmountStr(clean || '0');
    const termTotal = parseInt(clean, 10) || 0;
    const termPrincipal = Math.max(0, termTotal - feeNumber);
    setAmountStr((termPrincipal * count).toString());
  };

  const adjustCreditDueDate = (days: number) => {
    hapticLight();
    setCreditDueDate(prev => {
      const base = dayjs(prev).isValid() ? dayjs(prev) : dayjs(selectedDate);
      return base.add(days, 'day').format('YYYY-MM-DD');
    });
  };

  const suggestedDueDate = useMemo(() => {
    return getSuggestedDueDate(selectedWallet, selectedDate);
  }, [selectedWallet, selectedDate]);

  const preset15Date = useMemo(() => {
    return dayjs(selectedDate).add(15, 'day').format('YYYY-MM-DD');
  }, [selectedDate]);

  const preset30Date = useMemo(() => {
    return dayjs(selectedDate).add(30, 'day').format('YYYY-MM-DD');
  }, [selectedDate]);

  const preset45Date = useMemo(() => {
    return dayjs(selectedDate).add(45, 'day').format('YYYY-MM-DD');
  }, [selectedDate]);

  const relativeDueDays = useMemo(() => {
    if (!dayjs(creditDueDate).isValid()) return '';
    const diff = dayjs(creditDueDate).diff(dayjs(selectedDate), 'day');
    if (diff === 0) return 'Đến hạn hôm nay';
    if (diff > 0) return `Sau ${diff} ngày`;
    return `Quá ${Math.abs(diff)} ngày`;
  }, [creditDueDate, selectedDate]);

  // Keypad actions
  const handleDigitPress = (digit: string) => {
    hapticLight();
    if (isCreditWallet && creditMode === 'installment' && installmentInputMode === 'per_term') {
      let nextVal = termAmountStr;
      if (digit === '000') {
        if (termAmountStr === '0' || !termAmountStr) return;
        if (termAmountStr.length + 3 > 12) return;
        nextVal = termAmountStr + '000';
      } else {
        if (termAmountStr === '0' || !termAmountStr) {
          nextVal = digit;
        } else {
          if (termAmountStr.length >= 12) return;
          nextVal = termAmountStr + digit;
        }
      }
      setTermAmountStr(nextVal);
      const termTotal = parseInt(nextVal, 10) || 0;
      const termPrincipal = Math.max(0, termTotal - feeNumber);
      setAmountStr((termPrincipal * count).toString());
      return;
    }

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
    if (isCreditWallet && creditMode === 'installment' && installmentInputMode === 'per_term') {
      let nextVal = '0';
      if (termAmountStr.length > 1) {
        nextVal = termAmountStr.slice(0, -1);
      }
      setTermAmountStr(nextVal);
      const termTotal = parseInt(nextVal, 10) || 0;
      const termPrincipal = Math.max(0, termTotal - feeNumber);
      setAmountStr((termPrincipal * count).toString());
      return;
    }

    if (amountStr.length <= 1) {
      setAmountStr('0');
    } else {
      setAmountStr(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    hapticMedium();
    setAmountStr('0');
    setTermAmountStr('0');
  };

  // Format Helper for Custom Date Display
  const getFormattedDateLabel = (d: dayjs.Dayjs | Date) => {
    d = dayjs(d);
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
    if (isSavingRef.current || isSaving) return;

    if (amountNumber <= 0) {
      hapticError();
      showAlert('Số tiền không hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0');
      return;
    }
    if (!selectedWalletId) {
      hapticError();
      showAlert('Chưa chọn ví', 'Vui lòng chọn nguồn tiền');
      return;
    }
    if (type === 'transfer') {
      if (!selectedToWalletId) {
        hapticError();
        showAlert('Chưa chọn ví đích', 'Vui lòng chọn ví nhận tiền');
        return;
      }
      if (selectedWalletId === selectedToWalletId) {
        hapticError();
        showAlert('Ví trùng nhau', 'Ví nguồn và ví đích không được trùng nhau');
        return;
      }
    }

    scanRequestIdRef.current++;
    setIsScanningReceipt(false);
    isSavingRef.current = true;
    setIsSaving(true);

    try {
      // Lưu vĩnh viễn các ảnh hóa đơn (Cloudinary hoặc cục bộ)
      let persistentUris: string[] | null = null;
      if (receiptImages.length > 0) {
        try {
          persistentUris = await saveReceiptImages(receiptImages, db);
        } catch (err) {
          console.warn('Lỗi lưu ảnh hóa đơn:', err);
          persistentUris = receiptImages;
        }
      }

      // Chuẩn bị items nếu quét hóa đơn thành công hoặc người dùng tự nhập
      const itemsJson =
        receiptItems.length > 0
          ? JSON.stringify({ items: receiptItems })
          : null;

      // Xử lý riêng cho chi tiêu thẻ tín dụng có hẹn ngày thanh toán hoặc trả góp
      if (isCreditWallet && enableCreditPlan) {
        const feeNumber = parseInt(feePerInstallmentStr.replace(/[^0-9]/g, ''), 10) || 0;
        await addCreditExpenseWithPlan({
          creditWalletId: selectedWalletId,
          amount: amountNumber,
          categoryId: selectedCategoryId || null,
          note: note.trim(),
          transactedAt: selectedDate.toISOString(),
          isInstallment: creditMode === 'installment',
          installmentCount: creditMode === 'installment' ? installmentCount : 1,
          paidInstallmentCount: creditMode === 'installment' ? paidCount : 0,
          feePerInstallment: creditMode === 'installment' ? feeNumber : 0,
          firstDueDate: creditDueDate,
          image_uris: persistentUris,
          items: itemsJson,
        });
        hapticSuccess();
        onClose();
        return;
      }

      await addTransaction({
        type,
        amount: amountNumber,
        wallet_id: selectedWalletId,
        to_wallet_id: type === 'transfer' ? selectedToWalletId : null,
        category_id: type === 'transfer' ? null : selectedCategoryId,
        note: note.trim(),
        transacted_at: selectedDate.toISOString(),
        image_uris: persistentUris,
        items: itemsJson,
      });
      hapticSuccess();
      onClose();
    } catch (error: any) {
      hapticError();
      showAlert('Lỗi lưu giao dịch', error?.message || 'Đã có lỗi xảy ra');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
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
              onPress={() => handleTypeChange('expense')}
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
              onPress={() => handleTypeChange('income')}
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
              onPress={() => handleTypeChange('transfer')}
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
                contentContainerStyle={styles.horizontalChipsContainer}
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
                      onPress={() => handleWalletSelect(w.id)}
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

            {/* Credit Card & Installment Settings Card */}
            {isCreditWallet && (
              <View style={styles.creditCardSettingsBox}>
                {/* Header Row */}
                <View style={styles.creditCardHeaderRow}>
                  <View style={styles.creditCardBadge}>
                    <Ionicons name="card" size={13} color="#000000" />
                    <Text style={styles.creditCardBadgeText} numberOfLines={1}>
                      {selectedWallet?.name || 'Thẻ tín dụng'}
                    </Text>
                    <View style={styles.creditCardTag}>
                      <Text style={styles.creditCardTagText}>TRẢ SAU</Text>
                    </View>
                  </View>

                  <Pressable
                    style={[
                      styles.creditPlanToggleBtn,
                      enableCreditPlan && styles.creditPlanToggleBtnActive,
                    ]}
                    onPress={() => {
                      hapticLight();
                      setEnableCreditPlan(prev => !prev);
                    }}
                  >
                    <Ionicons
                      name={enableCreditPlan ? 'checkbox' : 'square-outline'}
                      size={15}
                      color={enableCreditPlan ? '#000000' : '#6B7280'}
                    />
                    <Text
                      style={[
                        styles.creditPlanToggleText,
                        enableCreditPlan && styles.creditPlanToggleTextActive,
                      ]}
                    >
                      Hẹn lịch trả
                    </Text>
                  </Pressable>
                </View>

                {enableCreditPlan && (
                  <View style={styles.creditCardBody}>
                    {/* Mode Selector: 1 kỳ vs Trả góp */}
                    <View style={styles.creditModeTabs}>
                      <Pressable
                        style={[
                          styles.creditModeTab,
                          creditMode === 'single' && styles.creditModeTabActive,
                        ]}
                        onPress={() => {
                          hapticLight();
                          setCreditMode('single');
                        }}
                      >
                        <Ionicons
                          name="calendar"
                          size={13}
                          color={creditMode === 'single' ? '#000000' : '#6B7280'}
                        />
                        <Text
                          style={[
                            styles.creditModeTabText,
                            creditMode === 'single' && styles.creditModeTabTextActive,
                          ]}
                        >
                          Trả sau 1 kỳ
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.creditModeTab,
                          creditMode === 'installment' && styles.creditModeTabActive,
                        ]}
                        onPress={() => {
                          hapticLight();
                          setCreditMode('installment');
                        }}
                      >
                        <Ionicons
                          name="layers"
                          size={13}
                          color={creditMode === 'installment' ? '#000000' : '#6B7280'}
                        />
                        <Text
                          style={[
                            styles.creditModeTabText,
                            creditMode === 'installment' && styles.creditModeTabTextActive,
                          ]}
                        >
                          Trả góp nhiều kỳ
                        </Text>
                      </Pressable>
                    </View>

                    {/* Single Mode: Due Date */}
                    {creditMode === 'single' ? (
                      <View style={styles.creditDueSection}>
                        <Text style={styles.creditFieldLabel}>HẠN THANH TOÁN (SAO KÊ)</Text>

                        {/* Interactive Hero Date Banner */}
                        <View style={styles.creditDateHeroCard}>
                          <View style={styles.creditDateHeroLeft}>
                            <View style={styles.creditDateHeroIcon}>
                              <Ionicons name="calendar" size={16} color="#000000" />
                            </View>
                            <View style={styles.creditDateHeroTexts}>
                              <Text style={styles.creditDateHeroMain}>
                                {dayjs(creditDueDate).isValid()
                                  ? dayjs(creditDueDate).format('DD/MM/YYYY')
                                  : creditDueDate}
                              </Text>
                              <Text style={styles.creditDateHeroSub}>
                                {relativeDueDays}
                                {creditDueDate === suggestedDueDate ? ' • Đúng chu kỳ thẻ' : ''}
                              </Text>
                            </View>
                          </View>

                          {/* Stepper / Edit Actions */}
                          <View style={styles.creditDateHeroActions}>
                            <Pressable
                              style={styles.creditDateStepperBtn}
                              onPress={() => adjustCreditDueDate(-1)}
                            >
                              <Ionicons name="remove" size={13} color="#000000" />
                            </Pressable>
                            <Pressable
                              style={styles.creditDateStepperBtn}
                              onPress={() => adjustCreditDueDate(1)}
                            >
                              <Ionicons name="add" size={13} color="#000000" />
                            </Pressable>
                            <Pressable
                              style={[
                                styles.creditDateEditBtn,
                                showManualCreditDate && styles.creditDateEditBtnActive,
                              ]}
                              onPress={() => setShowManualCreditDate(prev => !prev)}
                            >
                              <Ionicons
                                name="create-outline"
                                size={14}
                                color={showManualCreditDate ? '#000000' : '#4B5563'}
                              />
                            </Pressable>
                          </View>
                        </View>

                        {/* Expandable Manual Date Input */}
                        {showManualCreditDate && (
                          <View style={styles.creditManualDateRow}>
                            <Text style={styles.creditManualDateLabel}>Nhập ngày:</Text>
                            <TextInput
                              style={styles.creditManualDateInput}
                              value={creditDueDate}
                              onChangeText={setCreditDueDate}
                              placeholder="YYYY-MM-DD"
                              placeholderTextColor={THEME.textMuted}
                              maxLength={10}
                            />
                          </View>
                        )}

                        {/* 4 Balanced Quick Preset Chips in 1 Row */}
                        <View style={styles.creditQuickChipsGrid}>
                          <Pressable
                            style={[
                              styles.creditQuickGridChip,
                              creditDueDate === suggestedDueDate && styles.creditQuickGridChipActive,
                            ]}
                            onPress={() => {
                              hapticLight();
                              setCreditDueDate(suggestedDueDate);
                            }}
                          >
                            <Text
                              style={[
                                styles.creditQuickGridChipText,
                                creditDueDate === suggestedDueDate && styles.creditQuickGridChipTextActive,
                              ]}
                              numberOfLines={1}
                            >
                              Chu kỳ thẻ
                            </Text>
                          </Pressable>

                          <Pressable
                            style={[
                              styles.creditQuickGridChip,
                              creditDueDate === preset15Date && styles.creditQuickGridChipActive,
                            ]}
                            onPress={() => {
                              hapticLight();
                              setCreditDueDate(preset15Date);
                            }}
                          >
                            <Text
                              style={[
                                styles.creditQuickGridChipText,
                                creditDueDate === preset15Date && styles.creditQuickGridChipTextActive,
                              ]}
                              numberOfLines={1}
                            >
                              +15 ngày
                            </Text>
                          </Pressable>

                          <Pressable
                            style={[
                              styles.creditQuickGridChip,
                              creditDueDate === preset30Date && styles.creditQuickGridChipActive,
                            ]}
                            onPress={() => {
                              hapticLight();
                              setCreditDueDate(preset30Date);
                            }}
                          >
                            <Text
                              style={[
                                styles.creditQuickGridChipText,
                                creditDueDate === preset30Date && styles.creditQuickGridChipTextActive,
                              ]}
                              numberOfLines={1}
                            >
                              +30 ngày
                            </Text>
                          </Pressable>

                          <Pressable
                            style={[
                              styles.creditQuickGridChip,
                              creditDueDate === preset45Date && styles.creditQuickGridChipActive,
                            ]}
                            onPress={() => {
                              hapticLight();
                              setCreditDueDate(preset45Date);
                            }}
                          >
                            <Text
                              style={[
                                styles.creditQuickGridChipText,
                                creditDueDate === preset45Date && styles.creditQuickGridChipTextActive,
                              ]}
                              numberOfLines={1}
                            >
                              +45 ngày
                            </Text>
                          </Pressable>
                        </View>

                        {/* Callout Notice */}
                        <View style={styles.creditInfoCallout}>
                          <Ionicons name="information-circle" size={14} color="#0D9488" style={{ marginTop: 1 }} />
                          <Text style={styles.creditInfoCalloutText}>
                            Tự động thêm vào <Text style={{ fontWeight: '800' }}>Kế hoạch Dự chi</Text> để nhắc bạn trích tài khoản trả nợ khi đến hạn.
                          </Text>
                        </View>
                      </View>
                    ) : (
                      /* Installment Mode */
                      <View style={styles.creditInstallmentSection}>
                        <Text style={styles.creditFieldLabel}>TỔNG SỐ KỲ TRẢ GÓP</Text>
                        <View style={styles.installmentCountRow}>
                          {[2, 3, 6, 9, 12].map(num => (
                            <Pressable
                              key={num}
                              style={[
                                styles.installmentCountChip,
                                installmentCount === num && styles.installmentCountChipActive,
                              ]}
                              onPress={() => handleInstallmentCountChange(num)}
                            >
                              <Text
                                style={[
                                  styles.installmentCountText,
                                  installmentCount === num && styles.installmentCountTextActive,
                                ]}
                              >
                                {num} kỳ
                              </Text>
                            </Pressable>
                          ))}
                        </View>

                        {/* SỐ KỲ ĐÃ THANH TOÁN TRƯỚC ĐÓ */}
                        <View style={styles.paidTermsContainer}>
                          <View style={styles.paidTermsHeader}>
                            <Text style={styles.creditFieldLabel}>SỐ KỲ ĐÃ TRẢ TRƯỚC ĐÓ (NẾU CÓ)</Text>
                            {paidInstallmentCount > 0 && (
                              <View style={styles.paidTermsBadge}>
                                <Text style={styles.paidTermsBadgeText}>
                                  Còn {installmentCount - paidInstallmentCount} kỳ cần trả
                                </Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.paidTermsStepperRow}>
                            <Pressable
                              style={[
                                styles.paidTermsStepBtn,
                                paidInstallmentCount === 0 && styles.paidTermsStepBtnDisabled,
                              ]}
                              onPress={() => {
                                if (paidInstallmentCount > 0) {
                                  hapticLight();
                                  setPaidInstallmentCount(prev => Math.max(0, prev - 1));
                                }
                              }}
                              disabled={paidInstallmentCount === 0}
                            >
                              <Ionicons
                                name="remove"
                                size={14}
                                color={paidInstallmentCount === 0 ? '#9CA3AF' : '#000000'}
                              />
                            </Pressable>

                            <View style={styles.paidTermsValueCard}>
                              <Ionicons
                                name={paidInstallmentCount > 0 ? 'checkmark-circle' : 'time-outline'}
                                size={14}
                                color={paidInstallmentCount > 0 ? '#16A34A' : '#6B7280'}
                              />
                              <Text style={styles.paidTermsValueTitle}>
                                {paidInstallmentCount === 0
                                  ? '0 kỳ (Mới mua / Chưa trả kỳ nào)'
                                  : `Đã trả trước ${paidInstallmentCount} / ${installmentCount} kỳ`}
                              </Text>
                            </View>

                            <Pressable
                              style={[
                                styles.paidTermsStepBtn,
                                paidInstallmentCount >= installmentCount - 1 && styles.paidTermsStepBtnDisabled,
                              ]}
                              onPress={() => {
                                if (paidInstallmentCount < installmentCount - 1) {
                                  hapticLight();
                                  setPaidInstallmentCount(prev => Math.min(installmentCount - 1, prev + 1));
                                }
                              }}
                              disabled={paidInstallmentCount >= installmentCount - 1}
                            >
                              <Ionicons
                                name="add"
                                size={14}
                                color={paidInstallmentCount >= installmentCount - 1 ? '#9CA3AF' : '#000000'}
                              />
                            </Pressable>
                          </View>
                        </View>

                        {/* PHƯƠNG THỨC NHẬP TIỀN TRẢ GÓP */}
                        <View style={styles.installmentModeTabsRow}>
                          <Pressable
                            style={[
                              styles.installmentModeTab,
                              installmentInputMode === 'total' && styles.installmentModeTabActive,
                            ]}
                            onPress={() => handleSwitchInstallmentMode('total')}
                          >
                            <Text
                              style={[
                                styles.installmentModeTabText,
                                installmentInputMode === 'total' && styles.installmentModeTabTextActive,
                              ]}
                            >
                              Nhập tổng tiền gốc
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.installmentModeTab,
                              installmentInputMode === 'per_term' && styles.installmentModeTabActive,
                            ]}
                            onPress={() => handleSwitchInstallmentMode('per_term')}
                          >
                            <Ionicons
                              name="calculator"
                              size={12}
                              color={installmentInputMode === 'per_term' ? '#000000' : '#6B7280'}
                              style={{ marginRight: 4 }}
                            />
                            <Text
                              style={[
                                styles.installmentModeTabText,
                                installmentInputMode === 'per_term' && styles.installmentModeTabTextActive,
                              ]}
                            >
                              Nhập tiền mỗi kỳ
                            </Text>
                          </Pressable>
                        </View>

                        {/* Nếu chọn nhập theo mỗi kỳ */}
                        {installmentInputMode === 'per_term' && (
                          <View style={styles.installmentPerTermBox}>
                            <View style={styles.installmentPerTermHeader}>
                              <Text style={styles.creditFieldLabel}>SỐ TIỀN TRẢ MỖI KỲ *</Text>
                              <View style={styles.installmentCalcBadge}>
                                <Text style={styles.installmentCalcBadgeText}>
                                  Tự tính {count} kỳ
                                </Text>
                              </View>
                            </View>
                            <View style={styles.installmentInputWrapper}>
                              <TextInput
                                style={[styles.installmentTextInput, { fontSize: 14 }]}
                                keyboardType="numeric"
                                value={termAmountStr === '0' ? '' : termAmountStr}
                                onChangeText={handleTermAmountChange}
                                placeholder="Nhập số tiền 1 kỳ (VD: 1500000)"
                                placeholderTextColor={THEME.textMuted}
                              />
                              <Text style={styles.installmentInputUnit}>₫/kỳ</Text>
                            </View>
                            <Text style={styles.installmentPerTermCalcSub}>
                              = {count} kỳ × {formatVND(parseInt(termAmountStr, 10) || 0)} = {formatVND(totalOriginalAmount)} tổng gốc ban đầu
                            </Text>
                          </View>
                        )}

                        <View style={styles.installmentInputsRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.creditFieldLabel}>PHÍ MỖI KỲ (NẾU CÓ)</Text>
                            <View style={styles.installmentInputWrapper}>
                              <TextInput
                                style={styles.installmentTextInput}
                                keyboardType="numeric"
                                value={feePerInstallmentStr}
                                onChangeText={handleFeeChange}
                                placeholder="0"
                                placeholderTextColor={THEME.textMuted}
                              />
                              <Text style={styles.installmentInputUnit}>₫</Text>
                            </View>
                          </View>
                        </View>

                        {/* Hạn trả kỳ tiếp theo với Hero Date Banner & Quick Chips */}
                        <View style={styles.creditDueSection}>
                          <Text style={styles.creditFieldLabel}>
                            {paidInstallmentCount > 0
                              ? `HẠN TRẢ KỲ ${paidInstallmentCount + 1} (KỲ TIẾP THEO)`
                              : 'HẠN TRẢ KỲ 1'}
                          </Text>

                          <View style={styles.creditDateHeroCard}>
                            <View style={styles.creditDateHeroLeft}>
                              <View style={styles.creditDateHeroIcon}>
                                <Ionicons name="calendar" size={16} color="#000000" />
                              </View>
                              <View style={styles.creditDateHeroTexts}>
                                <Text style={styles.creditDateHeroMain}>
                                  {dayjs(creditDueDate).isValid()
                                    ? dayjs(creditDueDate).format('DD/MM/YYYY')
                                    : creditDueDate}
                                </Text>
                                <Text style={styles.creditDateHeroSub}>
                                  {relativeDueDays}
                                  {creditDueDate === suggestedDueDate ? ' • Đúng chu kỳ thẻ' : ''}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.creditDateHeroActions}>
                              <Pressable
                                style={styles.creditDateStepperBtn}
                                onPress={() => adjustCreditDueDate(-1)}
                              >
                                <Ionicons name="remove" size={13} color="#000000" />
                              </Pressable>
                              <Pressable
                                style={styles.creditDateStepperBtn}
                                onPress={() => adjustCreditDueDate(1)}
                              >
                                <Ionicons name="add" size={13} color="#000000" />
                              </Pressable>
                              <Pressable
                                style={[
                                  styles.creditDateEditBtn,
                                  showManualCreditDate && styles.creditDateEditBtnActive,
                                ]}
                                onPress={() => setShowManualCreditDate(prev => !prev)}
                              >
                                <Ionicons
                                  name="create-outline"
                                  size={14}
                                  color={showManualCreditDate ? '#000000' : '#4B5563'}
                                />
                              </Pressable>
                            </View>
                          </View>

                          {showManualCreditDate && (
                            <View style={styles.creditManualDateRow}>
                              <Text style={styles.creditManualDateLabel}>Nhập ngày:</Text>
                              <TextInput
                                style={styles.creditManualDateInput}
                                value={creditDueDate}
                                onChangeText={setCreditDueDate}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={THEME.textMuted}
                                maxLength={10}
                              />
                            </View>
                          )}

                          <View style={styles.creditQuickChipsGrid}>
                            <Pressable
                              style={[
                                styles.creditQuickGridChip,
                                creditDueDate === suggestedDueDate && styles.creditQuickGridChipActive,
                              ]}
                              onPress={() => {
                                hapticLight();
                                setCreditDueDate(suggestedDueDate);
                              }}
                            >
                              <Text
                                style={[
                                  styles.creditQuickGridChipText,
                                  creditDueDate === suggestedDueDate && styles.creditQuickGridChipTextActive,
                                ]}
                                numberOfLines={1}
                              >
                                Chu kỳ thẻ
                              </Text>
                            </Pressable>

                            <Pressable
                              style={[
                                styles.creditQuickGridChip,
                                creditDueDate === preset15Date && styles.creditQuickGridChipActive,
                              ]}
                              onPress={() => {
                                hapticLight();
                                setCreditDueDate(preset15Date);
                              }}
                            >
                              <Text
                                style={[
                                  styles.creditQuickGridChipText,
                                  creditDueDate === preset15Date && styles.creditQuickGridChipTextActive,
                                ]}
                                numberOfLines={1}
                              >
                                +15 ngày
                              </Text>
                            </Pressable>

                            <Pressable
                              style={[
                                styles.creditQuickGridChip,
                                creditDueDate === preset30Date && styles.creditQuickGridChipActive,
                              ]}
                              onPress={() => {
                                hapticLight();
                                setCreditDueDate(preset30Date);
                              }}
                            >
                              <Text
                                style={[
                                  styles.creditQuickGridChipText,
                                  creditDueDate === preset30Date && styles.creditQuickGridChipTextActive,
                                ]}
                                numberOfLines={1}
                              >
                                +30 ngày
                              </Text>
                            </Pressable>

                            <Pressable
                              style={[
                                styles.creditQuickGridChip,
                                creditDueDate === preset45Date && styles.creditQuickGridChipActive,
                              ]}
                              onPress={() => {
                                hapticLight();
                                setCreditDueDate(preset45Date);
                              }}
                            >
                              <Text
                                style={[
                                  styles.creditQuickGridChipText,
                                  creditDueDate === preset45Date && styles.creditQuickGridChipTextActive,
                                ]}
                                numberOfLines={1}
                              >
                                +45 ngày
                              </Text>
                            </Pressable>
                          </View>
                        </View>

                        {/* Thanh tóm tắt cố định - Không làm giật/cuộn màn hình khi nhập số */}
                        <View style={styles.installmentSummaryBar}>
                          <View style={styles.installmentSummaryLeft}>
                            <Ionicons name="calculator-outline" size={14} color="#000000" />
                            <Text style={styles.installmentSummaryText} numberOfLines={1}>
                              {amountNumber > 0
                                ? `Dự tính: ~${formatVND(basePrincipalPerTerm + feeNumber)}/kỳ • Còn ${count - paidCount} kỳ`
                                : `Chưa nhập tiền • ${count - paidCount} kỳ cần trả`}
                            </Text>
                          </View>
                          {amountNumber > 0 && (
                            <Pressable
                              style={styles.scheduleToggleBtn}
                              onPress={() => {
                                hapticLight();
                                setIsScheduleExpanded(prev => !prev);
                              }}
                            >
                              <Text style={styles.scheduleToggleBtnText}>
                                {isScheduleExpanded ? 'Thu gọn' : `Lịch ${count} kỳ`}
                              </Text>
                              <Ionicons
                                name={isScheduleExpanded ? 'chevron-up' : 'chevron-down'}
                                size={12}
                                color="#000000"
                              />
                            </Pressable>
                          )}
                        </View>

                        {paidInstallmentCount > 0 && amountNumber > 0 && (
                          <View style={styles.paidSummaryNotice}>
                            <Ionicons name="information-circle" size={13} color="#15803D" style={{ marginTop: 1 }} />
                            <Text style={styles.paidSummaryNoticeText}>
                              Gốc ban đầu: {formatVND(totalOriginalAmount)} • Đã trả: {formatVND(paidInstallmentCount * (basePrincipalPerTerm + feeNumber))} • Dư nợ ghi thẻ: {formatVND(totalRemainingPayable)}
                            </Text>
                          </View>
                        )}

                        {/* Accordion Table: chỉ mở khi người dùng chủ động bấm xem, không tự nhảy khi nhập số */}
                        {isScheduleExpanded && amountNumber > 0 && installmentPreviewList.length > 0 && (
                          <View style={styles.schedulePreviewBox}>
                            <View style={styles.schedulePreviewHeader}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Ionicons name="receipt-outline" size={13} color="#000000" />
                                <Text style={styles.schedulePreviewTitle}>
                                  Lịch {installmentCount} kỳ ({count - paidCount} kỳ cần trả)
                                </Text>
                              </View>
                              <Text style={styles.schedulePreviewTotal}>
                                Còn lại: {formatVND(totalRemainingPayable)}
                              </Text>
                            </View>

                            <View style={styles.scheduleTable}>
                              {installmentPreviewList.map(item => (
                                <View
                                  key={item.term}
                                  style={[
                                    styles.scheduleRow,
                                    item.isPaid && styles.scheduleRowPaid,
                                  ]}
                                >
                                  <View style={styles.scheduleRowLeft}>
                                    <View
                                      style={[
                                        styles.scheduleTermBadge,
                                        item.isPaid
                                          ? styles.scheduleTermBadgePaid
                                          : item.term === paidCount + 1 && styles.scheduleTermBadgeNext,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.scheduleTermBadgeText,
                                          item.isPaid
                                            ? styles.scheduleTermBadgeTextPaid
                                            : item.term === paidCount + 1 && styles.scheduleTermBadgeTextNext,
                                        ]}
                                      >
                                        {item.isPaid
                                          ? `✓ Kỳ ${item.term} (Đã trả)`
                                          : `Kỳ ${item.term}/${installmentCount}`}
                                      </Text>
                                    </View>
                                    <Text
                                      style={[
                                        styles.scheduleDateText,
                                        item.isPaid && styles.scheduleDateTextPaid,
                                      ]}
                                    >
                                      {item.date}
                                    </Text>
                                  </View>

                                  <View style={styles.scheduleRowRight}>
                                    <Text
                                      style={[
                                        styles.scheduleTotalText,
                                        item.isPaid && styles.scheduleTotalTextPaid,
                                      ]}
                                    >
                                      {formatVND(item.total)}
                                    </Text>
                                    {item.fee > 0 && !item.isPaid && (
                                      <Text style={styles.scheduleFeeText}>
                                        Gốc {formatVND(item.principal)} + Phí {formatVND(item.fee)}
                                      </Text>
                                    )}
                                  </View>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* If Transfer: Destination Wallet */}
            {type === 'transfer' && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionLabel}>Đến nguồn tiền (Ví đích)</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.horizontalChips}
                  contentContainerStyle={styles.horizontalChipsContainer}
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
                <View style={styles.categoryHeaderRow}>
                  <Text style={styles.sectionLabel}>Hạng mục</Text>
                  {prediction?.primarySuggestion?.reason && (
                    <View style={styles.smartBadge}>
                      <Ionicons name="sparkles" size={10} color="#D97706" style={{ marginRight: 3 }} />
                      <Text style={styles.smartBadgeText} numberOfLines={1} ellipsizeMode="tail">
                        {prediction.primarySuggestion.reason}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Smart Suggested Chips */}
                {prediction?.topSuggestions && prediction.topSuggestions.length > 0 && (
                  <View style={styles.smartChipsWrapper}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.smartChipsScrollContainer}
                    >
                      {prediction.topSuggestions.map(s => {
                        const isSelected = selectedCategoryId === s.category.id;
                        return (
                          <Pressable
                            key={s.category.id}
                            style={[
                              styles.smartChip,
                              isSelected && styles.smartChipSelected,
                              isSelected && { backgroundColor: s.category.color },
                            ]}
                            onPress={() => {
                              hapticLight();
                              setSelectedCategoryId(s.category.id);
                            }}
                          >
                            <Ionicons
                              name={(s.category.icon as any) || 'pricetag-outline'}
                              size={13}
                              color={isSelected ? '#FFFFFF' : s.category.color}
                              style={{ marginRight: 4 }}
                            />
                            <Text
                              style={[
                                styles.smartChipText,
                                isSelected && styles.smartChipTextSelected,
                              ]}
                            >
                              {s.category.name}
                            </Text>
                            {s.confidence === 'high' && (
                              <View style={[styles.confidenceDot, isSelected && { backgroundColor: '#FFFFFF' }]} />
                            )}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

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
              </View>

              {/* Quick Date Chips (3 Equal Columns) */}
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
              </View>

              {/* Selected Date & Time Indicator Bar */}
              <Pressable
                style={[
                  styles.selectedDateBanner,
                  isPickerExpanded && styles.selectedDateBannerActive,
                ]}
                onPress={() => {
                  hapticLight();
                  setIsPickerExpanded(prev => !prev);
                }}
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
                <View style={styles.dateBannerRight}>
                  <View style={[styles.datePickerActionTag, isPickerExpanded && styles.datePickerActionTagActive]}>
                    <Ionicons
                      name="calendar"
                      size={12}
                      color={isPickerExpanded ? '#000000' : '#4B5563'}
                    />
                    <Text style={[styles.datePickerActionTagText, isPickerExpanded && styles.datePickerActionTagTextActive]}>
                      {isPickerExpanded ? 'Đóng lịch' : 'Đổi lịch & giờ'}
                    </Text>
                    <Ionicons
                      name={isPickerExpanded ? 'chevron-up' : 'chevron-down'}
                      size={13}
                      color={isPickerExpanded ? '#000000' : '#4B5563'}
                    />
                  </View>
                </View>
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
                placeholder="Ví dụ: Cơm trưa, tiền trọ tháng này..."
                placeholderTextColor={THEME.textMuted}
                value={note}
                onChangeText={handleNoteChange}
              />
            </View>

            {/* Receipt Images & Gemini AI OCR Section */}
            <View style={styles.receiptSectionContainer}>
              <View style={styles.receiptSectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="images-outline" size={16} color="#000000" />
                  <Text style={styles.receiptSectionTitle}>ẢNH</Text>
                  <View style={styles.aiTag}>
                    <Ionicons name="sparkles" size={10} color="#6366F1" />
                    <Text style={styles.aiTagText}>AI SCAN</Text>
                  </View>
                </View>
                {receiptImages.length > 0 && (
                  <View style={styles.receiptCountBadge}>
                    <Ionicons name="images-outline" size={12} color="#000000" />
                    <Text style={styles.receiptCountBadgeText}>{receiptImages.length}</Text>
                  </View>
                )}
              </View>

              {/* Action Buttons when no images */}
              {receiptImages.length === 0 ? (
                <View style={styles.receiptEmptyBox}>
                  <View style={[styles.receiptBtnRow, { marginBottom: 0 }]}>
                    <Pressable
                      style={styles.receiptActionBtn}
                      onPress={handleTakePhoto}
                    >
                      <Ionicons name="camera" size={18} color="#000000" />
                      <Text style={styles.receiptActionBtnText}>Chụp ảnh</Text>
                    </Pressable>

                    <Pressable
                      style={styles.receiptActionBtn}
                      onPress={handlePickImagesFromLibrary}
                    >
                      <Ionicons name="images" size={18} color="#000000" />
                      <Text style={styles.receiptActionBtnText}>Chọn ảnh</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.receiptThumbnailsContainer}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.receiptThumbnailsList}
                  >
                    {receiptImages.map((uri, idx) => (
                      <View key={idx} style={styles.receiptThumbWrapper}>
                        <Pressable onPress={() => setViewingImageUri(uri)}>
                          <Image source={{ uri }} style={styles.receiptThumbnail} />
                        </Pressable>
                        <Pressable
                          style={styles.receiptRemoveBtn}
                          onPress={() => handleRemoveReceiptImage(idx)}
                        >
                          <Ionicons name="close" size={12} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    ))}

                    <View style={styles.receiptAddMoreWrapper}>
                      <Pressable
                        style={styles.receiptAddMoreBtn}
                        onPress={handlePickImagesFromLibrary}
                      >
                        <Ionicons name="add" size={18} color="#000000" />
                        <Text style={styles.receiptAddMoreText}>Thêm</Text>
                      </Pressable>
                      <Pressable
                        style={styles.receiptAddMoreCameraBtn}
                        onPress={handleTakePhoto}
                      >
                        <Ionicons name="camera-outline" size={14} color="#000000" />
                      </Pressable>
                    </View>
                  </ScrollView>

                  {/* Rescan Button */}
                  <View style={styles.receiptRescanRow}>
                    <Pressable
                      style={styles.receiptRescanBtn}
                      onPress={() => triggerGeminiScan(receiptImages)}
                      disabled={isScanningReceipt}
                    >
                      <Ionicons name="sparkles" size={13} color="#4338CA" />
                      <Text style={styles.receiptRescanBtnText}>Quét lại bằng Gemini AI</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Scanning status banner */}
              {isScanningReceipt && (
                <View style={styles.receiptScanningBanner}>
                  <ActivityIndicator size="small" color="#4F46E5" />
                  <Text style={styles.receiptScanningText}>
                    Gemini AI đang phân tích hình ảnh & bóc tách dữ liệu...
                  </Text>
                </View>
              )}

              {/* Scan result display */}
              {scanResult && !isScanningReceipt && (
                <View style={styles.receiptResultCard}>
                  <View style={styles.receiptResultHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="checkmark-circle" size={15} color="#15803D" />
                      <Text style={styles.receiptResultTitle}>Dữ liệu nhận diện bởi Gemini AI</Text>
                    </View>
                    {scanResult.confidence !== undefined && (
                      <Text style={styles.receiptConfidenceText}>
                        {Math.round(scanResult.confidence * 100)}% độ tin cậy
                      </Text>
                    )}
                  </View>

                  <View style={styles.receiptResultDetails}>
                    {scanResult.amount ? (
                      <View style={styles.receiptResultRow}>
                        <Text style={styles.receiptResultLabel}>Số tiền nhận diện:</Text>
                        <Text style={styles.receiptResultValueBold}>{formatVND(scanResult.amount)}</Text>
                      </View>
                    ) : null}

                    {scanResult.note ? (
                      <View style={styles.receiptResultRow}>
                        <Text style={styles.receiptResultLabel}>Nội dung / Món:</Text>
                        <Text style={styles.receiptResultValue} numberOfLines={1}>{scanResult.note}</Text>
                      </View>
                    ) : null}

                    {scanResult.category_name ? (
                      <View style={styles.receiptResultRow}>
                        <Text style={styles.receiptResultLabel}>Danh mục gợi ý:</Text>
                        <Text style={styles.receiptResultValue}>{scanResult.category_name}</Text>
                      </View>
                    ) : null}

                    {scanResult.detected_payment_method ? (
                      <View style={styles.receiptResultRow}>
                        <Text style={styles.receiptResultLabel}>Thanh toán qua:</Text>
                        <Text style={styles.receiptResultValueBold} numberOfLines={1}>
                          {scanResult.detected_payment_method}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}

              {/* Items Management Section */}
              {receiptItems.length > 0 || showAddItemBox ? (
                <View style={styles.receiptItemsCard}>
                  <View style={styles.receiptItemsHeader}>
                    <Pressable
                      style={styles.receiptItemsHeaderLeft}
                      onPress={() => setShowItemsBreakdown(!showItemsBreakdown)}
                    >
                      <Ionicons name="receipt-outline" size={15} color="#000000" />
                      <Text style={styles.receiptItemsTitle}>
                        Danh sách món ({receiptItems.length})
                      </Text>
                      <Ionicons
                        name={showItemsBreakdown ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color="#000000"
                      />
                    </Pressable>
                    <View style={styles.receiptItemsHeaderRight}>
                      <Text style={styles.receiptItemsSumText}>
                        {formatVND(itemsSum)}
                      </Text>
                      <Pressable
                        style={styles.addDishSmallBtn}
                        onPress={() => {
                          setShowItemsBreakdown(true);
                          setShowAddItemBox(!showAddItemBox);
                        }}
                      >
                        <Ionicons name={showAddItemBox ? 'close' : 'add'} size={14} color="#000000" />
                      </Pressable>
                    </View>
                  </View>

                  {/* Discrepancy warning banner */}
                  {itemsSum > 0 && Math.abs(itemsSum - amountNumber) > 100 && (
                    <View style={styles.itemDiscrepancyBanner}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemDiscrepancyText}>
                          ⚠️ Tổng món ({formatVND(itemsSum)}) khác với số tiền chi ({formatVND(amountNumber)})
                        </Text>
                      </View>
                      <Pressable
                        style={styles.syncAmountBtn}
                        onPress={handleSyncAmountFromItems}
                      >
                        <Text style={styles.syncAmountBtnText}>Đồng bộ</Text>
                      </Pressable>
                    </View>
                  )}

                  {showItemsBreakdown && (
                    <View style={styles.receiptItemsBody}>
                      {/* Items list */}
                      {receiptItems.map((item, idx) => {
                        const isEditing = editingIndex === idx;
                        if (isEditing) {
                          return (
                            <View key={idx} style={styles.itemEditRow}>
                              <View style={styles.itemEditInputs}>
                                <TextInput
                                  style={[styles.itemEditInput, { flex: 2 }]}
                                  placeholder="Tên món"
                                  placeholderTextColor={THEME.textMuted}
                                  value={editItemName}
                                  onChangeText={setEditItemName}
                                />
                                <TextInput
                                  style={[styles.itemEditInput, { flex: 1.5 }]}
                                  placeholder="Đơn giá"
                                  placeholderTextColor={THEME.textMuted}
                                  keyboardType="numeric"
                                  value={editItemPrice}
                                  onChangeText={setEditItemPrice}
                                />
                                <TextInput
                                  style={[styles.itemEditInput, { width: 44, textAlign: 'center' }]}
                                  placeholder="SL"
                                  placeholderTextColor={THEME.textMuted}
                                  keyboardType="numeric"
                                  value={editItemQty}
                                  onChangeText={setEditItemQty}
                                />
                              </View>
                              <View style={styles.itemEditActions}>
                                <Pressable style={styles.itemSaveBtn} onPress={handleSaveEdit}>
                                  <Text style={styles.itemSaveBtnText}>Lưu</Text>
                                </Pressable>
                                <Pressable style={styles.itemCancelBtn} onPress={handleCancelEdit}>
                                  <Text style={styles.itemCancelBtnText}>Hủy</Text>
                                </Pressable>
                              </View>
                            </View>
                          );
                        }

                        const qty = item.quantity || 1;
                        const price = item.price || 0;
                        const total = qty * price;

                        return (
                          <View key={idx} style={styles.itemRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                              <Text style={styles.itemSubtext}>
                                {qty > 1 ? `${qty} × ${formatVND(price)}` : formatVND(price)}
                              </Text>
                            </View>
                            <Text style={styles.itemTotalText}>{formatVND(total)}</Text>
                            <View style={styles.itemActionBtns}>
                              <Pressable
                                style={styles.itemIconBtn}
                                onPress={() => handleStartEdit(idx)}
                                hitSlop={6}
                              >
                                <Ionicons name="create-outline" size={15} color="#2563EB" />
                              </Pressable>
                              <Pressable
                                style={styles.itemIconBtn}
                                onPress={() => handleDeleteItem(idx)}
                                hitSlop={6}
                              >
                                <Ionicons name="trash-outline" size={15} color="#EF4444" />
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}

                      {/* Form thêm món */}
                      {showAddItemBox && (
                        <View style={styles.addItemFormBox}>
                          <Text style={styles.addItemFormTitle}>+ Thêm món mới</Text>
                          <View style={styles.itemEditInputs}>
                            <TextInput
                              style={[styles.itemEditInput, { flex: 2 }]}
                              placeholder="Tên món (*)"
                              placeholderTextColor={THEME.textMuted}
                              value={newItemName}
                              onChangeText={setNewItemName}
                            />
                            <TextInput
                              style={[styles.itemEditInput, { flex: 1.5 }]}
                              placeholder="Giá (*)"
                              placeholderTextColor={THEME.textMuted}
                              keyboardType="numeric"
                              value={newItemPrice}
                              onChangeText={setNewItemPrice}
                            />
                            <TextInput
                              style={[styles.itemEditInput, { width: 44, textAlign: 'center' }]}
                              placeholder="SL"
                              placeholderTextColor={THEME.textMuted}
                              keyboardType="numeric"
                              value={newItemQty}
                              onChangeText={setNewItemQty}
                            />
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                            <Pressable style={styles.itemCancelBtn} onPress={() => setShowAddItemBox(false)}>
                              <Text style={styles.itemCancelBtnText}>Đóng</Text>
                            </Pressable>
                            <Pressable style={styles.itemSaveBtn} onPress={handleAddItem}>
                              <Text style={styles.itemSaveBtnText}>Thêm món</Text>
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ) : (
                <Pressable
                  style={styles.addItemsManualBtn}
                  onPress={() => {
                    setShowItemsBreakdown(true);
                    setShowAddItemBox(true);
                  }}
                >
                  <Ionicons name="list-outline" size={14} color="#1D4ED8" />
                  <Text style={styles.addItemsManualBtnText}>+ Thêm danh sách món chi tiết</Text>
                </Pressable>
              )}
            </View>


            {/* Amount Display - Placed right above the keypad */}
            <View style={styles.amountDisplayContainer}>
              <Text style={styles.amountLabel}>
                {isCreditWallet && creditMode === 'installment' && installmentInputMode === 'per_term'
                  ? `Số tiền mỗi kỳ (Tổng ${count} kỳ)`
                  : type === 'expense'
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
                {isCreditWallet && creditMode === 'installment' && installmentInputMode === 'per_term'
                  ? formatVND(parseInt(termAmountStr, 10) || 0)
                  : formatVND(amountNumber)}
              </Text>
              {isCreditWallet && creditMode === 'installment' && (
                <Text style={styles.amountInstallmentSubtext}>
                  {installmentInputMode === 'per_term'
                    ? `Tổng gốc ban đầu: ${formatVND(amountNumber)}${paidCount > 0 ? ` • Dư nợ ghi thẻ (${count - paidCount} kỳ): ${formatVND(totalRemainingPayable)}` : ''}`
                    : `Mỗi kỳ: ~${formatVND(basePrincipalPerTerm + feeNumber)} • Còn ${count - paidCount} kỳ cần trả`}
                </Text>
              )}
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
                isSaving && { opacity: 0.6 },
                pressed && !isSaving && { opacity: 0.9 },
              ]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <>
                  <Ionicons name="checkmark-sharp" size={22} color="#000000" />
                  <Text style={styles.saveBtnText}>Lưu giao dịch</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
        {AlertModalComponent}

        {/* Fullscreen Image Preview Modal */}
        <Modal
          visible={!!viewingImageUri}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setViewingImageUri(null)}
        >
          <View style={styles.fullscreenModalBackdrop}>
            <Pressable
              style={styles.fullscreenCloseBtn}
              onPress={() => setViewingImageUri(null)}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
            {viewingImageUri && (
              <Image
                source={{ uri: viewingImageUri }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>
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
    marginHorizontal: -2,
  },
  horizontalChipsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 2,
    paddingVertical: 2,
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
    gap: 6,
    marginBottom: 8,
  },
  quickDateChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
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
    textAlign: 'center',
  },
  quickDateChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
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
  selectedDateBannerActive: {
    backgroundColor: '#FAF8F5',
  },
  dateBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dateBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  datePickerActionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  datePickerActionTagActive: {
    backgroundColor: THEME.popYellow,
  },
  datePickerActionTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  datePickerActionTagTextActive: {
    fontWeight: '900',
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
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  smartBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
    maxWidth: '70%',
  },
  smartBadgeText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  smartChipsWrapper: {
    marginBottom: 8,
  },
  smartChipsScrollContainer: {
    flexDirection: 'row',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  smartChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginRight: 6,
  },
  smartChipSelected: {
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  smartChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  smartChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  confidenceDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginLeft: 5,
  },
  // Credit Card & Installment Settings Styles
  creditCardSettingsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  creditCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  creditCardBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  creditCardBadgeText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  creditCardTag: {
    backgroundColor: '#000000',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  creditCardTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FACC15',
  },
  creditPlanToggleBtn: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  creditPlanToggleBtnActive: {
    backgroundColor: '#DCFCE7',
  },
  creditPlanToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  creditPlanToggleTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  creditCardBody: {
    marginTop: 10,
  },
  creditModeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    padding: 2,
    marginBottom: 10,
    gap: 4,
  },
  creditModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    borderRadius: 7,
  },
  creditModeTabActive: {
    backgroundColor: THEME.popYellow,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  creditModeTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  creditModeTabTextActive: {
    fontWeight: '900',
    color: '#000000',
  },
  creditDueSection: {
    marginTop: 2,
  },
  creditFieldLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#4B5563',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  creditDateHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    padding: 8,
    marginBottom: 8,
  },
  creditDateHeroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  creditDateHeroIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: THEME.popYellow,
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditDateHeroTexts: {
    flex: 1,
  },
  creditDateHeroMain: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  creditDateHeroSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 1,
  },
  creditDateHeroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creditDateStepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditDateEditBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditDateEditBtnActive: {
    backgroundColor: '#FEF08A',
    borderColor: '#000000',
  },
  creditManualDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    backgroundColor: '#FFFBEB',
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  creditManualDateLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  creditManualDateInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  creditQuickChipsGrid: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  creditQuickGridChip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditQuickGridChipActive: {
    backgroundColor: THEME.popYellow,
  },
  creditQuickGridChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
  },
  creditQuickGridChipTextActive: {
    fontWeight: '900',
    color: '#000000',
  },
  creditInfoCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F0FDFA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  creditInfoCalloutText: {
    flex: 1,
    fontSize: 10,
    color: '#115E59',
    lineHeight: 14,
  },
  creditInstallmentSection: {
    marginTop: 2,
  },
  installmentCountRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  installmentCountChip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  installmentCountChipActive: {
    backgroundColor: THEME.popYellow,
  },
  installmentCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
  },
  installmentCountTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  installmentInputsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  installmentInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  installmentTextInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
    padding: 0,
  },
  installmentInputUnit: {
    fontSize: 12,
    fontWeight: '900',
    color: '#6B7280',
    marginLeft: 4,
  },
  schedulePreviewBox: {
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    padding: 8,
  },
  schedulePreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 4,
    marginBottom: 4,
  },
  schedulePreviewTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
  },
  schedulePreviewTotal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#DC2626',
  },
  scheduleTable: {
    gap: 4,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  scheduleRowPaid: {
    opacity: 0.55,
  },
  scheduleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scheduleTermBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#000000',
  },
  scheduleTermBadgePaid: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  scheduleTermBadgeTextPaid: {
    color: '#15803D',
    fontWeight: '900',
  },
  scheduleTermBadgeNext: {
    backgroundColor: THEME.popYellow,
    borderColor: '#000000',
  },
  scheduleTermBadgeTextNext: {
    color: '#000000',
    fontWeight: '900',
  },
  scheduleTermBadgeFirst: {
    backgroundColor: THEME.popYellow,
  },
  scheduleTermBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#374151',
  },
  scheduleTermBadgeTextFirst: {
    color: '#000000',
    fontWeight: '900',
  },
  scheduleDateText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
  },
  scheduleDateTextPaid: {
    color: '#6B7280',
    fontStyle: 'italic',
  },
  scheduleRowRight: {
    alignItems: 'flex-end',
  },
  scheduleTotalText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
  },
  scheduleTotalTextPaid: {
    color: '#6B7280',
    textDecorationLine: 'line-through',
  },
  scheduleFeeText: {
    fontSize: 8.5,
    fontWeight: '600',
    color: '#6B7280',
  },
  paidTermsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    padding: 8,
    marginBottom: 8,
  },
  paidTermsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  paidTermsBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#16A34A',
  },
  paidTermsBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  paidTermsStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paidTermsStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidTermsStepBtnDisabled: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  paidTermsValueCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  paidTermsValueTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  amountInstallmentSubtext: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    marginTop: 2,
    textAlign: 'center',
  },
  installmentModeTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  installmentModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  installmentModeTabActive: {
    backgroundColor: THEME.popYellow,
  },
  installmentModeTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  installmentModeTabTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  installmentPerTermBox: {
    backgroundColor: '#FEF9C3',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    padding: 8,
    marginBottom: 8,
  },
  installmentPerTermHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  installmentCalcBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#000000',
  },
  installmentCalcBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#000000',
  },
  installmentPerTermCalcSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#854D0E',
    marginTop: 4,
  },
  installmentSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginTop: 4,
    minHeight: 36,
  },
  installmentSummaryLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  installmentSummaryText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#000000',
  },
  scheduleToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: THEME.popYellow,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
  },
  scheduleToggleBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
  },
  paidSummaryNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#16A34A',
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 4,
  },
  paidSummaryNoticeText: {
    flex: 1,
    fontSize: 9.5,
    fontWeight: '700',
    color: '#15803D',
    lineHeight: 13,
  },
  receiptSectionContainer: {
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 14,
    padding: 12,
  },
  receiptSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  receiptSectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  aiTagText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#4338CA',
  },
  receiptCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  receiptCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  receiptEmptyBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  receiptBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 8,
  },
  receiptActionBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  receiptActionBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#000000',
  },
  receiptHelperText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 15,
  },
  receiptThumbnailsContainer: {
    marginTop: 4,
  },
  receiptThumbnailsList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  receiptThumbWrapper: {
    position: 'relative',
    width: 68,
    height: 68,
  },
  receiptThumbnail: {
    width: 68,
    height: 68,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#E2E8F0',
  },
  receiptRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  receiptAddMoreWrapper: {
    flexDirection: 'row',
    gap: 6,
    height: 68,
    alignItems: 'center',
  },
  receiptAddMoreBtn: {
    width: 60,
    height: 68,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  receiptAddMoreText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
  },
  receiptAddMoreCameraBtn: {
    width: 34,
    height: 68,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptRescanRow: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  receiptRescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#6366F1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  receiptRescanBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4338CA',
  },
  receiptScanningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#6366F1',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  receiptScanningText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#3730A3',
    lineHeight: 16,
  },
  receiptResultCard: {
    marginTop: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#16A34A',
    borderRadius: 10,
    padding: 10,
  },
  receiptResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#BBF7D0',
  },
  receiptResultTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#15803D',
  },
  receiptConfidenceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  receiptResultDetails: {
    gap: 3,
  },
  receiptResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiptResultLabel: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  receiptResultValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#111827',
    maxWidth: '65%',
  },
  receiptResultValueBold: {
    fontSize: 13,
    fontWeight: '900',
    color: '#15803D',
    maxWidth: '65%',
  },
  addItemsManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
  },
  addItemsManualBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  receiptItemsCard: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  receiptItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FAF8F5',
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
  },
  receiptItemsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  receiptItemsTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  receiptItemsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  receiptItemsSumText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#059669',
  },
  addDishSmallBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: THEME.popYellow,
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDiscrepancyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1.5,
    borderBottomColor: '#D97706',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  itemDiscrepancyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    lineHeight: 15,
  },
  syncAmountBtn: {
    backgroundColor: '#D97706',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#000000',
  },
  syncAmountBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  receiptItemsBody: {
    padding: 8,
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 6,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  itemSubtext: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  itemTotalText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  itemActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemIconBtn: {
    padding: 3,
  },
  itemEditRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 8,
    gap: 6,
  },
  itemEditInputs: {
    flexDirection: 'row',
    gap: 6,
  },
  itemEditInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    color: '#000000',
    fontWeight: '700',
  },
  itemEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  itemSaveBtn: {
    backgroundColor: THEME.primary,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  itemSaveBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
  },
  itemCancelBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  itemCancelBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  addItemFormBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#059669',
    borderRadius: 8,
    padding: 8,
    gap: 6,
    marginTop: 4,
  },
  addItemFormTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  fullscreenModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  fullscreenImage: {
    width: '94%',
    height: '80%',
  },
});
