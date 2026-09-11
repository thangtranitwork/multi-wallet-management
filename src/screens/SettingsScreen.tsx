import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
  Share,
  ActivityIndicator,
  Switch,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import dayjs from 'dayjs';
import { useWallet } from '../context/WalletContext';
import { useSecurity } from '../context/SecurityContext';
import { CategoryManagementModal } from '../components/CategoryManagementModal';
import { GoogleDriveSyncModal } from '../components/GoogleDriveSyncModal';
import { syncWidgetData } from '../services/widgetSyncService';
import { loadCloudBackupConfig } from '../services/cloudBackupStorage';
import { useSQLiteContext } from 'expo-sqlite';
import { THEME } from '../constants';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '../utils/haptics';
import {
  loadHabitConfig,
  saveHabitConfig,
  refreshHabitReminders,
  sendTestHabitNotificationAsync,
  setupNotificationChannelAsync,
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
  } = useWallet();

  const {
    isAppLockEnabled,
    useFingerprint,
    hasPinCode,
    isHardwareSupported,
    hapticsEnabled,
    toggleAppLock,
    toggleFingerprint,
    toggleHaptics,
    updatePinCode,
  } = useSecurity();

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

  useEffect(() => {
    loadHabitConfig().then((conf) => setHabitConfig(conf));
  }, []);

  const handleToggleHabitEnabled = async (val: boolean) => {
    hapticLight();
    if (val) {
      const granted = await setupNotificationChannelAsync();
      if (!granted) {
        Alert.alert(
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
      Alert.alert(
        'Đã kích hoạt thử nghiệm',
        'Một thông báo sẽ xuất hiện trên thanh thông báo trong 2 giây tới. Hãy vuốt mở hoặc khóa màn hình để kiểm tra nhé!'
      );
    } else {
      Alert.alert(
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
      Alert.alert('Lỗi xuất dữ liệu', err?.message || 'Không thể tạo file sao lưu');
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
      Alert.alert('Lỗi', err?.message || 'Không thể tải mã JSON');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Xử lý chọn file .json từ máy
  const handlePickFileToImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setIsProcessing(true);

      const pickedFile = new File(asset.uri);
      const content = await pickedFile.text();

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        Alert.alert('Lỗi file', 'Nội dung file không đúng định dạng JSON.');
        setIsProcessing(false);
        return;
      }

      const raw = parsed.data || parsed;
      const wCount = (raw.wallets || []).length;
      const tCount = (raw.transactions || []).length;
      const dCount = (raw.debts || []).length;

      Alert.alert(
        'Xác nhận khôi phục',
        `Phát hiện dữ liệu gồm:\n• ${wCount} ví tiền\n• ${tCount} giao dịch\n• ${dCount} khoản nợ\n\nChế độ: ${
          importMode === 'replace'
            ? 'GHI ĐÈ TOÀN BỘ (xóa dữ liệu hiện tại)'
            : 'HỢP NHẤT (bổ sung dữ liệu)'
        }\n\nBạn có muốn tiếp tục?`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Tiến hành khôi phục',
            style: importMode === 'replace' ? 'destructive' : 'default',
            onPress: async () => {
              try {
                setIsProcessing(true);
                const res = await importDataFromJsonString(content, importMode);
                Alert.alert(
                  'Thành công',
                  `Đã khôi phục thành công:\n• ${res.walletsCount} ví tiền\n• ${res.transactionsCount} giao dịch\n• ${res.debtsCount} khoản nợ`
                );
              } catch (importErr: any) {
                Alert.alert('Lỗi khôi phục', importErr?.message || 'Không thể nhập dữ liệu');
              } finally {
                setIsProcessing(false);
              }
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Lỗi chọn file', err?.message || 'Không thể đọc file đã chọn');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Xử lý nhập JSON dán trực tiếp
  const handleImportPastedJson = async () => {
    if (!pastedJson.trim()) {
      Alert.alert('Thiếu dữ liệu', 'Vui lòng dán nội dung JSON vào ô.');
      return;
    }

    try {
      setIsProcessing(true);
      const res = await importDataFromJsonString(pastedJson.trim(), importMode);
      setJsonPasteModalVisible(false);
      setPastedJson('');
      Alert.alert(
        'Thành công',
        `Đã khôi phục thành công:\n• ${res.walletsCount} ví tiền\n• ${res.transactionsCount} giao dịch\n• ${res.debtsCount} khoản nợ`
      );
    } catch (err: any) {
      Alert.alert('Lỗi nhập dữ liệu', err?.message || 'Nội dung JSON không hợp lệ');
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
          Alert.alert('Thành công', 'Đã lưu mã PIN và kích hoạt khóa bảo mật.');
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
    Alert.alert(
      'Cảnh báo xóa toàn bộ dữ liệu',
      'Hành động này sẽ xóa vĩnh viễn toàn bộ ví, giao dịch và sổ nợ hiện tại trên máy của bạn. Bạn không thể hoàn tác sau khi đã xóa.\n\nBạn có chắc chắn muốn tiếp tục?',
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        {
          text: 'XÓA TẤT CẢ',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsProcessing(true);
              await resetAllData();
              Alert.alert('Đã hoàn tất', 'Ứng dụng đã được đưa về trạng thái dữ liệu ban đầu.');
            } catch (err: any) {
              Alert.alert('Lỗi đặt lại', err?.message || 'Không thể xóa dữ liệu');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
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
          <Text style={styles.screenSubtitle}>Sao lưu, nhập xuất & tùy chọn hệ thống</Text>
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
              <Text style={styles.cardDescText}>
                Toàn bộ dữ liệu tài chính của bạn được lưu trữ ngoại tuyến an toàn trên SQLite của máy.
              </Text>

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
            </View>
          </View>
        </View>

        {/* Categories & Analytics Section */}
        <View style={styles.cardShadow}>
          <View style={styles.cardInner}>
            <View style={[styles.folderTab, { backgroundColor: THEME.popYellow }]}>
              <Text style={styles.folderTabText}>DANH MỤC & BÁO CÁO</Text>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.cardDescText}>
                Quản lý các nhóm chi tiêu, nguồn thu nhập hoặc xem các báo cáo phân tích dòng tiền chuyên sâu.
              </Text>

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
                </Pressable>

                <Pressable
                  style={styles.actionBtnSecondary}
                  onPress={() => {
                    hapticMedium();
                    navigation.navigate('Analytics');
                  }}
                >
                  <Ionicons name="pie-chart-outline" size={18} color="#000000" />
                  <Text style={styles.actionBtnTextSecondary}>Xem báo cáo & phân tích dòng tiền</Text>
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

              <Text style={styles.cardDescText}>
                {isDriveLinked
                  ? `Đang liên kết với: ${driveUserEmail || 'Tài khoản Google'}. Dữ liệu được tự động bảo vệ an toàn trên Google Drive cá nhân.`
                  : 'Liên kết tài khoản Google để tự động sao lưu đám mây và khôi phục chỉ với 1 chạm khi đổi điện thoại.'}
              </Text>

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

        {/* Export Data Section */}
        <View style={styles.cardShadow}>
          <View style={styles.cardInner}>
            <View style={[styles.folderTab, { backgroundColor: THEME.primary }]}>
              <Text style={styles.folderTabText}>XUẤT DỮ LIỆU (EXPORT)</Text>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.cardSectionTitle}>Sao lưu dự phòng</Text>
              <Text style={styles.cardDescText}>
                Trích xuất toàn bộ ví, giao dịch, sổ nợ và danh mục thành định dạng chuẩn JSON để lưu giữ an toàn hoặc chuyển sang thiết bị mới.
              </Text>

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
              <Text style={styles.cardSectionTitle}>Khôi phục dữ liệu</Text>
              <Text style={styles.cardDescText}>
                Tải lại toàn bộ dữ liệu từ bản sao lưu .json đã lưu trước đây.
              </Text>

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
                  <View>
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
                      Alert.alert(
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

                  {/* Habit Routine Info Box */}
                  <View style={styles.habitRoutineBox}>
                    <Text style={styles.habitRoutineTitle}>KHUNG GIỜ NHẬN DIỆN & LÊN LỊCH</Text>

                    <View style={styles.habitRoutineRow}>
                      <View style={styles.habitRoutineLeft}>
                        <Ionicons name="restaurant-outline" size={16} color="#B45309" />
                        <Text style={styles.habitRoutineLabel}>Bữa trưa:</Text>
                      </View>
                      <Text style={styles.habitRoutineValue}>
                        {habitConfig.detectedLunchPeak ? `Đỉnh ~${habitConfig.detectedLunchPeak} -> ` : ''}Nhắc lúc {habitConfig.lunchTime}
                      </Text>
                    </View>

                    <View style={styles.habitRoutineRow}>
                      <View style={styles.habitRoutineLeft}>
                        <Ionicons name="pizza-outline" size={16} color="#B91C1C" />
                        <Text style={styles.habitRoutineLabel}>Bữa tối:</Text>
                      </View>
                      <Text style={styles.habitRoutineValue}>
                        {habitConfig.detectedDinnerPeak ? `Đỉnh ~${habitConfig.detectedDinnerPeak} -> ` : ''}Nhắc lúc {habitConfig.dinnerTime}
                      </Text>
                    </View>

                    <View style={styles.habitRoutineRow}>
                      <View style={styles.habitRoutineLeft}>
                        <Ionicons name="moon-outline" size={16} color="#4338CA" />
                        <Text style={styles.habitRoutineLabel}>Chốt sổ ngày:</Text>
                      </View>
                      <Text style={styles.habitRoutineValue}>Nhắc lúc {habitConfig.dailyWrapUpTime}</Text>
                    </View>
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
            Phiên bản 1.1.0 • SQLite Offline Local Storage
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
  habitRoutineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  habitRoutineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  habitRoutineLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  habitRoutineValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
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
});
