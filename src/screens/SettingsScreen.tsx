import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Share,
  ActivityIndicator,
  Switch,
  Animated,
} from 'react-native';
import { useCustomAlert } from '../components/CustomAlertModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import dayjs from 'dayjs';
import { useWallet } from '../context/WalletContext';
import { useSecurity } from '../context/SecurityContext';
import { CategoryManagementModal } from '../components/CategoryManagementModal';
import { GoogleDriveSyncModal } from '../components/GoogleDriveSyncModal';
import { NeoDropdown, DropdownOption } from '../components/NeoDropdown';
import { syncWidgetData } from '../services/widgetSyncService';
import { loadCloudBackupConfig } from '../services/cloudBackupStorage';
import { useSQLiteContext } from 'expo-sqlite';
import { THEME } from '../constants';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '../utils/haptics';
import {
  getGeminiApiKey,
  saveGeminiApiKey,
  getPreferredGeminiModel,
  savePreferredGeminiModel,
  testGeminiConnection,
  getReceiptStorageStats,
  ReceiptStorageStats,
  GEMINI_MODELS,
  GEMINI_MODEL_OPTIONS,
  formatGeminiErrorMessage,
} from '../services/geminiService';
import {
  loadHabitConfig,
  saveHabitConfig,
  refreshHabitReminders,
  sendTestHabitNotificationAsync,
  setupNotificationChannelAsync,
  discoverLearnedHabits,
  toggleHabitItem,
  LearnedHabit,
  HabitReminderConfig,
  DEFAULT_HABIT_CONFIG,
} from '../services/habitNotificationService';

interface SettingsScreenProps {
  navigation: any;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const {
    wallets,
    summary,
    transactions,
    debts,
    categories,
    isBalanceHidden,
    toggleHideBalance,
    exportDataToJsonString,
    importDataFromJsonString,
    resetAllData,
    purgeReceiptImages,
  } = useWallet();

  const {
    isAppLockEnabled,
    useFingerprint,
    hasPinCode,
    isHardwareSupported,
    hapticsEnabled,
    autoLockTimeout,
    updateAutoLockTimeout,
    temporarilyBypassLock,
    toggleAppLock,
    toggleFingerprint,
    toggleHaptics,
    updatePinCode,
  } = useSecurity();

  const { showAlert, showConfirm, AlertModalComponent } = useCustomAlert(true);

  const db = useSQLiteContext();
  const [googleDriveModalVisible, setGoogleDriveModalVisible] = useState<boolean>(false);
  const [isDriveLinked, setIsDriveLinked] = useState<boolean>(false);
  const [driveUserEmail, setDriveUserEmail] = useState<string>('');

  const checkDriveStatus = useCallback(async () => {
    try {
      const conf = await loadCloudBackupConfig(db);
      setIsDriveLinked(conf.isLinked);
      setDriveUserEmail(conf.user?.email || '');
    } catch {
      // ignore
    }
  }, [db]);

  useEffect(() => {
    checkDriveStatus();
  }, [checkDriveStatus]);

  const [categoryModalVisible, setCategoryModalVisible] = useState<boolean>(false);
  const [habitConfig, setHabitConfig] = useState<HabitReminderConfig>(DEFAULT_HABIT_CONFIG);

