import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { THEME } from '../constants';
import { useCustomAlert } from './CustomAlertModal';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '../utils/haptics';
import {
  getCloudinaryConfig,
  saveCloudinaryConfig,
  testCloudinaryConnection,
  getLocalImagesStats,
  migrateLocalImagesToCloudinary,
  MigrationProgress,
  LocalImagesStats,
} from '../services/cloudinaryService';

interface CloudinaryModalProps {
  visible: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
}

export const CloudinaryModal: React.FC<CloudinaryModalProps> = ({
  visible,
  onClose,
  onConfigChanged,
}) => {
  const db = useSQLiteContext();
  const { showAlert, showConfirm, AlertModalComponent } = useCustomAlert(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [cloudName, setCloudName] = useState<string>('');
  const [uploadPreset, setUploadPreset] = useState<string>('');
  const [folder, setFolder] = useState<string>('multi_wallet_receipts');
  const [enabled, setEnabled] = useState<boolean>(false);

  // Testing connection
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Local images stats & migration
  const [stats, setStats] = useState<LocalImagesStats>({
    receiptImagesCount: 0,
    qrImagesCount: 0,
    totalCount: 0,
    hasSandboxMismatch: false,
  });
  const [isMigrating, setIsMigrating] = useState<boolean>(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);

  // Collapsible helpers
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!db) return;
    try {
      setLoading(true);
      const cfg = await getCloudinaryConfig(db);
      const imgStats = await getLocalImagesStats(db);
      setCloudName(cfg.cloudName);
      setUploadPreset(cfg.uploadPreset);
      setFolder(cfg.folder);
      setEnabled(cfg.enabled);
      setStats(imgStats);
      if (cfg.cloudName && cfg.uploadPreset) {
        setTestResult({
          success: true,
          message: cfg.enabled ? 'Đã bật lưu trữ mây' : 'Cấu hình đã lưu (Đang tắt)',
        });
      }
    } catch (err) {
      console.warn('Lỗi tải cấu hình Cloudinary:', err);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, loadData]);

  const handleToggle = async (val: boolean) => {
    if (val && (!cloudName.trim() || !uploadPreset.trim())) {
      showAlert('Chưa cấu hình', 'Vui lòng nhập Cloud Name và Upload Preset trước khi bật.');
      return;
    }
    hapticLight();
    setEnabled(val);
    await saveCloudinaryConfig(db, { enabled: val });
    onConfigChanged?.();
  };

  const handleSave = async () => {
    if (!cloudName.trim() || !uploadPreset.trim()) {
      showAlert('Thiếu thông tin', 'Vui lòng nhập đầy đủ Cloud Name và Upload Preset.');
      return;
    }
    hapticLight();
    await saveCloudinaryConfig(db, {
      cloudName: cloudName.trim(),
      uploadPreset: uploadPreset.trim(),
      folder: folder.trim() || 'multi_wallet_receipts',
      enabled,
    });
    hapticSuccess();
    showAlert('Thành công', 'Đã lưu cấu hình Cloudinary');
    onConfigChanged?.();
  };

  const handleTest = async () => {
    if (!cloudName.trim() || !uploadPreset.trim()) {
      showAlert('Thiếu thông tin', 'Vui lòng nhập Cloud Name và Upload Preset để kiểm tra kết nối.');
      return;
    }
    hapticLight();
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testCloudinaryConnection(cloudName.trim(), uploadPreset.trim());
      setIsTesting(false);
      setTestResult(res);
      if (res.success) {
        hapticSuccess();
        showAlert('Kết nối thành công! 🎉', res.message);
      } else {
        hapticError();
        showAlert('Kết nối thất bại', res.message);
      }
    } catch (err: any) {
      setIsTesting(false);
      hapticError();
      const msg = err?.message || 'Không thể kiểm tra kết nối';
      setTestResult({ success: false, message: msg });
      showAlert('Lỗi kiểm tra', msg);
    }
  };

  const handleMigrate = () => {
    if (!cloudName.trim() || !uploadPreset.trim()) {
      showAlert('Chưa cấu hình', 'Vui lòng lưu Cloud Name và Upload Preset trước khi di chuyển ảnh.');
      return;
    }
    if (stats.totalCount === 0) {
      showAlert('Hoàn tất', 'Toàn bộ ảnh đã được lưu trên đám mây, không còn ảnh nào trên máy!');
      return;
    }

    showConfirm(
      'Di chuyển ảnh lên Cloudinary',
      `Tải ${stats.totalCount} ảnh trên bộ nhớ máy (${stats.receiptImagesCount} hóa đơn, ${stats.qrImagesCount} mã QR ví) lên đám mây Cloudinary và giải phóng bộ nhớ máy.\n\nQuá trình này cần kết nối mạng. Bạn có muốn tiếp tục không?`,
      async () => {
        try {
          hapticMedium();
          setIsMigrating(true);
          setMigrationProgress({
            total: stats.totalCount,
            current: 0,
            successCount: 0,
            failCount: 0,
            statusText: 'Đang bắt đầu...',
          });

          const res = await migrateLocalImagesToCloudinary(db, (p) => {
            setMigrationProgress(p);
          });

          setIsMigrating(false);
          setMigrationProgress(null);
          const updatedStats = await getLocalImagesStats(db);
          setStats(updatedStats);
          onConfigChanged?.();

          hapticSuccess();
          showAlert(
            'Di chuyển hoàn tất! ☁️',
            `Đã tải thành công ${res.success} ảnh lên Cloudinary.` +
              (res.failed > 0 ? `\nThất bại: ${res.failed} ảnh (giữ lại trên máy).` : '\nBộ nhớ máy đã được tối ưu hoàn toàn!')
          );
        } catch (err: any) {
          setIsMigrating(false);
          setMigrationProgress(null);
          hapticError();
          showAlert('Lỗi di chuyển', err?.message || 'Có lỗi xảy ra trong quá trình di chuyển');
        }
      }
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCardShadow}>
          <View style={styles.modalCardInner}>
            {/* Header Tab */}
            <View style={styles.folderTab}>
              <View style={styles.folderTabLeft}>
                <Ionicons name="cloud-upload" size={18} color="#000000" />
                <Text style={styles.folderTabText}>LƯU TRỮ CLOUDINARY</Text>
              </View>
              <Pressable
                style={styles.closeBtn}
                onPress={() => {
                  hapticLight();
                  onClose();
                }}
              >
                <Ionicons name="close" size={18} color="#000000" />
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#0284C7" />
                <Text style={styles.loadingText}>Đang đọc cấu hình...</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.body}
                showsVerticalScrollIndicator={false}
              >
                {/* 1. Toggle & Status Row */}
                <View style={styles.statusRowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statusTitle}>Tự động lưu ảnh lên mây</Text>
                    <Text style={styles.statusSubtitle}>
                      {enabled
                        ? 'Ảnh hóa đơn & mã QR tự động đưa lên Cloudinary'
                        : 'Đang tắt • Ảnh được lưu tạm trong bộ nhớ máy'}
                    </Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={handleToggle}
                    trackColor={{ false: '#D1D5DB', true: '#38BDF8' }}
                    thumbColor={enabled ? '#0284C7' : '#9CA3AF'}
                  />
                </View>

                {/* 2. Migration Box (Nổi bật & Gọn gàng) */}
                <View style={styles.migrationCard}>
                  <View style={styles.migrationHeader}>
                    <View style={styles.migrationIconWrap}>
                      <Ionicons name="images" size={16} color="#0284C7" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.migrationTitle}>
                        {stats.totalCount > 0
                          ? `Còn ${stats.totalCount} ảnh trên bộ nhớ máy`
                          : 'Toàn bộ ảnh đã ở trên mây'}
                      </Text>
                      <Text style={styles.migrationDesc}>
                        {stats.totalCount > 0
                          ? `${stats.receiptImagesCount} hóa đơn • ${stats.qrImagesCount} mã QR ví`
                          : 'Bộ nhớ điện thoại đang được tối ưu 100%'}
                      </Text>
                    </View>
                  </View>

                  {/* Cảnh báo khi ảnh nằm trong Development Build và đang chạy bằng Expo Go */}
                  {stats.hasSandboxMismatch && (
                    <View style={styles.sandboxNoticeBox}>
                      <Ionicons name="alert-circle" size={18} color="#B45309" style={{ marginTop: 1 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sandboxNoticeTitle}>Ảnh thuộc app Development Build</Text>
                        <Text style={styles.sandboxNoticeDesc}>
                          {stats.totalCount} ảnh này được lưu trong app cài đặt riêng (com.thang.multiwallet). Android chặn Expo Go truy cập file của app khác. Hãy mở ứng dụng bằng <Text style={{ fontWeight: '900' }}>Development Build</Text> để tải ảnh lên Cloudinary.
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Progress Bar when running */}
                  {isMigrating && migrationProgress && (
                    <View style={styles.progressSection}>
                      <Text style={styles.progressStatusText}>
                        {migrationProgress.statusText} ({migrationProgress.current}/{migrationProgress.total})
                      </Text>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${Math.round(
                                (migrationProgress.current / Math.max(migrationProgress.total, 1)) * 100
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )}

                  {stats.totalCount > 0 && (
                    <Pressable
                      style={[
                        styles.migrateBtn,
                        isMigrating && styles.migrateBtnDisabled,
                      ]}
                      onPress={handleMigrate}
                      disabled={isMigrating}
                    >
                      {isMigrating ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="arrow-up-circle-outline" size={17} color="#FFFFFF" />
                          <Text style={styles.migrateBtnText}>
                            Tải {stats.totalCount} ảnh lên Cloudinary & Giải phóng máy
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>

                {/* 3. Credentials Form */}
                <View style={styles.formSection}>
                  <Text style={styles.sectionHeader}>THÔNG TIN KẾT NỐI</Text>

                  {/* Cloud Name */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Cloud Name:</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="vd: dw7hrsbba"
                      placeholderTextColor={THEME.textMuted}
                      value={cloudName}
                      onChangeText={setCloudName}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  {/* Upload Preset */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Upload Preset:</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="vd: billings"
                      placeholderTextColor={THEME.textMuted}
                      value={uploadPreset}
                      onChangeText={setUploadPreset}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  {/* Advanced Toggle */}
                  <Pressable
                    style={styles.advancedToggle}
                    onPress={() => setShowAdvanced(!showAdvanced)}
                  >
                    <Ionicons
                      name={showAdvanced ? 'chevron-down' : 'chevron-forward'}
                      size={14}
                      color="#6B7280"
                    />
                    <Text style={styles.advancedToggleText}>
                      {showAdvanced ? 'Ẩn cài đặt nâng cao' : 'Cài đặt nâng cao (Thư mục)'}
                    </Text>
                  </Pressable>

                  {showAdvanced && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Thư mục Cloudinary:</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="multi_wallet_receipts"
                        placeholderTextColor={THEME.textMuted}
                        value={folder}
                        onChangeText={setFolder}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  )}

                  {/* Buttons: Test & Save */}
                  <View style={styles.buttonRow}>
                    <Pressable
                      style={[styles.actionBtn, styles.saveBtn]}
                      onPress={handleSave}
                    >
                      <Ionicons name="save-outline" size={16} color="#000000" />
                      <Text style={styles.btnTextBlack}>Lưu cấu hình</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.actionBtn, styles.testBtn]}
                      onPress={handleTest}
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <ActivityIndicator size="small" color="#000000" />
                      ) : (
                        <>
                          <Ionicons name="flash-outline" size={16} color="#000000" />
                          <Text style={styles.btnTextBlack}>Kiểm tra</Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  {testResult && (
                    <View
                      style={[
                        styles.testBadge,
                        { backgroundColor: testResult.success ? '#DCFCE7' : '#FEE2E2' },
                      ]}
                    >
                      <Ionicons
                        name={testResult.success ? 'checkmark-circle' : 'alert-circle'}
                        size={15}
                        color={testResult.success ? '#15803D' : '#DC2626'}
                      />
                      <Text
                        style={[
                          styles.testBadgeText,
                          { color: testResult.success ? '#15803D' : '#DC2626' },
                        ]}
                      >
                        {testResult.message}
                      </Text>
                    </View>
                  )}
                </View>

                {/* 4. Collapsible Quick Guide */}
                <Pressable
                  style={styles.guideToggle}
                  onPress={() => setShowGuide(!showGuide)}
                >
                  <Ionicons name="help-circle-outline" size={16} color="#0284C7" />
                  <Text style={styles.guideToggleText}>
                    {showGuide ? 'Ẩn hướng dẫn tạo Preset' : 'Xem cách lấy Preset miễn phí trên Cloudinary'}
                  </Text>
                  <Ionicons
                    name={showGuide ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="#0284C7"
                    style={{ marginLeft: 'auto' }}
                  />
                </Pressable>

                {showGuide && (
                  <View style={styles.guideCard}>
                    <Text style={styles.guideStep}>
                      <Text style={{ fontWeight: '900' }}>Bước 1:</Text> Đăng ký tài khoản miễn phí tại <Text style={{ fontWeight: '800', color: '#0284C7' }}>cloudinary.com</Text> và lấy Cloud Name ở Dashboard.
                    </Text>
                    <Text style={styles.guideStep}>
                      <Text style={{ fontWeight: '900' }}>Bước 2:</Text> Vào <Text style={{ fontWeight: '800' }}>Settings ⚙️ → Upload Presets</Text> → bấm <Text style={{ fontWeight: '800' }}>Add Upload Preset</Text>.
                    </Text>
                    <Text style={styles.guideStep}>
                      <Text style={{ fontWeight: '900' }}>Bước 3:</Text> Đổi Signing Mode thành <Text style={{ fontWeight: '900', color: '#DC2626' }}>Unsigned</Text> và lưu lại. Sau đó dán tên Preset vào ô trên.
                    </Text>
                  </View>
                )}

                <View style={{ height: 30 }} />
              </ScrollView>
            )}
          </View>
        </View>
        {AlertModalComponent}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCardShadow: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
  },
  modalCardInner: {
    backgroundColor: '#FAF8F5',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 2.5,
    borderColor: '#000000',
    overflow: 'hidden',
  },
  folderTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#38BDF8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: '#000000',
  },
  folderTabLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  folderTabText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },
  scrollView: {
    maxHeight: '100%',
  },
  body: {
    padding: 16,
    gap: 14,
  },
  // Status Row Card
  statusRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
  statusSubtitle: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
  // Migration Card
  migrationCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 14,
    gap: 10,
  },
  migrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  migrationIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  migrationTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0369A1',
  },
  migrationDesc: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
    marginTop: 1,
  },
  migrateBtn: {
    height: 42,
    backgroundColor: '#0284C7',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  migrateBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  migrateBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sandboxNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    padding: 10,
    marginTop: 2,
  },
  sandboxNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 2,
  },
  sandboxNoticeDesc: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78350F',
    lineHeight: 15,
  },
  progressSection: {
    gap: 4,
  },
  progressStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  progressBarBg: {
    height: 7,
    backgroundColor: '#E0F2FE',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0284C7',
  },
  // Form Section
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 14,
    gap: 10,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '900',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#374151',
  },
  textInput: {
    height: 42,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  advancedToggleText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#6B7280',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveBtn: {
    backgroundColor: '#38BDF8',
  },
  testBtn: {
    backgroundColor: '#FFFFFF',
  },
  btnTextBlack: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  testBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000000',
    marginTop: 4,
  },
  testBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
  },
  // Guide Section
  guideToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
  },
  guideToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  guideStep: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#334155',
    lineHeight: 17,
  },
});
