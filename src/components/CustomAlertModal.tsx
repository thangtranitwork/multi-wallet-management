import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants';
import { hapticLight, hapticSuccess, hapticError, hapticMedium } from '../utils/haptics';

export interface CustomAlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive' | 'primary';
  onPress?: () => void | Promise<void>;
}

export interface CustomAlertConfig {
  title: string;
  message?: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'danger';
  buttons?: CustomAlertButton[];
}

export interface CustomAlertModalProps {
  visible: boolean;
  config: CustomAlertConfig | null;
  onClose: () => void;
  useModal?: boolean;
}

export const CustomAlertModal: React.FC<CustomAlertModalProps> = ({
  visible,
  config,
  onClose,
  useModal = true,
}) => {
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

  if (!visible || !config) return null;

  // Auto-detect type if not provided
  let alertType = config.type;
  if (!alertType) {
    const t = config.title.toLowerCase();
    if (t.includes('lỗi') || t.includes('thất bại') || t.includes('không thể')) {
      alertType = 'error';
    } else if (t.includes('thành công') || t.includes('hoàn tất') || t.includes('đã lưu') || t.includes('đã đồng bộ') || t.includes('đã nạp')) {
      alertType = 'success';
    } else if (t.includes('xóa') || t.includes('cảnh báo') || t.includes('đặt lại') || t.includes('hủy liên kết') || t.includes('ngắt kết nối')) {
      alertType = 'danger';
    } else if (t.includes('thiếu') || t.includes('chưa') || t.includes('không hợp lệ') || t.includes('vượt quá') || t.includes('trùng')) {
      alertType = 'warning';
    } else {
      alertType = 'info';
    }
  }

  // Choose icon and colors based on alertType
  let iconName: any = 'information-circle';
  let iconBg = '#E0F2FE';
  let iconColor = '#0284C7';

  switch (alertType) {
    case 'success':
      iconName = 'checkmark-circle';
      iconBg = '#DCFCE7';
      iconColor = '#16A34A';
      break;
    case 'warning':
      iconName = 'alert-circle';
      iconBg = '#FEF3C7';
      iconColor = '#D97706';
      break;
    case 'error':
      iconName = 'close-circle';
      iconBg = '#FEE2E2';
      iconColor = '#DC2626';
      break;
    case 'danger':
      iconName = 'trash';
      iconBg = '#FEE2E2';
      iconColor = '#EF4444';
      break;
  }

  // Prepare buttons
  const buttons: CustomAlertButton[] =
    config.buttons && config.buttons.length > 0
      ? config.buttons
      : [{ text: 'Đã hiểu', style: 'primary' }];

  const handlePressButton = async (btn: CustomAlertButton, index: number) => {
    if (loadingIndex !== null) return;
    if (btn.style === 'destructive' || alertType === 'danger') {
      hapticMedium();
    } else if (alertType === 'success') {
      hapticSuccess();
    } else {
      hapticLight();
    }

    if (btn.onPress) {
      try {
        setLoadingIndex(index);
        await btn.onPress();
      } catch (err) {
        hapticError();
      } finally {
        setLoadingIndex(null);
        onClose();
      }
    } else {
      onClose();
    }
  };

  const content = (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        {/* Top Icon Badge */}
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName} size={28} color={iconColor} />
        </View>

        {/* Title */}
        <Text style={styles.title}>{config.title}</Text>

        {/* Message */}
        {config.message ? (
          <ScrollView
            style={{ maxHeight: 220, width: '100%' }}
            contentContainerStyle={{ paddingBottom: 4 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.message}>{config.message}</Text>
          </ScrollView>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {buttons.map((btn, index) => {
            const isDestructive = btn.style === 'destructive';
            const isCancel = btn.style === 'cancel';
            const isPrimary = btn.style === 'primary' || (!btn.style && buttons.length === 1);
            const isLoading = loadingIndex === index;

            let btnStyle: any = styles.defaultBtn;
            let textStyle: any = styles.defaultBtnText;

            if (isDestructive) {
              btnStyle = styles.destructiveBtn;
              textStyle = styles.destructiveBtnText;
            } else if (isPrimary) {
              btnStyle = alertType === 'success' ? styles.successBtn : styles.primaryBtn;
              textStyle = alertType === 'success' ? styles.successBtnText : styles.primaryBtnText;
            } else if (isCancel) {
              btnStyle = styles.cancelBtn;
              textStyle = styles.cancelBtnText;
            }

            return (
              <Pressable
                key={index}
                style={[btnStyle, isLoading && { opacity: 0.7 }]}
                onPress={() => handlePressButton(btn, index)}
                disabled={loadingIndex !== null}
              >
                {isLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={isDestructive || isPrimary ? '#000000' : '#4B5563'}
                  />
                ) : (
                  <Text style={textStyle}>{btn.text}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  if (useModal) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        {content}
      </Modal>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 99999 }]}>
      {content}
    </View>
  );
};

export function useCustomAlert(useModal: boolean = true) {
  const [alertConfig, setAlertConfig] = useState<CustomAlertConfig | null>(null);

  const showAlert = (
    title: string,
    message?: string,
    buttons?: CustomAlertButton[] | (() => void),
    options?: Partial<CustomAlertConfig>
  ) => {
    let finalButtons: CustomAlertButton[] | undefined;
    if (typeof buttons === 'function') {
      finalButtons = [{ text: 'Đã hiểu', style: 'primary', onPress: buttons }];
    } else if (Array.isArray(buttons)) {
      finalButtons = buttons;
    }

    setAlertConfig({
      title,
      message,
      buttons: finalButtons,
      ...options,
    });
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    options?: {
      confirmText?: string;
      cancelText?: string;
      destructive?: boolean;
      type?: 'warning' | 'danger' | 'info';
    }
  ) => {
    setAlertConfig({
      title,
      message,
      type: options?.type || (options?.destructive ? 'danger' : 'warning'),
      buttons: [
        {
          text: options?.cancelText || 'Hủy bỏ',
          style: 'cancel',
        },
        {
          text: options?.confirmText || (options?.destructive ? 'Đồng ý xóa' : 'Xác nhận'),
          style: options?.destructive ? 'destructive' : 'primary',
          onPress: onConfirm,
        },
      ],
    });
  };

  const closeAlert = () => setAlertConfig(null);

  const AlertModalComponent = (
    <CustomAlertModal
      visible={!!alertConfig}
      config={alertConfig}
      onClose={closeAlert}
      useModal={useModal}
    />
  );

  return {
    showAlert,
    showConfirm,
    closeAlert,
    AlertModalComponent,
  };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#000000',
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 5, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  actionsContainer: {
    width: '100%',
    gap: 9,
    marginTop: 4,
  },
  primaryBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
  },
  successBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  successBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  destructiveBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  destructiveBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  cancelBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4B5563',
  },
  defaultBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
  },
  defaultBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
});
