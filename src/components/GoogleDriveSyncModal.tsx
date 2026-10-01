import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Switch,
  TextInput,
  Image,
} from 'react-native';
import { useCustomAlert } from './CustomAlertModal';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSQLiteContext } from 'expo-sqlite';
import dayjs from 'dayjs';
import { THEME } from '../constants';
import {
  signInWithGoogle,
  uploadBackupToDrive,
  listDriveBackups,
  downloadDriveBackup,
  deleteDriveBackup,
  DriveBackupFile,
  DEFAULT_GOOGLE_CLIENT_ID,
  getRedirectUri,
} from '../services/googleDriveService';
import {
  loadCloudBackupConfig,
  saveCloudBackupConfig,
  clearCloudBackupConfig,
  CloudBackupConfig,
} from '../services/cloudBackupStorage';
import { useWallet } from '../context/WalletContext';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '../utils/haptics';

interface GoogleDriveSyncModalProps {
  visible: boolean;
  onClose: () => void;
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  visible,
  onClose,
}) => {
  const db = useSQLiteContext();
  const { showAlert, showConfirm, AlertModalComponent } = useCustomAlert(false);
  const { exportDataToJsonString, importDataFromJsonString } = useWallet();

  const [config, setConfig] = useState<CloudBackupConfig | null>(null);
  const [backupsList, setBackupsList] = useState<DriveBackupFile[]>([]);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [loadingBackups, setLoadingBackups] = useState<boolean>(false);
  const [restoringFileId, setRestoringFileId] = useState<string | null>(null);

  // Cấu hình Client ID tùy chỉnh
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [customClientIdInput, setCustomClientIdInput] = useState<string>('');

  const handlePasteClientId = async () => {
    try {
      hapticLight();
      const text = await Clipboard.getStringAsync();
      if (text && text.trim().length > 0) {
        setCustomClientIdInput(text.trim());
        showAlert('Đã dán Client ID', text.trim());
      } else {
        showAlert('Thông báo', 'Bộ nhớ tạm không có nội dung văn bản.');
      }
    } catch {}
  };

  const handleCopyUri = async (uri: string, label: string) => {
    try {
      hapticSuccess();
      await Clipboard.setStringAsync(uri);
      showAlert('Đã sao chép URI', `Đã chép ${label} vào bộ nhớ tạm. Hãy dán vào mục "Authorized redirect URIs" trên Google Cloud Console.`);
    } catch {}
  };

  const handleSaveCustomClientId = async () => {
    try {
      hapticSuccess();
      await saveCloudBackupConfig(db, {
        ...(config || { isLinked: false, autoBackupEnabled: false }),
        customClientId: customClientIdInput.trim(),
      });
      await fetchConfig();
      showAlert('Đã lưu cấu hình', 'Google Client ID đã được lưu vào hệ thống thành công.');
    } catch (err: any) {
      hapticError();
      showAlert('Lỗi', err?.message || 'Không thể lưu cấu hình Client ID.');
    }
  };

  const fetchConfig = useCallback(async () => {
    try {
      setLoadingConfig(true);
      const conf = await loadCloudBackupConfig(db);
      setConfig(conf);
      setCustomClientIdInput(conf.customClientId || '');

      if (conf.isLinked && conf.accessToken) {
        loadDriveFiles(conf.accessToken);
      }
    } catch (err) {
      console.warn('Lỗi tải cấu hình Cloud Backup:', err);
    } finally {
      setLoadingConfig(false);
    }
  }, [db]);

  useEffect(() => {
    if (visible) {
      fetchConfig();
    }
  }, [visible, fetchConfig]);

  const loadDriveFiles = async (token: string) => {
    try {
      setLoadingBackups(true);
      const files = await listDriveBackups(token);
      setBackupsList(files);
    } catch {
      setBackupsList([]);
    } finally {
      setLoadingBackups(false);
    }
  };

  // 1. Xử lý Đăng nhập Google
  const handleSignIn = async () => {
    try {
      hapticMedium();
      setIsSigningIn(true);
      const res = await signInWithGoogle(customClientIdInput);

      if (res.success && res.accessToken && res.user) {
        hapticSuccess();
        await saveCloudBackupConfig(db, {
          isLinked: true,
          accessToken: res.accessToken,
          user: res.user,
          customClientId: customClientIdInput.trim(),
        });
        await fetchConfig();
        showAlert(
          'Liên kết thành công',
          `Chào mừng ${res.user.name}!\nTài khoản (${res.user.email}) đã được kết nối với Google Drive.`
        );
      } else if (res.error && res.error !== 'Người dùng đã hủy đăng nhập.') {
        hapticError();
        showAlert('Không thể kết nối Google', res.error);
      }
    } catch (err: any) {
      hapticError();
      showAlert('Lỗi đăng nhập', err?.message || 'Không thể đăng nhập Google.');
    } finally {
      setIsSigningIn(false);
    }
  };

  // 2. Xử lý Đăng xuất / Hủy liên kết
  const handleSignOut = () => {
    showConfirm(
      'Hủy liên kết Google Drive',
      'Bạn có chắc chắn muốn ngắt kết nối tài khoản Google khỏi ứng dụng không?',
      async () => {
        hapticMedium();
        await clearCloudBackupConfig(db);
        setBackupsList([]);
        await fetchConfig();
      },
      { destructive: true, confirmText: 'Ngắt kết nối' }
    );
  };

  // 3. Sao lưu lên Google Drive ngay
  const handleUploadBackup = async () => {
    if (!config?.isLinked || !config.accessToken) {
      showAlert('Thông báo', 'Vui lòng liên kết tài khoản Google trước khi sao lưu.');
      return;
    }

    try {
      hapticMedium();
      setIsUploading(true);
      const jsonStr = await exportDataToJsonString();
      const res = await uploadBackupToDrive(config.accessToken, jsonStr);

      if (res.success) {
        hapticSuccess();
        const nowStr = dayjs().format('HH:mm DD/MM/YYYY');
        await saveCloudBackupConfig(db, {
          lastBackupTime: nowStr,
          lastBackupFileName: res.fileName,
        });
        await fetchConfig();
        showAlert('Đã sao lưu lên Google Drive', `Bản sao lưu: ${res.fileName}\nThời gian: ${nowStr}`);
      } else {
        hapticError();
        showAlert('Lỗi sao lưu', res.error || 'Không thể tải lên Google Drive.');
      }
    } catch (err: any) {
      hapticError();
      showAlert('Lỗi', err?.message || 'Có lỗi xảy ra khi sao lưu.');
    } finally {
      setIsUploading(false);
    }
  };

  // 4. Khôi phục từ một bản sao lưu trên Drive
  const handleRestoreBackup = (file: DriveBackupFile) => {
    showConfirm(
      'Khôi phục dữ liệu từ Google Drive',
      `Bạn có chắc muốn khôi phục từ bản sao lưu "${file.name}" không?\n\nDữ liệu hiện tại trên thiết bị sẽ được thay thế bằng dữ liệu từ bản sao lưu này.`,
      async () => {
        if (!config?.accessToken) return;
        try {
          hapticMedium();
          setRestoringFileId(file.id);
          const jsonContent = await downloadDriveBackup(config.accessToken, file.id);
          const res = await importDataFromJsonString(jsonContent, 'replace');
          hapticSuccess();
          showAlert(
            'Khôi phục thành công',
            `Đã nạp lại:\n• ${res.walletsCount} ví tiền\n• ${res.transactionsCount} giao dịch\n• ${res.debtsCount} khoản nợ`
          );
        } catch (err: any) {
          hapticError();
          showAlert('Lỗi khôi phục', err?.message || 'Không thể nạp dữ liệu từ file này.');
        } finally {
          setRestoringFileId(null);
        }
      },
      { destructive: true, confirmText: 'KHÔI PHỤC NGAY' }
    );
  };

  // 5. Xóa file sao lưu trên Drive
  const handleDeleteBackup = (file: DriveBackupFile) => {
    showConfirm(
      'Xóa bản sao lưu trên Drive',
      `Bạn có muốn xóa vĩnh viễn file "${file.name}" trên Google Drive không?`,
      async () => {
        if (!config?.accessToken) return;
        hapticMedium();
        const ok = await deleteDriveBackup(config.accessToken, file.id);
        if (ok) {
          hapticSuccess();
          loadDriveFiles(config.accessToken);
        } else {
          hapticError();
          showAlert('Lỗi', 'Không thể xóa file trên Google Drive.');
        }
      },
      { destructive: true, confirmText: 'Xóa file' }
    );
  };

  // 6. Bật/tắt tự động sao lưu
  const handleToggleAutoBackup = async (val: boolean) => {
    hapticLight();
    await saveCloudBackupConfig(db, { autoBackupEnabled: val });
    if (config) {
      setConfig({ ...config, autoBackupEnabled: val });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCardShadow}>
          <View style={styles.modalCardInner}>
            {/* Folder Tab Header */}
            <View style={styles.folderTab}>
              <View style={styles.folderTabLeft}>
                <Ionicons name="cloud-done-outline" size={16} color="#000000" />
                <Text style={styles.folderTabText} numberOfLines={1}>GOOGLE DRIVE SYNC</Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={18} color="#000000" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {loadingConfig ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#000000" />
                  <Text style={styles.loadingText}>Đang tải cấu hình Google Drive...</Text>
                </View>
              ) : !config?.isLinked ? (
                /* CHƯA LIÊN KẾT GOOGLE DRIVE */
                <View style={styles.unlinkedContainer}>
                  <View style={styles.heroCloudIconBox}>
                    <Ionicons name="logo-google" size={44} color="#000000" />
                  </View>

                  <Text style={styles.heroTitle}>Tự Động Sao Lưu Google Drive</Text>
                  <Text style={styles.heroSub}>
                    Liên kết tài khoản Google một lần duy nhất. Dữ liệu ví, thu chi và sổ nợ
                    sẽ tự động được bảo lưu an toàn trên Google Drive riêng của bạn.
                  </Text>

                  {/* Nút Đăng nhập Google 1 chạm */}
                  <Pressable
                    style={styles.googleSignInBtnShadow}
                    onPress={handleSignIn}
                    disabled={isSigningIn}
                  >
                    <View style={styles.googleSignInBtnInner}>
                      {isSigningIn ? (
                        <ActivityIndicator size="small" color="#000000" />
                      ) : (
                        <>
                          <Ionicons name="logo-google" size={20} color="#EA4335" />
                          <Text style={styles.googleSignInBtnText}>
                            Đăng nhập với Google
                          </Text>
                        </>
                      )}
                    </View>
                  </Pressable>

                  {/* Tùy chọn nâng cao (Custom Client ID) */}
                  <Pressable
                    style={styles.advancedToggleRow}
                    onPress={() => setShowAdvanced(prev => !prev)}
                  >
                    <Text style={styles.advancedToggleText}>
                      {showAdvanced ? 'Thu gọn cài đặt Client ID' : 'Tùy chỉnh OAuth Client ID (Tùy chọn)'}
                    </Text>
                  </Pressable>

                  {showAdvanced && (
                    <View style={styles.advancedBox}>
                      <Text style={styles.advancedLabel}>Google OAuth Web Client ID:</Text>
                      <View style={styles.clientIdInputRow}>
                        <TextInput
                          style={[styles.advancedInput, { flex: 1 }]}
                          value={customClientIdInput}
                          onChangeText={setCustomClientIdInput}
                          placeholder={DEFAULT_GOOGLE_CLIENT_ID}
                          placeholderTextColor="#9CA3AF"
                          autoCapitalize="none"
                        />
                        <Pressable
                          style={styles.pasteBtn}
                          onPress={handlePasteClientId}
                        >
                          <Ionicons name="clipboard-outline" size={14} color="#000000" />
                          <Text style={styles.pasteBtnText}>Dán</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.advancedHint}>
                        Nếu bạn có Google Cloud Project riêng, hãy dán Web Client ID vào đây và bấm nút Lưu cấu hình bên dưới.
                      </Text>

                      {/* Nút Lưu Cài Đặt Client ID */}
                      <Pressable
                        style={styles.saveClientIdBtnShadow}
                        onPress={handleSaveCustomClientId}
                      >
                        <View style={styles.saveClientIdBtnInner}>
                          <Ionicons name="save-outline" size={16} color="#000000" />
                          <Text style={styles.saveClientIdBtnText}>Lưu Cấu Hình Client ID</Text>
                        </View>
                      </Pressable>

                      {/* Các Redirect URIs */}
                      <View style={{ marginTop: 14 }}>
                        <Text style={styles.advancedLabel}>
                          Authorized Redirect URIs (Cần thêm vào Google Cloud Console):
                        </Text>
                        
                        {/* URI 1: Expo Go Redirect URI */}
                        <View style={styles.redirectUriRow}>
                          <View style={{ flex: 1, marginRight: 6 }}>
                            <Text style={styles.redirectUriTypeLabel}>1. Dành cho Expo Go (Bắt buộc):</Text>
                            <Text style={styles.redirectUriValue} selectable>
                              https://auth.expo.io/@anonymous/multi-wallet-management
                            </Text>
                          </View>
                          <Pressable
                            style={styles.copyUriBtn}
                            onPress={() => handleCopyUri('https://auth.expo.io/@anonymous/multi-wallet-management', 'Expo Go URI')}
                          >
                            <Ionicons name="copy-outline" size={13} color="#000000" />
                            <Text style={styles.copyUriBtnText}>Chép</Text>
                          </Pressable>
                        </View>

                        {/* Hướng dẫn cài đặt Google Cloud */}
                        <View style={styles.cloudInstructionBox}>
                          <Text style={styles.cloudInstructionTitle}>
                            👉 Hướng dẫn set trên Google Cloud Console:
                          </Text>
                          <Text style={styles.cloudInstructionStep}>
                            1. Trong màn hình <Text style={{ fontWeight: '900' }}>"Client ID for Web application"</Text>, tìm mục <Text style={{ fontWeight: '900' }}>Authorized redirect URIs</Text>.
                          </Text>
                          <Text style={styles.cloudInstructionStep}>
                            2. Bấm nút <Text style={{ fontWeight: '900' }}>"+ Add URI"</Text> rồi dán URL số 1 ở trên vào.
                          </Text>
                          <Text style={styles.cloudInstructionStep}>
                            3. Bấm nút <Text style={{ fontWeight: '900' }}>"Save"</Text> màu xanh ở cuối trang Google Cloud.
                          </Text>
                          <Text style={styles.cloudInstructionStep}>
                            4. Vào menu <Text style={{ fontWeight: '900' }}>Audience</Text> (hoặc Test users), thêm địa chỉ Gmail của bạn vào danh sách để Google cấp quyền đăng nhập thử nghiệm.
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                /* ĐÃ LIÊN KẾT GOOGLE DRIVE */
                <View style={styles.linkedContainer}>
                  {/* Card thông tin tài khoản */}
                  <View style={styles.accountCardShadow}>
                    <View style={styles.accountCardInner}>
                      <View style={styles.accountRow}>
                        {config.user?.picture ? (
                          <Image
                            source={{ uri: config.user.picture }}
                            style={styles.userAvatar}
                          />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Text style={styles.avatarLetter}>
                              {(config.user?.name || 'G').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}

                        <View style={styles.accountInfoCol}>
                          <Text style={styles.userName} numberOfLines={1}>
                            {config.user?.name || 'Tài khoản Google'}
                          </Text>
                          <Text style={styles.userEmail} numberOfLines={1}>
                            {config.user?.email}
                          </Text>
                          <View style={styles.connectedBadge}>
                            <View style={styles.greenDot} />
                            <Text style={styles.connectedBadgeText}>Đã kết nối Google Drive</Text>
                          </View>
                        </View>

                        <Pressable
                          style={styles.signOutBtn}
                          onPress={handleSignOut}
                        >
                          <Ionicons name="log-out-outline" size={18} color="#E11D48" />
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {/* Nút Sao lưu lên Drive ngay */}
                  <Pressable
                    style={styles.uploadNowBtnShadow}
                    onPress={handleUploadBackup}
                    disabled={isUploading}
                  >
                    <View style={styles.uploadNowBtnInner}>
                      {isUploading ? (
                        <ActivityIndicator size="small" color="#000000" />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload" size={20} color="#000000" />
                          <Text style={styles.uploadNowBtnText}>
                            Sao lưu lên Google Drive ngay
                          </Text>
                        </>
                      )}
                    </View>
                  </Pressable>

                  {/* Cài đặt tự động sao lưu */}
                  <View style={styles.settingCardShadow}>
                    <View style={styles.settingCardInner}>
                      <View style={styles.settingRow}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={styles.settingTitle}>Tự động sao lưu</Text>
                          <Text style={styles.settingSub}>
                            Tự động đồng bộ bản snapshot mới lên Google Drive sau khi ghi chép
                          </Text>
                        </View>
                        <Switch
                          value={config.autoBackupEnabled}
                          onValueChange={handleToggleAutoBackup}
                          trackColor={{ false: '#E5E7EB', true: THEME.primary }}
                          thumbColor="#FFFFFF"
                        />
                      </View>

                      {config.lastBackupTime && (
                        <View style={styles.lastBackupInfoRow}>
                          <Ionicons name="time-outline" size={14} color="#059669" />
                          <Text style={styles.lastBackupText}>
                            Sao lưu gần nhất: {config.lastBackupTime}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Danh sách các bản sao lưu trên Drive */}
                  <View style={styles.backupsHeaderRow}>
                    <Text style={styles.backupsHeaderTitle}>Các bản sao lưu trên Drive</Text>
                    <Pressable
                      style={styles.refreshListBtn}
                      onPress={() => config.accessToken && loadDriveFiles(config.accessToken)}
                    >
                      <Ionicons name="refresh" size={15} color="#000000" />
                      <Text style={styles.refreshListBtnText}>Làm mới</Text>
                    </Pressable>
                  </View>

                  {loadingBackups ? (
                    <View style={styles.loadingFilesBox}>
                      <ActivityIndicator size="small" color="#000000" />
                      <Text style={styles.loadingFilesText}>Đang kiểm tra Google Drive...</Text>
                    </View>
                  ) : backupsList.length === 0 ? (
                    <View style={styles.emptyBackupsBox}>
                      <Ionicons name="cloud-outline" size={32} color="#9CA3AF" />
                      <Text style={styles.emptyBackupsTitle}>Chưa có bản sao lưu nào trên Drive</Text>
                      <Text style={styles.emptyBackupsSub}>
                        Bấm nút "Sao lưu lên Google Drive ngay" ở trên để tạo bản đầu tiên
                      </Text>
                    </View>
                  ) : (
                    backupsList.map(file => {
                      const isRestoringThis = restoringFileId === file.id;
                      const dateFormatted = file.createdTime
                        ? dayjs(file.createdTime).format('HH:mm • DD/MM/YYYY')
                        : 'Không rõ ngày';

                      return (
                        <View key={file.id} style={styles.backupItemShadow}>
                          <View style={styles.backupItemInner}>
                            <View style={styles.backupItemLeft}>
                              <View style={styles.fileIconBox}>
                                <Ionicons name="document-text-outline" size={20} color="#000000" />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.backupFileName} numberOfLines={1}>
                                  {file.name}
                                </Text>
                                <Text style={styles.backupFileMeta}>
                                  {dateFormatted} {file.size ? `• ${file.size}` : ''}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.backupActionsRight}>
                              <Pressable
                                style={styles.restoreBtnShadow}
                                onPress={() => handleRestoreBackup(file)}
                                disabled={isRestoringThis}
                              >
                                <View style={styles.restoreBtnInner}>
                                  {isRestoringThis ? (
                                    <ActivityIndicator size="small" color="#000000" />
                                  ) : (
                                    <Text style={styles.restoreBtnText}>Khôi phục</Text>
                                  )}
                                </View>
                              </Pressable>

                              <Pressable
                                style={styles.deleteFileBtn}
                                onPress={() => handleDeleteBackup(file)}
                              >
                                <Ionicons name="trash-outline" size={16} color="#DC2626" />
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
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
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    height: '90%',
    maxHeight: '92%',
  },
  modalCardInner: {
    backgroundColor: '#FAF8F5',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 2.5,
    borderColor: '#000000',
    overflow: 'hidden',
    flex: 1,
  },
  folderTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  folderTabLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
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
  body: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
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
  // Unlinked state
  unlinkedContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  heroCloudIconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: THEME.popYellow,
    borderWidth: 2.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  googleSignInBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 16,
    width: '100%',
    marginBottom: 16,
  },
  googleSignInBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#000000',
    paddingVertical: 14,
    borderRadius: 16,
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  googleSignInBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
  },
  advancedToggleRow: {
    paddingVertical: 8,
  },
  advancedToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textDecorationLine: 'underline',
  },
  advancedBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  advancedLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 6,
  },
  advancedInput: {
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#000000',
    backgroundColor: '#F9FAFB',
  },
  advancedHint: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 6,
    lineHeight: 15,
  },
  clientIdInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  pasteBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  saveClientIdBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 6,
  },
  saveClientIdBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.primary,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 10,
    borderRadius: 10,
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  saveClientIdBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  redirectUriRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    gap: 8,
  },
  redirectUriTypeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4B5563',
    marginBottom: 2,
  },
  redirectUriValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#111827',
  },
  copyUriBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  copyUriBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  cloudInstructionBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#FEF9C3',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  cloudInstructionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#854D0E',
    marginBottom: 4,
  },
  cloudInstructionStep: {
    fontSize: 11,
    color: '#713F12',
    lineHeight: 16,
    marginTop: 3,
  },
  // Linked state
  linkedContainer: {
    gap: 14,
  },
  accountCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 18,
  },
  accountCardInner: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 18,
    padding: 14,
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: THEME.popBlue,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
  },
  accountInfoCol: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
  },
  userEmail: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 1,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#15803D',
  },
  connectedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  signOutBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadNowBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 16,
  },
  uploadNowBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.popYellow,
    borderWidth: 2.5,
    borderColor: '#000000',
    paddingVertical: 13,
    borderRadius: 16,
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  uploadNowBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
  settingCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 16,
  },
  settingCardInner: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 16,
    padding: 14,
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
  settingSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
  lastBackupInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  lastBackupText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  backupsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  backupsHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
  refreshListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  refreshListBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  loadingFilesBox: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 6,
  },
  loadingFilesText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptyBackupsBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  emptyBackupsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
    marginTop: 8,
  },
  emptyBackupsSub: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  backupItemShadow: {
    backgroundColor: '#000000',
    borderRadius: 14,
    marginTop: 8,
  },
  backupItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 14,
    padding: 10,
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  backupItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  fileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: THEME.primaryLight,
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupFileName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  backupFileMeta: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  backupActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restoreBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 8,
  },
  restoreBtnInner: {
    backgroundColor: THEME.primary,
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    transform: [{ translateX: -1.5 }, { translateY: -1.5 }],
  },
  restoreBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
  },
  deleteFileBtn: {
    padding: 6,
  },
});
