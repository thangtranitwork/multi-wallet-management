// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { logger } from '../services/loggerService';
import { THEME } from '../constants';
import { hapticError, hapticSuccess, hapticLight } from '../utils/haptics';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    const stackTrace = `${error.stack || ''}\n\nComponent Stack:\n${errorInfo?.componentStack || ''}`;
    logger.error('UI_CRASH', `[Lỗi Render UI] ${error.message}`, stackTrace);
    logger.flushLogs().catch(() => {});
  }

  handleReset = () => {
    hapticLight();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleCopy = async () => {
    hapticSuccess();
    const errorDetails = `[Lỗi] ${this.state.error?.message || 'Không rõ'}\n\n[Stack]\n${this.state.error?.stack || ''}\n\n[Component Stack]\n${this.state.errorInfo?.componentStack || ''}`;
    await Clipboard.setStringAsync(errorDetails);
    this.setState({ copied: true });
    setTimeout(() => {
      this.setState({ copied: false });
    }, 2500);
  };

  toggleDetails = () => {
    hapticLight();
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'Đã có lỗi không xác định xảy ra trong thành phần này.';
      const fullStack = `${this.state.error?.stack || ''}\n${this.state.errorInfo?.componentStack || ''}`;

      return (
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFF1F2" />
          <View style={styles.container}>
            {/* Header Badge */}
            <View style={styles.badgeWrapper}>
              <View style={styles.badge}>
                <Ionicons name="warning" size={28} color="#000000" />
                <Text style={styles.badgeText}>SỰ CỐ GIAO DIỆN ĐÃ ĐƯỢC CHẶN</Text>
              </View>
            </View>

            {/* Main Content Box */}
            <View style={styles.card}>
              <Text style={styles.title}>
                {this.props.fallbackTitle || 'Ứng dụng không bị đóng (Crash prevented)'}
              </Text>
              <Text style={styles.desc}>
                Đã chặn sự cố văng app. Dữ liệu giao dịch và số dư ví của bạn hoàn toàn an toàn và không bị mất.
              </Text>

              <View style={styles.errorBox}>
                <View style={styles.errorBoxHeader}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.errorBoxTitle}>Chi tiết lỗi:</Text>
                </View>
                <Text style={styles.errorText} numberOfLines={this.state.showDetails ? undefined : 3}>
                  {errorMsg}
                </Text>

                {this.state.showDetails && (
                  <ScrollView style={styles.stackScroll} nestedScrollEnabled>
                    <Text style={styles.stackText}>{fullStack.trim()}</Text>
                  </ScrollView>
                )}

                <Pressable style={styles.expandBtn} onPress={this.toggleDetails}>
                  <Ionicons
                    name={this.state.showDetails ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="#4B5563"
                  />
                  <Text style={styles.expandBtnText}>
                    {this.state.showDetails ? 'Thu gọn mã theo dõi (Stack trace)' : 'Xem đầy đủ Stack trace'}
                  </Text>
                </Pressable>
              </View>

              {/* Action Buttons */}
              <View style={styles.btnGroup}>
                <Pressable style={styles.primaryBtn} onPress={this.handleReset}>
                  <Ionicons name="refresh" size={18} color="#000000" />
                  <Text style={styles.primaryBtnText}>Thử tải lại giao diện</Text>
                </Pressable>

                <Pressable style={styles.secondaryBtn} onPress={this.handleCopy}>
                  <Ionicons
                    name={this.state.copied ? 'checkmark-circle' : 'copy-outline'}
                    size={18}
                    color={this.state.copied ? '#059669' : '#000000'}
                  />
                  <Text style={[styles.secondaryBtnText, this.state.copied && { color: '#059669' }]}>
                    {this.state.copied ? 'Đã sao chép mã lỗi!' : 'Sao chép thông tin lỗi'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.footerNote}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#059669" />
              <Text style={styles.footerText}>
                Lỗi đã được tự động lưu vào mục Nhật ký (Log) của Cài đặt để bạn dễ dàng debug.
              </Text>
            </View>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF1F2', // Soft pinkish red alert bg
  },
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  badgeWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 2.5,
    borderColor: '#000000',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#000000',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 8,
  },
  desc: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  errorBoxTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
    textTransform: 'uppercase',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  stackScroll: {
    maxHeight: 140,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#1E293B',
    borderRadius: 8,
  },
  stackText: {
    fontSize: 10,
    color: '#F1F5F9',
    fontFamily: 'monospace',
    lineHeight: 14,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  expandBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  btnGroup: {
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FACC15', // Pop Yellow
    borderWidth: 2.5,
    borderColor: '#000000',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
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
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
    flex: 1,
    lineHeight: 16,
  },
});