  // Gemini AI Settings
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [selectedGeminiModel, setSelectedGeminiModel] = useState<string>(GEMINI_MODELS[0]);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isTestingGemini, setIsTestingGemini] = useState<boolean>(false);
  const [geminiStatus, setGeminiStatus] = useState<{ checked: boolean; success: boolean; message: string; model?: string }>({
    checked: false,
    success: false,
    message: '',
  });

  const geminiModelDropdownOptions = useMemo<DropdownOption[]>(() => {
    return GEMINI_MODEL_OPTIONS.map(m => ({
      id: m.id,
      label: `${m.name}${m.badge ? ` (${m.badge})` : ''}`,
      badge: m.badge,
    }));
  }, []);

  const currentModelInfo = useMemo(() => {
    return GEMINI_MODEL_OPTIONS.find(m => m.id === selectedGeminiModel) || GEMINI_MODEL_OPTIONS[0];
  }, [selectedGeminiModel]);

  const handleSelectModel = async (modelId: string | null) => {
    if (!modelId) return;
    hapticLight();
    setSelectedGeminiModel(modelId);
    await savePreferredGeminiModel(db, modelId);
  };

  // Receipt Image Storage Cleanup states
  const [selectedPurgeDays, setSelectedPurgeDays] = useState<number>(30);
  const [customPurgeDays, setCustomPurgeDays] = useState<string>('30');
  const [isCustomDays, setIsCustomDays] = useState<boolean>(false);
  const [storageStats, setStorageStats] = useState<ReceiptStorageStats | null>(null);
  const [isScanningStorage, setIsScanningStorage] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);

  const refreshStorageStats = useCallback(async (days: number) => {
    if (days <= 0) return;
    setIsScanningStorage(true);
    try {
      const stats = await getReceiptStorageStats(db, days);
      setStorageStats(stats);
    } catch (err) {
      console.warn('Lỗi quét bộ nhớ ảnh:', err);
    } finally {
      setIsScanningStorage(false);
    }
  }, [db]);

  useEffect(() => {
    const days = isCustomDays ? parseInt(customPurgeDays, 10) : selectedPurgeDays;
    if (!isNaN(days) && days > 0) {
      refreshStorageStats(days);
    }
  }, [selectedPurgeDays, isCustomDays, refreshStorageStats]);

  const handleExecutePurge = () => {
    const days = isCustomDays ? parseInt(customPurgeDays, 10) : selectedPurgeDays;
    if (isNaN(days) || days <= 0) {
      showAlert('Lỗi', 'Vui lòng nhập số ngày hợp lệ (lớn hơn 0)');
      return;
    }

    if (!storageStats || storageStats.imageCount === 0) {
      showAlert('Không có ảnh', `Không có ảnh hóa đơn nào cũ hơn ${days} ngày.`);
      return;
    }

    showConfirm(
      'Xác nhận dọn dẹp ảnh',
      `Hành động này sẽ xóa vĩnh viễn ${storageStats.imageCount} ảnh hóa đơn (${storageStats.totalFormatted}) của ${storageStats.transactionCount} giao dịch trước ngày ${storageStats.cutoffDateStr} để giải phóng bộ nhớ máy.\n\nThông tin giao dịch (số tiền, danh mục, ghi chú) vẫn được lưu giữ nguyên vẹn. Ngài có chắc chắn muốn dọn dẹp không?`,
      async () => {
        try {
          hapticMedium();
          setIsPurging(true);
          const result = await purgeReceiptImages(days);
          setIsPurging(false);
          hapticSuccess();
          showAlert(
            'Dọn dẹp thành công!',
            `Đã giải phóng ${result.freedFormatted} bộ nhớ máy.\nĐã xóa ${result.cleanedImages} ảnh của ${result.cleanedTransactions} giao dịch trước ngày ${result.cutoffDateStr}.`
          );
          await refreshStorageStats(days);
        } catch (err: any) {
          setIsPurging(false);
          hapticError();
          showAlert('Lỗi dọn dẹp', err?.message || 'Không thể xóa ảnh');
        }
      }
    );
  };

  useEffect(() => {
    getGeminiApiKey(db).then((key) => {
      setGeminiApiKey(key);
      if (key) {
        setGeminiStatus({ checked: true, success: true, message: 'Đã lưu API Key' });
      }
    });
    getPreferredGeminiModel(db).then((model) => {
      if (model) {
        setSelectedGeminiModel(model);
      }
    });
  }, [db]);

  const handleSaveGeminiKey = async () => {
    hapticLight();
    await saveGeminiApiKey(db, geminiApiKey);
    await savePreferredGeminiModel(db, selectedGeminiModel);
    hapticSuccess();
    showAlert('Thành công', 'Đã lưu cấu hình Gemini API & Mô hình ưu tiên');
    setGeminiStatus({
      checked: true,
      success: !!geminiApiKey.trim(),
      message: geminiApiKey.trim() ? 'Đã lưu API Key' : 'Chưa nhập Key',
    });
  };

  const handleTestGeminiConnection = async () => {
    if (!geminiApiKey.trim()) {
      hapticError();
      showAlert('Chưa nhập Key', 'Vui lòng nhập Gemini API Key trước khi kiểm tra.');
      return;
    }
    hapticMedium();
    setIsTestingGemini(true);
    try {
      const res = await testGeminiConnection(db, geminiApiKey.trim(), selectedGeminiModel);
      setIsTestingGemini(false);
      if (res.success) {
        hapticSuccess();
        setGeminiStatus({ checked: true, success: true, message: res.message, model: res.model });

        if (res.isFallback && res.model && res.model !== selectedGeminiModel) {
          showConfirm(
            'Đổi mô hình mặc định?',
            `Mô hình "${selectedGeminiModel}" đang gặp sự cố hoặc nghẽn mạng. Đã kết nối thành công qua mô hình dự phòng "${res.model}".\n\nBạn có muốn đặt "${res.model}" làm mô hình mặc định không?`,
            async () => {
              await savePreferredGeminiModel(db, res.model!);
              setSelectedGeminiModel(res.model!);
              hapticSuccess();
              showAlert('Thành công', `Đã chuyển mô hình mặc định sang "${res.model}".`);
            },
            {
              confirmText: 'Đồng ý đổi',
              cancelText: 'Giữ nguyên',
              type: 'info',
            }
          );
        } else {
          showAlert('Kết nối thành công', `Đã kết nối thành công tới Gemini API qua mô hình: ${res.model || selectedGeminiModel}`);
        }
      } else {
        hapticError();
        setGeminiStatus({ checked: true, success: false, message: res.message });
        showAlert('Kết nối thất bại', res.message);
      }
    } catch (err: any) {
      setIsTestingGemini(false);
      hapticError();
      const friendlyMsg = formatGeminiErrorMessage(err);
      setGeminiStatus({ checked: true, success: false, message: friendlyMsg });
      showAlert('Lỗi kết nối', friendlyMsg);
    }
  };

  useEffect(() => {
    loadHabitConfig().then((conf) => setHabitConfig(conf));
  }, []);

  const discoveredHabits = useMemo(() => {
    return discoverLearnedHabits(transactions, categories, habitConfig);
  }, [transactions, categories, habitConfig]);

  const handleToggleSingleHabit = async (habitId: string, currentEnabled: boolean) => {
    hapticLight();
    const updated = await toggleHabitItem(habitId, !currentEnabled);
    setHabitConfig(updated);
    await refreshHabitReminders(transactions, categories);
  };

  const handleToggleHabitEnabled = async (val: boolean) => {
    hapticLight();
    if (val) {
      const granted = await setupNotificationChannelAsync();
      if (!granted) {
        showAlert(
          'Cần cấp quyền thông báo',
          'Vui lòng bật quyền thông báo trong Cài đặt hệ thống để ứng dụng có thể gửi nhắc nhở thói quen.'
        );
        return;
      }
    }
    const updated = await saveHabitConfig({ enabled: val });
    setHabitConfig(updated);
    await refreshHabitReminders(transactions, categories);
  };

  const handleToggleAutoLearn = async (val: boolean) => {
    hapticLight();
    const updated = await saveHabitConfig({ autoLearn: val });
    setHabitConfig(updated);
    await refreshHabitReminders(transactions, categories);
  };

  const handleTestNotification = async () => {
    hapticSuccess();
    const ok = await sendTestHabitNotificationAsync();
    if (ok) {
      showAlert(
        'Đã kích hoạt thử nghiệm',
        'Một thông báo sẽ xuất hiện trên thanh thông báo trong 2 giây tới. Hãy vuốt mở hoặc khóa màn hình để kiểm tra nhé!'
      );
    } else {
      showAlert(
        'Chưa thể gửi thông báo',
        'Ứng dụng chưa được cấp quyền gửi thông báo trên thiết bị này.'
      );
    }
  };

  const [pinModalVisible, setPinModalVisible] = useState<boolean>(false);
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');
  const [pinInput, setPinInput] = useState<string>('');
  const [confirmPinInput, setConfirmPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const pinShakeAnim = useRef(new Animated.Value(0)).current;

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');

  // Modal xem / sao chép JSON
  const [jsonPreviewModalVisible, setJsonPreviewModalVisible] = useState<boolean>(false);
  const [jsonContent, setJsonContent] = useState<string>('');

  // Modal dán JSON để nhập
  const [jsonPasteModalVisible, setJsonPasteModalVisible] = useState<boolean>(false);
  const [pastedJson, setPastedJson] = useState<string>('');

  // 1. Xử lý xuất file .json qua Sharing API
  const handleExportFile = async () => {
    try {
      temporarilyBypassLock(120000);
      setIsProcessing(true);
      const jsonStr = await exportDataToJsonString();
      const dateStr = dayjs().format('YYYYMMDD_HHmm');
      const filename = `MultiWallet_Backup_${dateStr}.json`;
      const backupFile = new File(Paths.cache, filename);
      backupFile.create({ overwrite: true });
      backupFile.write(jsonStr);
      const fileUri = backupFile.uri;

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Sao lưu dữ liệu Ví Của Tôi',
          UTI: 'public.json',
        });
      } else {
        // Dự phòng bằng Share API mặc định
        await Share.share({
          message: jsonStr,
          title: filename,
        });
      }
    } catch (err: any) {
      showAlert('Lỗi xuất dữ liệu', err?.message || 'Không thể tạo file sao lưu');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Mở modal xem và copy mã JSON
  const handleViewJson = async () => {
    try {
      setIsProcessing(true);
      const jsonStr = await exportDataToJsonString();
      setJsonContent(jsonStr);
      setJsonPreviewModalVisible(true);
    } catch (err: any) {
      showAlert('Lỗi', err?.message || 'Không thể tải mã JSON');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Xử lý chọn file .json từ máy
  const handlePickFileToImport = async () => {
    try {
      temporarilyBypassLock(120000);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setIsProcessing(true);

      let content = '';
      try {
        content = await LegacyFileSystem.readAsStringAsync(asset.uri, {
          encoding: LegacyFileSystem.EncodingType.UTF8,
        });
      } catch (readErr) {
        // Fallback đọc qua fetch cho URI content:// hoặc file:// trên Android
        const resp = await fetch(asset.uri);
        content = await resp.text();
      }

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        showAlert('Lỗi file', 'Nội dung file không đúng định dạng JSON.');
        setIsProcessing(false);
        return;
      }

      const raw = parsed.data || parsed;
      const wCount = (raw.wallets || []).length;
      const tCount = (raw.transactions || []).length;
      const dCount = (raw.debts || []).length;

      showConfirm(
        'Xác nhận khôi phục',
        `Phát hiện dữ liệu gồm:\n• ${wCount} ví tiền\n• ${tCount} giao dịch\n• ${dCount} khoản nợ\n\nChế độ: ${
          importMode === 'replace'
            ? 'GHI ĐÈ TOÀN BỘ (xóa dữ liệu hiện tại)'
            : 'HỢP NHẤT (bổ sung dữ liệu)'
        }\n\nBạn có muốn tiếp tục?`,
        async () => {
          try {
            setIsProcessing(true);
            const res = await importDataFromJsonString(content, importMode);
            showAlert(
              'Thành công',
              `Đã khôi phục thành công:\n• ${res.walletsCount} ví tiền\n• ${res.transactionsCount} giao dịch\n• ${res.debtsCount} khoản nợ`
            );
          } catch (importErr: any) {
            showAlert('Lỗi khôi phục', importErr?.message || 'Không thể nhập dữ liệu');
          } finally {
            setIsProcessing(false);
          }
        },
        {
          destructive: importMode === 'replace',
          confirmText: 'Tiến hành khôi phục',
        }
      );
    } catch (err: any) {
      showAlert('Lỗi chọn file', err?.message || 'Không thể đọc file đã chọn');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Xử lý nhập JSON dán trực tiếp
  const handleImportPastedJson = async () => {
    if (!pastedJson.trim()) {
      showAlert('Thiếu dữ liệu', 'Vui lòng dán nội dung JSON vào ô.');
      return;
    }

    try {
      setIsProcessing(true);
      const res = await importDataFromJsonString(pastedJson.trim(), importMode);
      setJsonPasteModalVisible(false);
      setPastedJson('');
      showAlert(
        'Thành công',
        `Đã khôi phục thành công:\n• ${res.walletsCount} ví tiền\n• ${res.transactionsCount} giao dịch\n• ${res.debtsCount} khoản nợ`
      );
    } catch (err: any) {
      showAlert('Lỗi nhập dữ liệu', err?.message || 'Nội dung JSON không hợp lệ');
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerPinShake = () => {
    Animated.sequence([
      Animated.timing(pinShakeAnim, { toValue: 8, duration: 45, useNativeDriver: true }),
      Animated.timing(pinShakeAnim, { toValue: -8, duration: 45, useNativeDriver: true }),
      Animated.timing(pinShakeAnim, { toValue: 6, duration: 45, useNativeDriver: true }),
      Animated.timing(pinShakeAnim, { toValue: -6, duration: 45, useNativeDriver: true }),
      Animated.timing(pinShakeAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  };

  const handleOpenSetPin = () => {
    hapticMedium();
    setPinStep('enter');
    setPinInput('');
    setConfirmPinInput('');
    setPinError('');
    setPinModalVisible(true);
  };

  const handleToggleAppLock = async (val: boolean) => {
    hapticMedium();
    if (val && !hasPinCode) {
      handleOpenSetPin();
      return;
    }
    await toggleAppLock(val);
  };

  const handlePinDigitPress = async (digit: string) => {
    hapticLight();
    setPinError('');

    if (pinStep === 'enter') {
      if (pinInput.length >= 4) return;
      const next = pinInput + digit;
      setPinInput(next);
      if (next.length === 4) {
        hapticSuccess();
        setTimeout(() => {
          setPinStep('confirm');
        }, 220);
      }
    } else {
      if (confirmPinInput.length >= 4) return;
      const next = confirmPinInput + digit;
      setConfirmPinInput(next);
      if (next.length === 4) {
        if (next === pinInput) {
          hapticSuccess();
          await updatePinCode(next);
          await toggleAppLock(true);
          setPinModalVisible(false);
          showAlert('Thành công', 'Đã lưu mã PIN và kích hoạt khóa bảo mật.');
        } else {
          hapticError();
          triggerPinShake();
          setPinError('Mã xác nhận không khớp! Vui lòng nhập lại.');
          setTimeout(() => {
            setConfirmPinInput('');
          }, 500);
        }
      }
    }
  };

  const handlePinBackspace = () => {
    hapticLight();
    setPinError('');
    if (pinStep === 'enter') {
      if (pinInput.length > 0) {
        setPinInput(prev => prev.slice(0, -1));
      }
    } else {
      if (confirmPinInput.length > 0) {
        setConfirmPinInput(prev => prev.slice(0, -1));
      } else {
        setPinStep('enter');
      }
    }
  };

  const handlePinResetOrBack = () => {
    hapticLight();
    setPinError('');
    if (pinStep === 'confirm') {
      setPinStep('enter');
      setConfirmPinInput('');
    } else {
      setPinInput('');
    }
  };

  // 5. Xử lý Đặt lại dữ liệu gốc (Reset)
  const handleResetApp = () => {
    showConfirm(
      'Cảnh báo xóa toàn bộ dữ liệu',
      'Hành động này sẽ xóa vĩnh viễn toàn bộ ví, giao dịch và sổ nợ hiện tại trên máy của bạn. Bạn không thể hoàn tác sau khi đã xóa.\n\nBạn có chắc chắn muốn tiếp tục?',
      async () => {
        try {
          setIsProcessing(true);
          await resetAllData();
          showAlert('Đã hoàn tất', 'Ứng dụng đã được đưa về trạng thái dữ liệu ban đầu.');
        } catch (err: any) {
          showAlert('Lỗi đặt lại', err?.message || 'Không thể xóa dữ liệu');
        } finally {
          setIsProcessing(false);
        }
      },
      { destructive: true, confirmText: 'XÓA TẤT CẢ' }
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.topHeader}>
        <Pressable
          style={styles.backBtnShadow}
          onPress={() => navigation.goBack()}
        >
          <View style={styles.backBtnInner}>
            <Ionicons name="arrow-back" size={20} color="#000000" />
          </View>
        </Pressable>

        <View style={styles.headerTitleCol}>
          <Text style={styles.screenTitle}>Cài Đặt & Dữ Liệu</Text>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Database Summary Card */}
        <View style={styles.cardShadow}>
          <View style={styles.cardInner}>
            <View style={[styles.folderTab, { backgroundColor: THEME.popYellow }]}>
              <Text style={styles.folderTabText}>DỮ LIỆU HIỆN TẠI</Text>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{wallets.length}</Text>
                  <Text style={styles.statLabel}>Ví tiền</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{transactions.length}</Text>
                  <Text style={styles.statLabel}>Giao dịch</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{debts.length}</Text>
                  <Text style={styles.statLabel}>Khoản nợ</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{categories.length}</Text>
                  <Text style={styles.statLabel}>Danh mục</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Security & App Lock Section */}
        <View style={styles.cardShadow}>
          <View style={styles.cardInner}>
            <View style={[styles.folderTab, { backgroundColor: '#EF4444' }]}>
              <Text style={[styles.folderTabText, { color: '#FFFFFF' }]}>BẢO MẬT & KHÓA ỨNG DỤNG</Text>
            </View>

            <View style={styles.cardBody}>
              {/* App Lock Switch */}
              <View style={styles.settingRow}>
                <View style={styles.settingRowLeft}>
                  <View style={[styles.settingRowIconBox, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="lock-closed" size={18} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingRowTitle}>Khóa ứng dụng khi mở</Text>
                    <Text style={styles.settingRowDesc}>
                      {isAppLockEnabled
                        ? 'Đang bật • Yêu cầu xác thực khi mở app'
                        : 'Đang tắt • Không yêu cầu mã khóa'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isAppLockEnabled}
                  onValueChange={handleToggleAppLock}
                  trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.divider} />

              {/* Fingerprint Lock Switch */}
              <View style={styles.settingRow}>
                <View style={styles.settingRowLeft}>
                  <View style={[styles.settingRowIconBox, { backgroundColor: THEME.primaryLight }]}>
                    <Ionicons name="finger-print" size={18} color="#000000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingRowTitle}>Mở khóa bằng Vân tay</Text>
                    <Text style={styles.settingRowDesc}>
                      {isHardwareSupported
                        ? useFingerprint
                          ? 'Đang bật • Tự động quét vân tay khi mở'
                          : 'Đang tắt • Chỉ sử dụng mã PIN 4 số'
                        : 'Thiết bị không hỗ trợ cảm biến vân tay'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={useFingerprint}
                  disabled={!isHardwareSupported}
                  onValueChange={(val) => {
                    hapticMedium();
                    toggleFingerprint(val);
                  }}
                  trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.divider} />

              {/* Set / Change PIN Button */}
              <Pressable
                style={styles.actionBtnSecondary}
                onPress={handleOpenSetPin}
              >
                <Ionicons name="keypad-outline" size={18} color="#000000" />
                <Text style={styles.actionBtnTextSecondary}>
                  {hasPinCode ? 'Đổi mã PIN 4 số' : 'Thiết lập mã PIN 4 số'}
                </Text>
              </Pressable>

              {/* Auto Lock Timeout options when App Lock is enabled */}
              {isAppLockEnabled && (
                <>
                  <View style={styles.divider} />
                  <View style={{ marginTop: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Ionicons name="timer-outline" size={16} color="#4B5563" />
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#1F2937' }}>
                        Thời gian tự động khóa
                      </Text>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingVertical: 4 }}
                    >
                      {[
                        { label: 'Ngay lập tức', value: 0 },
                        { label: '15 giây', value: 15 },
                        { label: '30 giây (Chuẩn)', value: 30 },
                        { label: '1 phút', value: 60 },
                        { label: '5 phút', value: 300 },
                      ].map((item) => {
                        const isSelected = autoLockTimeout === item.value;
                        return (
                          <Pressable
                            key={item.value}
                            style={[
                              styles.timeoutPill,
                              isSelected && styles.timeoutPillActive,
                            ]}
                            onPress={() => {
                              hapticLight();
                              updateAutoLockTimeout(item.value);
                            }}
                          >
                            <Text
                              style={[
                                styles.timeoutPillText,
                                isSelected && styles.timeoutPillTextActive,
                              ]}
                            >
                              {item.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>
                      {autoLockTimeout === 0
                        ? 'Khóa ngay khi bạn rời khỏi app.'
                        : `Không yêu cầu xác thực lại nếu quay lại app trong vòng ${
                            autoLockTimeout < 60
                              ? `${autoLockTimeout} giây`
                              : `${Math.round(autoLockTimeout / 60)} phút`
                          }.`}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Categories Section */}
        <View style={styles.cardShadow}>
          <View style={styles.cardInner}>
            <View style={[styles.folderTab, { backgroundColor: THEME.popYellow }]}>
              <Text style={styles.folderTabText}>QUẢN LÝ DANH MỤC</Text>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.actionButtonsCol}>
                <Pressable
                  style={styles.actionBtnPrimary}
                  onPress={() => {
                    hapticMedium();
                    setCategoryModalVisible(true);
                  }}
                >
                  <Ionicons name="pricetags-outline" size={18} color="#000000" />
                  <Text style={styles.actionBtnText}>Quản lý danh mục thu & chi tiêu</Text>
                  <Ionicons name="chevron-forward" size={16} color="#000000" style={{ marginLeft: 'auto' }} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Google Drive Cloud Sync Section */}
        <View style={styles.cardShadow}>
          <View style={styles.cardInner}>
            <View style={[styles.folderTab, { backgroundColor: THEME.popYellow }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="logo-google" size={15} color="#000000" />
                <Text style={styles.folderTabText}>GOOGLE DRIVE CLOUD SYNC</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={styles.cardSectionTitle}>Đồng bộ Google Drive</Text>
                <View style={[
                  styles.gdriveBadge,
                  { backgroundColor: isDriveLinked ? '#DCFCE7' : '#F3F4F6' }
                ]}>
                  <View style={[
                    styles.gdriveDot,
                    { backgroundColor: isDriveLinked ? '#15803D' : '#9CA3AF' }
                  ]} />
                  <Text style={[
                    styles.gdriveBadgeText,
                    { color: isDriveLinked ? '#15803D' : '#6B7280' }
                  ]}>
                    {isDriveLinked ? 'Đã liên kết' : 'Chưa liên kết'}
                  </Text>
                </View>
              </View>

              <Pressable
                style={styles.actionBtnGoogle}
                onPress={() => {
                  hapticMedium();
                  setGoogleDriveModalVisible(true);
                }}
              >
                <Ionicons name="cloud-outline" size={18} color="#000000" />
                <Text style={styles.actionBtnText}>
                  {isDriveLinked ? 'Quản lý sao lưu Google Drive' : 'Liên kết tài khoản Google Drive'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#000000" style={{ marginLeft: 'auto' }} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Gemini AI & Invoice Scanning Section */}
        <View style={styles.cardShadow}>
          <View style={styles.cardInner}>
            <View style={[styles.folderTab, { backgroundColor: '#C7D2FE' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles-outline" size={15} color="#000000" />
                <Text style={styles.folderTabText}>TRÍ TUỆ NHÂN TẠO (GEMINI AI)</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
                  <Text style={[styles.cardSectionTitle, { marginBottom: 0 }]} numberOfLines={1}>
                    Nhận diện hóa đơn AI
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      hapticLight();
                      showAlert(
                        'Nhận diện hóa đơn AI (Gemini)',
                        'Tự động đọc hóa đơn & chứng từ nhiều ảnh, tự động trích xuất số tiền, ngày giờ, danh mục và bóc tách chi tiết từng món hàng.\n\n• Nhận API Key miễn phí tại: aistudio.google.com/app/apikey\n• Hệ thống tự động chuyển model dự phòng chống nghẽn: gemini-2.0-flash -> gemini-1.5-flash -> gemini-1.5-flash-8b'
                      );
                    }}
                  >
                    <Ionicons name="help-circle-outline" size={18} color="#6B7280" />
                  </Pressable>
                </View>
                <View style={[
                  styles.gdriveBadge,
                  { backgroundColor: geminiStatus.success ? '#DCFCE7' : '#F3F4F6' }
                ]}>
                  <View style={[
                    styles.gdriveDot,
                    { backgroundColor: geminiStatus.success ? '#15803D' : '#9CA3AF' }
                  ]} />
                  <Text style={[
                    styles.gdriveBadgeText,
                    { color: geminiStatus.success ? '#15803D' : '#6B7280' }
                  ]}>
                    {geminiStatus.success ? 'Đã kết nối' : 'Chưa kết nối'}
                  </Text>
                </View>
              </View>

              {/* API Key Input */}
              <View style={styles.geminiInputContainer}>
                <TextInput
                  style={styles.geminiInput}
                  placeholder="Dán Gemini API Key tại đây..."
                  placeholderTextColor={THEME.textMuted}
                  value={geminiApiKey}
                  onChangeText={setGeminiApiKey}
                  secureTextEntry={!showApiKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  style={styles.geminiEyeBtn}
                  onPress={() => setShowApiKey(!showApiKey)}
                >
                  <Ionicons
                    name={showApiKey ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#6B7280"
                  />
                </Pressable>
              </View>

              {/* Preferred Model Selection */}
              <View style={styles.geminiModelSection}>
                <View style={styles.geminiModelHeaderRow}>
                  <Text style={styles.geminiModelHeaderTitle}>
                    Mô hình AI ưu tiên
                  </Text>
                  {currentModelInfo?.badge && (
                    <View style={styles.modelBadge}>
                      <Text style={styles.modelBadgeText}>{currentModelInfo.badge}</Text>
                    </View>
                  )}
                </View>
                <NeoDropdown
                  title="Chọn mô hình Gemini"
                  triggerLabel={currentModelInfo?.name || selectedGeminiModel}
                  isActive={true}
                  options={geminiModelDropdownOptions}
                  selectedValue={selectedGeminiModel}
                  onSelect={handleSelectModel}
                />
                <Text style={styles.geminiModelDesc}>
                  {currentModelInfo?.desc || 'Tự động chuyển mô hình dự phòng khi gặp sự cố mạng hoặc hết Quota.'}
                </Text>
              </View>

              {/* Action Buttons Row */}
              <View style={[styles.geminiButtonsRow, { marginBottom: 0 }]}>
                <Pressable
                  style={[styles.geminiBtn, styles.geminiBtnPrimary]}
                  onPress={handleSaveGeminiKey}
                >
                  <Ionicons name="save-outline" size={16} color="#000000" />
                  <Text style={styles.geminiBtnPrimaryText}>Lưu Key</Text>
                </Pressable>

                <Pressable
                  style={[styles.geminiBtn, styles.geminiBtnSecondary]}
                  onPress={handleTestGeminiConnection}
                  disabled={isTestingGemini}
                >
                  {isTestingGemini ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <Ionicons name="flash-outline" size={16} color="#000000" />
                      <Text style={styles.geminiBtnSecondaryText}>Kiểm tra kết nối</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Receipt Storage & Photo Cleanup Section */}
        <View style={styles.cardShadow}>
          <View style={styles.cardInner}>
            <View style={[styles.folderTab, { backgroundColor: '#FDE047' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="images-outline" size={15} color="#000000" />
                <Text style={styles.folderTabText}>QUẢN LÝ BỘ NHỚ ẢNH HÓA ĐƠN</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Text style={[styles.cardSectionTitle, { marginBottom: 0 }]}>Dọn dẹp ảnh cũ</Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      hapticLight();
                      showAlert(
                        'Dọn dẹp ảnh hóa đơn',
                        'Giải phóng dung lượng bộ nhớ máy bằng cách xóa các ảnh hóa đơn chụp từ lâu. Số tiền, ghi chú và danh mục của giao dịch vẫn được lưu giữ an toàn 100%.'
                      );
                    }}
                  >
                    <Ionicons name="help-circle-outline" size={18} color="#6B7280" />
                  </Pressable>
                </View>
              </View>

              {/* Day presets chips - 4 equal-width buttons on 1 row */}
              <View style={styles.purgeChipsRow}>
                {[30, 60, 90].map((d) => {
                  const isSelected = !isCustomDays && selectedPurgeDays === d;
                  return (
                    <Pressable
                      key={d}
                      style={[
                        styles.purgeChip,
                        isSelected && styles.purgeChipActive,
                      ]}
                      onPress={() => {
                        hapticLight();
                        setIsCustomDays(false);
                        setSelectedPurgeDays(d);
                      }}
                    >
                      <Text
                        style={[
                          styles.purgeChipText,
                          isSelected && styles.purgeChipTextActive,
                        ]}
                      >
                        {d} ngày
                      </Text>
                    </Pressable>
                  );
                })}

                <Pressable
                  style={[
                    styles.purgeChip,
                    isCustomDays && styles.purgeChipActive,
                  ]}
                  onPress={() => {
                    hapticLight();
                    setIsCustomDays(true);
                  }}
                >
                  <Text
                    style={[
                      styles.purgeChipText,
                      isCustomDays && styles.purgeChipTextActive,
                    ]}
                  >
                    Tùy chọn
                  </Text>
                </Pressable>
              </View>

              {/* Custom days input if selected */}
              {isCustomDays && (
                <View style={styles.customDaysInputContainer}>
                  <Text style={styles.customDaysLabel}>Xóa ảnh của giao dịch cũ hơn:</Text>
                  <View style={styles.customDaysInputRow}>
                    <TextInput
                      style={styles.customDaysInput}
                      keyboardType="number-pad"
                      value={customPurgeDays}
                      onChangeText={(val) => {
                        setCustomPurgeDays(val);
                        const n = parseInt(val, 10);
                        if (!isNaN(n) && n > 0) {
                          refreshStorageStats(n);
                        }
                      }}
                      placeholder="Số ngày"
                      placeholderTextColor={THEME.textMuted}
                    />
                    <Text style={styles.customDaysSuffix}>ngày</Text>
                  </View>
                </View>
              )}

              {/* Cutoff Date Info & Refresh */}
              <View style={styles.storageCutoffRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="calendar-outline" size={13} color="#6B7280" />
                  <Text style={styles.storageCutoffText}>
                    Giao dịch trước: {storageStats?.cutoffDateStr || '...'}
                  </Text>
                </View>
                <Pressable
                  hitSlop={8}
                  style={styles.storageRefreshBtn}
                  onPress={() => {
                    hapticLight();
                    const d = isCustomDays ? parseInt(customPurgeDays, 10) : selectedPurgeDays;
                    if (!isNaN(d) && d > 0) refreshStorageStats(d);
                  }}
                  disabled={isScanningStorage}
                >
                  {isScanningStorage ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Ionicons name="refresh" size={13} color="#000000" />
                  )}
                </Pressable>
              </View>

              {/* 3 Neo-brutalism Stat Boxes */}
              <View style={styles.storageStatsGrid}>
                <View style={styles.storageStatBox}>
                  <Text style={styles.storageStatVal}>
                    {storageStats?.transactionCount ?? 0}
                  </Text>
                  <Text style={styles.storageStatLabel}>GIAO DỊCH</Text>
                </View>

                <View style={styles.storageStatBox}>
                  <Text style={styles.storageStatVal}>
                    {storageStats?.imageCount ?? 0}
                  </Text>
                  <Text style={styles.storageStatLabel}>HÌNH ẢNH</Text>
                </View>

                <View style={styles.storageStatBox}>
                  <Text style={[styles.storageStatVal, { color: '#E11D48' }]}>
                    {storageStats?.totalFormatted || '0 B'}
                  </Text>
                  <Text style={styles.storageStatLabel}>DUNG LƯỢNG</Text>
                </View>
              </View>

              {/* Action Button */}
              <Pressable
                style={[
                  styles.purgeActionBtn,
                  (!storageStats || storageStats.imageCount === 0 || isPurging) && styles.purgeActionBtnDisabled,
                ]}
                onPress={handleExecutePurge}
                disabled={!storageStats || storageStats.imageCount === 0 || isPurging}
              >
                {isPurging ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={storageStats && storageStats.imageCount > 0 ? '#FFFFFF' : '#9CA3AF'}
                    />
                    <Text
                      style={[
                        styles.purgeActionBtnText,
                        (!storageStats || storageStats.imageCount === 0) && styles.purgeActionBtnTextDisabled,
                      ]}
                    >
                      {storageStats && storageStats.imageCount > 0
                        ? `Dọn dẹp ${storageStats.imageCount} ảnh (${storageStats.totalFormatted})`
                        : 'Không có ảnh nào cần dọn dẹp'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {/* Export Data Section */}
        <View style={styles.cardShadow}>
          <View style={styles.cardInner}>
            <View style={[styles.folderTab, { backgroundColor: THEME.primary }]}>
              <Text style={styles.folderTabText}>XUẤT DỮ LIỆU (EXPORT)</Text>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.actionButtonsCol}>
                <Pressable
                  style={styles.actionBtnPrimary}
                  onPress={handleExportFile}
                  disabled={isProcessing}
                >
                  <Ionicons name="share-social-outline" size={18} color="#000000" />
                  <Text style={styles.actionBtnText}>Xuất file sao lưu (.json) & Chia sẻ</Text>
                </Pressable>

                <Pressable
                  style={styles.actionBtnSecondary}
                  onPress={handleViewJson}
                  disabled={isProcessing}
                >
                  <Ionicons name="code-slash-outline" size={18} color="#000000" />
                  <Text style={styles.actionBtnTextSecondary}>Xem & Sao chép mã JSON</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Import Data Section */}
        <View style={styles.cardShadow}>
          <View style={styles.cardInner}>
            <View style={[styles.folderTab, { backgroundColor: THEME.popBlue }]}>
              <Text style={styles.folderTabText}>NHẬP DỮ LIỆU (IMPORT)</Text>
            </View>

            <View style={styles.cardBody}>
              {/* Mode Switcher */}
              <View style={styles.importModeContainer}>
                <Text style={styles.importModeTitle}>Chế độ khôi phục:</Text>
                <View style={styles.modeTabsRow}>
                  <Pressable
                    style={[
                      styles.modeTab,
                      importMode === 'replace' && styles.modeTabActiveReplace,
                    ]}
                    onPress={() => setImportMode('replace')}
                  >
                    <Ionicons
                      name="refresh-circle-outline"
                      size={16}
                      color={importMode === 'replace' ? '#000000' : '#6B7280'}
                    />
                    <Text
                      style={[
                        styles.modeTabText,
                        importMode === 'replace' && styles.modeTabTextActive,
                      ]}
                    >
                      Ghi đè toàn bộ
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.modeTab,
                      importMode === 'merge' && styles.modeTabActiveMerge,
                    ]}
                    onPress={() => setImportMode('merge')}
                  >
                    <Ionicons
                      name="git-merge-outline"
                      size={16}
                      color={importMode === 'merge' ? '#000000' : '#6B7280'}
                    />
                    <Text
                      style={[
                        styles.modeTabText,
                        importMode === 'merge' && styles.modeTabTextActive,
                      ]}
                    >
                      Hợp nhất thêm
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.modeNoticeText}>
                  {importMode === 'replace'
                    ? 'Ghi đè: Thay thế toàn bộ dữ liệu hiện tại bằng dữ liệu trong bản sao lưu.'
                    : 'Hợp nhất: Thêm các ví và giao dịch mới, giữ nguyên dữ liệu hiện có.'}
                </Text>
              </View>

              <View style={styles.actionButtonsCol}>
                <Pressable
                  style={styles.actionBtnPrimary}
                  onPress={handlePickFileToImport}
                  disabled={isProcessing}
                >
                  <Ionicons name="document-attach-outline" size={18} color="#000000" />
                  <Text style={styles.actionBtnText}>Chọn file sao lưu (.json) từ máy</Text>
                </Pressable>

                <Pressable
                  style={styles.actionBtnSecondary}
                  onPress={() => setJsonPasteModalVisible(true)}
                  disabled={isProcessing}
                >
                  <Ionicons name="clipboard-outline" size={18} color="#000000" />
                  <Text style={styles.actionBtnTextSecondary}>Dán mã JSON trực tiếp</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Preferences & Danger Zone */}
        <View style={styles.cardShadow}>
          <View style={styles.cardInner}>
            <View style={[styles.folderTab, { backgroundColor: THEME.popPink }]}>
              <Text style={styles.folderTabText}>TÙY CHỌN & HỆ THỐNG</Text>
            </View>

            <View style={styles.cardBody}>
              {/* Toggle Haptic Feedback */}
              <View style={styles.settingRow}>
                <View style={styles.settingRowLeft}>
                  <View style={[styles.settingRowIconBox, { backgroundColor: THEME.popYellow }]}>
                    <Ionicons name="hardware-chip-outline" size={18} color="#000000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingRowTitle}>Rung phản hồi (Haptic)</Text>
                    <Text style={styles.settingRowDesc}>
                      {hapticsEnabled
                        ? 'Đang bật • Rung nhẹ khi bấm phím & thao tác'
                        : 'Đang tắt • Không rung'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={hapticsEnabled}
                  onValueChange={(val) => {
                    hapticLight();
                    toggleHaptics(val);
                  }}
                  trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.divider} />

              {/* Toggle Balance Visibility */}
              <Pressable
                style={styles.settingRow}
                onPress={toggleHideBalance}
              >
                <View style={styles.settingRowLeft}>
                  <View style={styles.settingRowIconBox}>
                    <Ionicons
                      name={isBalanceHidden ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#000000"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingRowTitle}>Ẩn số dư nhạy cảm</Text>
                    <Text style={styles.settingRowDesc}>
                      {isBalanceHidden ? 'Đang ẩn số dư với ký tự ••••••' : 'Đang hiển thị số tiền đầy đủ'}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.toggleSwitch,
                    isBalanceHidden && styles.toggleSwitchActive,
                  ]}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      isBalanceHidden && styles.toggleKnobActive,
                    ]}
                  />
                </View>
              </Pressable>

              <View style={styles.divider} />

              {/* Home Screen Widget Settings */}
              <View style={styles.settingRow}>
                <View style={styles.settingRowLeft}>
                  <View style={[styles.settingRowIconBox, { backgroundColor: THEME.popYellow }]}>
                    <Ionicons name="apps-outline" size={18} color="#000000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingRowTitle}>Tiện ích màn hình chính (Widget 4x2)</Text>
                    <Text style={styles.settingRowDesc}>
                      Xem nhanh số dư, thu/chi tháng, bấm mắt ẩn/hiện và tạo nhanh giao dịch (+/-).
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={styles.widgetSyncBtn}
                  onPress={async () => {
                    hapticSuccess();
                    if (summary) {
                      await syncWidgetData({
                        totalAssets: summary.totalAssets,
                        monthlyIncome: summary.monthIncome,
                        monthlyExpense: summary.monthExpense,
                        isAppLockEnabled,
                        walletCount: wallets.length,
                      });
                      showAlert(
                        'Đã đồng bộ Widget',
                        'Dữ liệu tài chính mới nhất đã được gửi ra tiện ích ngoài màn hình chính.'
                      );
                    }
                  }}
                >
                  <Ionicons name="refresh-outline" size={14} color="#000000" />
                  <Text style={styles.widgetSyncBtnText}>Đồng bộ</Text>
                </Pressable>
              </View>

              <View style={styles.divider} />

              {/* Reset Data Button */}
              <Pressable
                style={styles.dangerResetBtn}
                onPress={handleResetApp}
                disabled={isProcessing}
              >
                <Ionicons name="trash-outline" size={18} color="#E11D48" />
                <Text style={styles.dangerResetText}>Đặt lại ứng dụng ban đầu (Xóa tất cả)</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Smart Contextual Reminders Section */}
        <View style={styles.cardShadow}>
          <View style={styles.cardInner}>
            <View style={[styles.folderTab, { backgroundColor: THEME.popPurple }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="notifications-outline" size={15} color="#000000" />
                <Text style={styles.folderTabText}>NHẮC NHỞ CHI TIÊU THÔNG MINH</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={styles.cardSectionTitle}>Nhắc theo thói quen sinh hoạt</Text>
                <Switch
                  value={habitConfig.enabled}
                  onValueChange={handleToggleHabitEnabled}
                  trackColor={{ false: '#E5E7EB', true: THEME.primary }}
                  thumbColor="#000000"
                />
              </View>

              <Text style={styles.cardDescText}>
                Tự động phân tích giờ ăn uống, sinh hoạt từ SQLite để nhắc bạn ghi chép chi tiêu. Nếu hôm nay bạn đã ghi chép rồi, ứng dụng sẽ hoàn toàn im lặng, không làm phiền.
              </Text>

              {habitConfig.enabled && (
                <>
                  <View style={styles.divider} />

                  {/* Sub-toggle: Auto Learn */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingRowLeft}>
                      <View style={[styles.settingRowIconBox, { backgroundColor: '#DCFCE7' }]}>
                        <Ionicons name="sparkles-outline" size={18} color="#15803D" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingRowTitle}>Tự động học thói quen</Text>
                        <Text style={styles.settingRowDesc}>
                          Học giờ đỉnh từ lịch sử giao dịch để căn chỉnh mốc giờ nhắc phù hợp nhịp sống.
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={habitConfig.autoLearn}
                      onValueChange={handleToggleAutoLearn}
                      trackColor={{ false: '#E5E7EB', true: '#22C55E' }}
                      thumbColor="#000000"
                    />
                  </View>

                  {/* Dynamic Discovered Habits List */}
                  <View style={styles.habitRoutineBox}>
                    <Text style={styles.habitRoutineTitle}>
                      THÓI QUEN ĐÃ NHẬN DIỆN TỰ ĐỘNG ({discoveredHabits.length})
                    </Text>

                    {discoveredHabits.map((habit, index) => (
                      <View
                        key={habit.id}
                        style={[
                          styles.habitItemContainer,
                          index === discoveredHabits.length - 1 && { borderBottomWidth: 0 },
                        ]}
                      >
                        <View
                          style={[
                            styles.habitItemIconBox,
                            { backgroundColor: habit.categoryColor || THEME.primary },
                          ]}
                        >
                          <Ionicons
                            name={(habit.categoryIcon as any) || 'alarm-outline'}
                            size={16}
                            color="#000000"
                          />
                        </View>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <Text style={styles.habitItemTitle}>{habit.title}</Text>
                            {habit.scheduleBadge ? (
                              <View
                                style={[
                                  styles.habitBadgeChip,
                                  {
                                    backgroundColor: (habit.scheduleBadgeColor || '#6B7280') + '20',
                                    borderColor: (habit.scheduleBadgeColor || '#6B7280') + '60',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.habitBadgeChipText,
                                    { color: habit.scheduleBadgeColor || '#6B7280' },
                                  ]}
                                >
                                  {habit.scheduleBadge}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.habitItemSubtitle}>{habit.subtitle}</Text>
                        </View>
                        <Switch
                          value={habit.isEnabled}
                          onValueChange={() => handleToggleSingleHabit(habit.id, habit.isEnabled)}
                          trackColor={{ false: '#E5E7EB', true: THEME.primary }}
                          thumbColor="#000000"
                        />
                      </View>
                    ))}
                  </View>

                  {/* Test Notification Button */}
                  <Pressable
                    style={styles.actionBtnTestNotification}
                    onPress={handleTestNotification}
                  >
                    <Ionicons name="paper-plane-outline" size={18} color="#000000" />
                    <Text style={styles.actionBtnText}>Gửi thông báo thử nghiệm ngay (2s)</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>

        {/* App Info Footer */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerAppName}>Ví Của Tôi • Multi-Wallet Manager</Text>
          <Text style={styles.footerNote}>
            Phiên bản 1.1.9 • SQLite Offline Local Storage
          </Text>
          <Text style={styles.footerPrivacy}>
            100% dữ liệu được lưu trữ trên thiết bị của bạn, hoàn toàn riêng tư và không tải lên máy chủ ngoài.
          </Text>
        </View>
      </ScrollView>

      {/* Google Drive Sync Modal */}
      <GoogleDriveSyncModal
        visible={googleDriveModalVisible}
        onClose={() => {
          setGoogleDriveModalVisible(false);
          checkDriveStatus();
        }}
      />

      {/* Loading Overlay */}
      {isProcessing && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#000000" />
            <Text style={styles.loadingText}>Đang xử lý dữ liệu...</Text>
          </View>
        </View>
      )}

      {/* Modal 1: Xem / Copy mã JSON */}
      <Modal
        visible={jsonPreviewModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setJsonPreviewModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mã JSON Sao Lưu</Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setJsonPreviewModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#000000" />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Bạn có thể sao chép chuỗi JSON này để lưu vào ghi chú cá nhân hoặc sao lưu thủ công.
            </Text>

            <TextInput
              style={styles.jsonPreviewArea}
              multiline
              editable={false}
              value={jsonContent}
              selectTextOnFocus={true}
            />

            <Pressable
              style={styles.modalConfirmBtn}
              onPress={async () => {
                await Share.share({
                  message: jsonContent,
                  title: 'MultiWallet_Backup.json',
                });
              }}
            >
              <Ionicons name="share-outline" size={18} color="#000000" />
              <Text style={styles.modalConfirmBtnText}>Chia sẻ mã sao lưu</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Dán mã JSON để nhập */}
      <Modal
        visible={jsonPasteModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setJsonPasteModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Dán Mã JSON Khôi Phục</Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => {
                  setJsonPasteModalVisible(false);
                  setPastedJson('');
                }}
              >
                <Ionicons name="close" size={20} color="#000000" />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Dán chuỗi JSON đã sao lưu trước đó vào khung bên dưới để khôi phục dữ liệu:
            </Text>

            <TextInput
              style={styles.jsonInputArea}
              multiline
              placeholder="Dán mã JSON tại đây (bắt đầu bằng { ... })..."
              placeholderTextColor="#9CA3AF"
              value={pastedJson}
              onChangeText={setPastedJson}
            />

            <Pressable
              style={styles.modalConfirmBtn}
              onPress={handleImportPastedJson}
              disabled={isProcessing}
            >
              <Ionicons name="download-outline" size={18} color="#000000" />
              <Text style={styles.modalConfirmBtnText}>Xác nhận khôi phục dữ liệu</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Category Management Modal */}
      <CategoryManagementModal
        visible={categoryModalVisible}
        onClose={() => setCategoryModalVisible(false)}
      />

      {/* Modal Thiết lập / Đổi mã PIN 4 số */}
      <Modal
        visible={pinModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setPinModalVisible(false)}
      >
        <View style={styles.pinModalBackdrop}>
          <View style={styles.pinModalBox}>
            {/* Modal Header */}
            <View style={styles.pinModalHeader}>
              <View style={styles.pinBadge}>
                <Text style={styles.pinBadgeText}>
                  {pinStep === 'enter' ? 'BƯỚC 1/2' : 'BƯỚC 2/2'}
                </Text>
              </View>
              <Text style={styles.pinModalTitle}>
                {hasPinCode ? 'Đổi Mã PIN' : 'Thiết Lập PIN'}
              </Text>
              <Pressable
                style={styles.pinModalCloseBtn}
                onPress={() => setPinModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#000000" />
              </Pressable>
            </View>

            <Text style={styles.pinModalNotice}>
              {pinStep === 'enter'
                ? 'Nhập 4 chữ số để tạo mã PIN bảo mật'
                : 'Nhập lại đúng 4 số vừa tạo để xác nhận'}
            </Text>

            {/* PIN Indicator Dots */}
            <Animated.View
              style={[
                styles.pinDotsRow,
                { transform: [{ translateX: pinShakeAnim }] },
              ]}
            >
              {[0, 1, 2, 3].map(idx => {
                const currentVal = pinStep === 'enter' ? pinInput : confirmPinInput;
                const isFilled = currentVal.length > idx;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.pinDotShadow,
                      isFilled && styles.pinDotShadowFilled,
                    ]}
                  >
                    <View
                      style={[
                        styles.pinDotInner,
                        isFilled && styles.pinDotInnerFilled,
                      ]}
                    />
                  </View>
                );
              })}
            </Animated.View>

            {/* Error or Step hint message */}
            <View style={styles.pinStatusContainer}>
              {pinError ? (
                <Text style={styles.pinErrorText}>{pinError}</Text>
              ) : (
                <Text style={styles.pinStepHintText}>
                  {pinStep === 'enter' ? 'Tạo mã PIN cá nhân' : 'Khớp với mã PIN ban đầu'}
                </Text>
              )}
            </View>

            {/* Keypad */}
            <View style={styles.pinKeypadGrid}>
              {[
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
              ].map((row, rIdx) => (
                <View key={rIdx} style={styles.pinKeypadRow}>
                  {row.map(digit => (
                    <Pressable
                      key={digit}
                      style={styles.pinKeyShadow}
                      onPress={() => handlePinDigitPress(digit)}
                    >
                      <View style={styles.pinKeyInner}>
                        <Text style={styles.pinKeyText}>{digit}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ))}

              {/* Bottom row: Reset/Back, 0, Backspace */}
              <View style={styles.pinKeypadRow}>
                <Pressable
                  style={styles.pinKeyShadow}
                  onPress={handlePinResetOrBack}
                >
                  <View style={[styles.pinKeyInner, { backgroundColor: '#F3F4F6' }]}>
                    {pinStep === 'confirm' ? (
                      <Ionicons name="arrow-back" size={20} color="#000000" />
                    ) : (
                      <Text style={styles.pinKeySubText}>Xóa</Text>
                    )}
                  </View>
                </Pressable>

                <Pressable
                  style={styles.pinKeyShadow}
                  onPress={() => handlePinDigitPress('0')}
                >
                  <View style={styles.pinKeyInner}>
                    <Text style={styles.pinKeyText}>0</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.pinKeyShadow}
                  onPress={handlePinBackspace}
                >
                  <View style={[styles.pinKeyInner, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="backspace-outline" size={22} color="#000000" />
                  </View>
                </Pressable>
              </View>
            </View>

            {/* Cancel Button */}
            <Pressable
              style={styles.pinCancelBtn}
              onPress={() => setPinModalVisible(false)}
            >
              <Text style={styles.pinCancelBtnText}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {AlertModalComponent}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  backBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 12,
    width: 38,
    height: 38,
  },
  backBtnInner: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  headerTitleCol: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
  },
  screenSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  // Neo-Brutalist Folder Card
  cardShadow: {
    backgroundColor: '#000000',
    borderRadius: 20,
  },
  cardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#000000',
    overflow: 'hidden',
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  folderTab: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomRightRadius: 14,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#000000',
  },
  folderTabText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: 16,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 4,
  },
  cardDescText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  actionButtonsCol: {
    gap: 10,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.popYellow,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FAF8F5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
  },
  actionBtnGoogle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
    marginTop: 4,
  },
  gdriveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  gdriveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  gdriveBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  actionBtnTextSecondary: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  importModeContainer: {
    backgroundColor: '#FAF8F5',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#000000',
    marginBottom: 14,
  },
  importModeTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 8,
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  modeTabActiveReplace: {
    backgroundColor: THEME.popPinkLight,
    borderWidth: 2,
  },
  modeTabActiveMerge: {
    backgroundColor: THEME.primaryLight,
    borderWidth: 2,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
  },
  modeTabTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  modeNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    lineHeight: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  settingRowIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FAF8F5',
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingRowTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
  settingRowDesc: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  toggleSwitch: {
    width: 46,
    height: 26,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#000000',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: THEME.primary,
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#000000',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  divider: {
    height: 1.5,
    backgroundColor: '#E5E7EB',
    marginVertical: 14,
  },
  dangerResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E11D48',
  },
  dangerResetText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#E11D48',
  },
  widgetSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  widgetSyncBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  habitRoutineBox: {
    backgroundColor: '#FAF8F5',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  habitRoutineTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#4B5563',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  habitItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  habitItemIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  habitItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  habitItemSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 2,
  },
  habitBadgeChip: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  habitBadgeChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  actionBtnTestNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.popPurpleLight,
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 8,
  },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  footerAppName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  footerNote: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 2,
  },
  footerPrivacy: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 14,
  },
  // Loading Overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingBox: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#000000',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: THEME.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '85%',
    borderTopWidth: 3,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  jsonPreviewArea: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 12,
    fontFamily: 'monospace',
    fontSize: 11,
    height: 240,
    color: '#000000',
    marginBottom: 14,
  },
  jsonInputArea: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 12,
    fontFamily: 'monospace',
    fontSize: 12,
    height: 200,
    color: '#000000',
    marginBottom: 14,
    textAlignVertical: 'top',
  },
  modalConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.popYellow,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#000000',
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
  pinModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pinModalBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#000000',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  pinModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  pinBadge: {
    backgroundColor: THEME.popYellow,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  pinBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
  },
  pinModalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  pinModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinModalNotice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 10,
  },
  pinDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 10,
  },
  pinDotShadow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#000000',
    paddingBottom: 2,
    paddingRight: 2,
  },
  pinDotShadowFilled: {
    paddingBottom: 0,
    paddingRight: 0,
    transform: [{ translateX: 1 }, { translateY: 1 }],
  },
  pinDotInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },
  pinDotInnerFilled: {
    backgroundColor: THEME.popPink,
  },
  pinStatusContainer: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  pinErrorText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  pinStepHintText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  pinKeypadGrid: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  pinKeypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 10,
  },
  pinKeyShadow: {
    width: 72,
    height: 50,
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  pinKeyInner: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  pinKeyText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
  },
  pinKeySubText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4B5563',
  },
  pinCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  pinCancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
  },
  geminiInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  geminiModelSection: {
    marginBottom: 14,
  },
  geminiModelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  geminiModelHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  geminiModelDesc: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 5,
    lineHeight: 15,
  },
  modelBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  modelBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  geminiInput: {
    flex: 1,
    height: 44,
    fontSize: 13.5,
    color: '#000000',
    fontWeight: '600',
  },
  geminiEyeBtn: {
    padding: 8,
  },
  geminiButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  geminiBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  geminiBtnPrimary: {
    backgroundColor: '#FFE600',
  },
  geminiBtnPrimaryText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#000000',
  },
  geminiBtnSecondary: {
    backgroundColor: '#FFFFFF',
  },
  geminiBtnSecondaryText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#000000',
  },
  purgeChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  purgeChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purgeChipActive: {
    backgroundColor: '#FFE600',
  },
  purgeChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4B5563',
  },
  purgeChipTextActive: {
    color: '#000000',
  },
  customDaysInputContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  customDaysLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  customDaysInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customDaysInput: {
    width: 100,
    height: 36,
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  customDaysSuffix: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#4B5563',
  },
  storageCutoffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  storageCutoffText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  storageRefreshBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storageStatsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  storageStatBox: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  storageStatVal: {
    fontSize: 17,
    fontWeight: '900',
    color: '#000000',
  },
  storageStatLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  purgeActionBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  purgeActionBtnDisabled: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  purgeActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  purgeActionBtnTextDisabled: {
    color: '#9CA3AF',
  },
  timeoutPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  timeoutPillActive: {
    borderColor: '#000000',
    backgroundColor: '#FACC15',
  },
  timeoutPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  timeoutPillTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
});
