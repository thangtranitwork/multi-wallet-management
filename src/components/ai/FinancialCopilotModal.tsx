import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { useWallet } from '../../context/WalletContext';
import { THEME } from '../../constants';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '../../utils/haptics';
import { useCustomAlert } from '../CustomAlertModal';
import * as queries from '../../database/queries';
import {
  processCopilotTextInput,
  processCopilotAudioInput,
  getInAppMicEnabled,
  getCopilotPersonality,
  COPILOT_PERSONALITIES,
  CopilotPersonalityId,
  CopilotPersonality,
  ChatMessage,
  CopilotParsedTransaction,
  CopilotParsedDebt,
} from '../../services/aiCopilotService';
import { CopilotTransactionCard } from './CopilotTransactionCard';

function getWelcomeMessage(p: CopilotPersonality): string {
  switch (p.id) {
    case 'cheerful':
      return 'Hế lô bạn ơi! ☀️ Hôm nay có kèo ăn uống hay săn sale gì vui không? Cứ quẳng hết thu chi qua đây mình ghi sổ cho, vừa nhanh vừa rảnh tay xõa tiếp nè!';
    case 'strict':
      return 'Lại vào đây rồi à? Mở app ghi nhận thu nhập hay tiết kiệm thì hoan nghênh, chứ đừng bảo lại mới tốn tiền trà sữa hay mua đồ linh tinh đấy nhé. Khai thật hôm nay tiêu gì xem nào?';
    case 'affluent':
      return 'Chào Chủ tịch. Hôm nay có những thương vụ hay khoản giải ngân nào cần thư ký xử lý giúp Ngài không? Mọi biến động tài sản cứ để tôi lo liệu chu toàn.';
    case 'confidant':
      return 'Chào bạn nha, hôm nay đi làm về có mệt không? Tiền bạc dạo này thế nào rồi, có khoản nào làm bạn bận tâm hay cần tui tính toán giúp thì cứ nhắn tui nhé, mình cùng gỡ!';
    case 'minimalist':
      return 'Chào bạn. Có khoản thu chi hay số liệu tài chính nào cần xử lý ngay không?';
    case 'genz':
      return 'Ủa alo senpai! 🔥 Tình hình ví hôm nay thế nào rồi, còn thở không hay đang bật mode ét ô ét? Có kèo nào tới công chiện thì nổ phát một tui lưu liền cho nóng!';
    default:
      return 'Xin chào bạn! Hôm nay có khoản thu chi nào cần ghi chép hay cần mình kiểm tra số dư giúp không?';
  }
}

interface FinancialCopilotModalProps {
  visible: boolean;
  onClose: () => void;
}

const QUICK_PROMPT_CHIPS = [
  'Ăn trưa bún chả 55k MoMo',
  'Đổ xăng 80k tiền mặt',
  'Tháng này uống cafe hết bao nhiêu?',
  'Ai đang nợ tiền tui?',
  'So sánh thu chi tháng này',
];

export const FinancialCopilotModal: React.FC<FinancialCopilotModalProps> = ({
  visible,
  onClose,
}) => {
  const db = useSQLiteContext();
  const { wallets, categories, addTransaction, addDebt } = useWallet();
  const { showAlert, AlertModalComponent } = useCustomAlert(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [inAppMicEnabled, setInAppMicEnabled] = useState(true);

  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [personalityId, setPersonalityId] = useState<CopilotPersonalityId>('cheerful');
  const timerRef = useRef<any>(null);

  const isPressingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const isPreparingRef = useRef(false);
  const recordStartTimeRef = useRef(0);

  // Khởi tạo AudioRecorder từ expo-audio (chuẩn Expo SDK 57)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    if (visible) {
      getInAppMicEnabled(db).then(setInAppMicEnabled);
      getCopilotPersonality(db).then(pid => {
        setPersonalityId(pid);
        const p = COPILOT_PERSONALITIES[pid] || COPILOT_PERSONALITIES.cheerful;
        if (messages.length === 0) {
          setMessages([
            {
              id: 'welcome_1',
              sender: 'assistant',
              text: getWelcomeMessage(p),
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      });

      setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      }).catch(err => console.warn('setAudioMode error:', err));

      // Reset recorder status nếu trước đó chưa giải phóng
      try {
        const currentStatus = recorder.getStatus();
        if (currentStatus.isRecording || currentStatus.canRecord) {
          recorder.stop().catch(() => {});
        }
      } catch (_) {}
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (isRecordingRef.current) {
        recorder.stop().catch(() => {});
        isRecordingRef.current = false;
        setIsRecording(false);
      }
    }
  }, [visible, db]);

  // Hiệu ứng nhịp đập khi đang giữ mic thu âm
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSendText = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isGenerating) return;

    hapticLight();
    setInputText('');

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsGenerating(true);
    scrollToBottom();

    try {
      const historyPayload = newMessages.map(m => ({
        role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
        text: m.text,
      }));

      const res = await processCopilotTextInput(
        db,
        text,
        wallets,
        categories,
        historyPayload
      );

      const assistantMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: res.message,
        timestamp: new Date().toISOString(),
        copilotResponse: res,
      };

      setMessages(prev => [...prev, assistantMsg]);
      hapticSuccess();
    } catch (err: any) {
      hapticError();
      const errorMsg: ChatMessage = {
        id: `ai_err_${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ **Lỗi:** ${err?.message || 'Không thể xử lý yêu cầu.'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
      scrollToBottom();
    }
  };

  // ==================== XỬ LÝ MICRO TRONG APP (EXPO-AUDIO) ====================

  const handleStartRecording = async () => {
    if (isPreparingRef.current || isRecordingRef.current) return;
    isPreparingRef.current = true;
    isPressingRef.current = true;

    try {
      hapticMedium();
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        isPreparingRef.current = false;
        isPressingRef.current = false;
        showAlert(
          'Quyền Microphone',
          'Vui lòng cấp quyền Microphone để ghi âm câu lệnh giọng nói cho Trợ lý AI.'
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Nếu người dùng đã nhấc tay ra trong lúc xin quyền (hoặc quick tap < 100ms)
      if (!isPressingRef.current) {
        isPreparingRef.current = false;
        return;
      }

      // Kiểm tra trạng thái hiện tại của recorder
      try {
        const currentStatus = recorder.getStatus();
        if (currentStatus.isRecording) {
          await recorder.stop();
        }
        if (!recorder.getStatus().canRecord) {
          await recorder.prepareToRecordAsync();
        }
      } catch (prepErr) {
        console.warn('prepareToRecord fallback:', prepErr);
        try {
          await recorder.stop();
          await recorder.prepareToRecordAsync();
        } catch (_) {}
      }

      // Kiểm tra lại lần nữa: nếu đã nhả tay thì không record
      if (!isPressingRef.current) {
        isPreparingRef.current = false;
        try {
          await recorder.stop();
        } catch (_) {}
        return;
      }

      recorder.record();
      recordStartTimeRef.current = Date.now();
      isRecordingRef.current = true;
      setIsRecording(true);
      setRecordSeconds(0);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordSeconds(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Lỗi bắt đầu ghi âm:', err);
      try {
        await recorder.stop();
      } catch (_) {}
      isRecordingRef.current = false;
      setIsRecording(false);
      showAlert('Lỗi ghi âm', err?.message || 'Không thể khởi động micro.');
    } finally {
      isPreparingRef.current = false;
    }
  };

  const handleStopRecording = async () => {
    isPressingRef.current = false;

    // Nếu đang trong quá trình chuẩn bị (prepare), đánh dấu nhả tay để startRecording tự hủy
    if (isPreparingRef.current) {
      return;
    }

    if (!isRecordingRef.current) {
      return;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    isRecordingRef.current = false;
    setIsRecording(false);
    hapticMedium();

    const durationMs = Date.now() - recordStartTimeRef.current;

    try {
      await recorder.stop();

      // Nếu bấm quá nhanh (< 600ms, thường là bấm nhầm hoặc chạm nhẹ)
      if (durationMs < 600) {
        showAlert(
          'Ghi âm quá ngắn',
          'Vui lòng nhấn và giữ nút Micro trong lúc nói để ghi âm câu lệnh, hoặc dùng phím Micro trên bàn phím nhé.'
        );
        return;
      }

      const uri = recorder.uri;
      if (!uri) {
        showAlert('Lỗi', 'Không tìm thấy file ghi âm.');
        return;
      }

      setIsGenerating(true);
      const userMsg: ChatMessage = {
        id: `user_voice_${Date.now()}`,
        sender: 'user',
        text: '🎤 [Đoạn ghi âm giọng nói]',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);
      scrollToBottom();

      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      const res = await processCopilotAudioInput(
        db,
        base64Audio,
        'audio/m4a',
        wallets,
        categories
      );

      // Cập nhật lại text của user bằng transcript chính xác mà Gemini nghe được
      setMessages(prev =>
        prev.map(m =>
          m.id === userMsg.id && res.transcript
            ? { ...m, text: `🎤 "${res.transcript}"` }
            : m
        )
      );

      const assistantMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: res.message,
        timestamp: new Date().toISOString(),
        copilotResponse: res,
      };

      setMessages(prev => [...prev, assistantMsg]);
      hapticSuccess();
    } catch (err: any) {
      hapticError();
      const errorMsg: ChatMessage = {
        id: `ai_err_${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ **Lỗi:** ${err?.message || 'Không thể phân tích âm thanh.'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
      scrollToBottom();
    }
  };

  // ==================== XỬ LÝ LƯU GIAO DỊCH 1 CHẠM ====================

  const handleConfirmSave = async (
    msgId: string,
    data: {
      transaction?: CopilotParsedTransaction;
      debt?: CopilotParsedDebt;
    }
  ) => {
    try {
      if (data.transaction) {
        const tx = data.transaction;
        const targetWalletId =
          tx.wallet_id || (wallets.length > 0 ? wallets[0].id : null);
        if (!targetWalletId) {
          throw new Error('Chưa có ví hợp lệ để ghi giao dịch.');
        }

        await addTransaction({
          wallet_id: targetWalletId,
          category_id: tx.category_id || null,
          amount: tx.amount,
          type: tx.type,
          note: tx.note || 'Ghi chép từ Trợ lý Copilot',
          transacted_at: tx.transacted_at || new Date().toISOString(),
        });

        setMessages(prev =>
          prev.map(m => (m.id === msgId ? { ...m, isSaved: true } : m))
        );
      } else if (data.debt) {
        const d = data.debt;
        const targetWalletId =
          d.wallet_id || (wallets.length > 0 ? wallets[0].id : null);

        await addDebt({
          type: d.type,
          person_name: d.person_name,
          initial_amount: d.amount,
          wallet_id: targetWalletId,
          note: d.note || 'Ghi chép từ Trợ lý Copilot',
        });

        setMessages(prev =>
          prev.map(m => (m.id === msgId ? { ...m, isSaved: true } : m))
        );
      }
    } catch (err: any) {
      showAlert('Lỗi ghi sổ', err?.message || 'Không thể lưu vào cơ sở dữ liệu.');
      throw err;
    }
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.sender === 'user';

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowAssistant,
        ]}
      >
        {!isUser && (
          <View style={styles.assistantAvatar}>
            <Ionicons name="sparkles" size={14} color="#000000" />
          </View>
        )}

        <View
          style={[
            styles.bubbleShadow,
            isUser ? styles.bubbleShadowUser : styles.bubbleShadowAssistant,
          ]}
        >
          <View
            style={[
              styles.bubbleInner,
              isUser ? styles.bubbleInnerUser : styles.bubbleInnerAssistant,
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
              ]}
            >
              {item.text}
            </Text>

            {/* Thẻ Xem trước & Xác nhận Giao dịch 1 chạm */}
            {item.copilotResponse &&
              (item.copilotResponse.transaction || item.copilotResponse.debt) && (
                <CopilotTransactionCard
                  transaction={item.copilotResponse.transaction}
                  debt={item.copilotResponse.debt}
                  isSaved={item.isSaved}
                  onConfirm={data => handleConfirmSave(item.id, data)}
                />
              )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.fullScreenSafe}>
        {/* Header */}
        <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBox}>
                <Ionicons name="sparkles" size={16} color="#000000" />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.headerTitle}>Trợ Lý Tài Chính AI</Text>
                  <View
                    style={[
                      styles.headerPersonaBadge,
                      { backgroundColor: (COPILOT_PERSONALITIES[personalityId] || COPILOT_PERSONALITIES.cheerful).color },
                    ]}
                  >
                    <Ionicons
                      name={(COPILOT_PERSONALITIES[personalityId] || COPILOT_PERSONALITIES.cheerful).icon as any}
                      size={11}
                      color="#000000"
                    />
                    <Text style={styles.headerPersonaBadgeText}>
                      {(COPILOT_PERSONALITIES[personalityId] || COPILOT_PERSONALITIES.cheerful).badge}
                    </Text>
                  </View>
                </View>
                <Text style={styles.headerSubtitle}>
                  {(COPILOT_PERSONALITIES[personalityId] || COPILOT_PERSONALITIES.cheerful).name} • Gemini Flash
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <Pressable
                style={styles.clearBtn}
                onPress={() => {
                  hapticLight();
                  setMessages([]);
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#6B7280" />
              </Pressable>

              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color="#000000" />
              </Pressable>
            </View>
          </View>

          {/* Quick Prompt Chips */}
          <View style={styles.chipsContainer}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={QUICK_PROMPT_CHIPS}
              keyExtractor={item => item}
              contentContainerStyle={styles.chipsContent}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.chipBtnShadow}
                  onPress={() => handleSendText(item)}
                >
                  <View style={styles.chipBtnInner}>
                    <Text style={styles.chipBtnText}>{item}</Text>
                  </View>
                </Pressable>
              )}
            />
          </View>

          {/* Messages Area */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={scrollToBottom}
          />

          {/* AI Thinking Indicator */}
          {isGenerating && (
            <View style={styles.thinkingBar}>
              <ActivityIndicator size="small" color="#000000" />
              <Text style={styles.thinkingText}>Copilot đang suy nghĩ & phân tích...</Text>
            </View>
          )}

          {/* Recording Overlay Indicator */}
          {isRecording && (
            <View style={styles.recordingLiveBar}>
              <Animated.View
                style={[
                  styles.recordingDot,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              />
              <Text style={styles.recordingLiveText}>
                Đang nghe... {recordSeconds}s (Thả tay để gửi)
              </Text>
            </View>
          )}

          {/* Input Bar */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.inputBar}>
              {/* Optional In-App Mic Button */}
              {inAppMicEnabled && (
                <Pressable
                  style={[
                    styles.micBtnShadow,
                    isRecording && styles.micBtnShadowRecording,
                  ]}
                  onPressIn={handleStartRecording}
                  onPressOut={handleStopRecording}
                >
                  <View
                    style={[
                      styles.micBtnInner,
                      isRecording && styles.micBtnInnerRecording,
                    ]}
                  >
                    <Ionicons
                      name={isRecording ? 'mic' : 'mic-outline'}
                      size={20}
                      color={isRecording ? '#FFFFFF' : '#000000'}
                    />
                  </View>
                </Pressable>
              )}

              {/* Text Input with Gboard/iOS Mic Support */}
              <TextInput
                style={styles.textInput}
                placeholder={
                  inAppMicEnabled
                    ? 'Gõ hoặc giữ mic để nói...'
                    : 'Nhập câu lệnh hoặc chạm mic bàn phím...'
                }
                placeholderTextColor="#9CA3AF"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={() => handleSendText()}
                returnKeyType="send"
              />

              {/* Send Button */}
              <Pressable
                style={[
                  styles.sendBtnShadow,
                  !inputText.trim() && styles.sendBtnShadowDisabled,
                ]}
                onPress={() => handleSendText()}
                disabled={!inputText.trim() || isGenerating}
              >
                <View
                  style={[
                    styles.sendBtnInner,
                    !inputText.trim() && styles.sendBtnInnerDisabled,
                  ]}
                >
                  <Ionicons
                    name="arrow-up"
                    size={20}
                    color={inputText.trim() ? '#000000' : '#9CA3AF'}
                  />
                </View>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      {AlertModalComponent}
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenSafe: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: THEME.popBlue,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.3,
  },
  headerPersonaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  headerPersonaBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#000000',
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearBtn: {
    padding: 6,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#E5E7EB',
  },
  chipsContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chipBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 8,
  },
  chipBtnInner: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    transform: [{ translateX: -1.5 }, { translateY: -1.5 }],
  },
  chipBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 8,
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#C7D2FE',
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bubbleShadow: {
    maxWidth: '82%',
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  bubbleShadowUser: {
    borderBottomRightRadius: 2,
  },
  bubbleShadowAssistant: {
    borderBottomLeftRadius: 2,
  },
  bubbleInner: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 10,
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  bubbleInnerUser: {
    backgroundColor: THEME.popYellow,
    borderBottomRightRadius: 2,
  },
  bubbleInnerAssistant: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 2,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  bubbleTextUser: {
    fontWeight: '800',
    color: '#000000',
  },
  bubbleTextAssistant: {
    fontWeight: '600',
    color: '#111827',
  },
  thinkingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  thinkingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  recordingLiveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderTopWidth: 1.5,
    borderTopColor: '#EF4444',
    paddingVertical: 6,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  recordingLiveText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderTopColor: '#000000',
  },
  micBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  micBtnShadowRecording: {
    backgroundColor: '#991B1B',
  },
  micBtnInner: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  micBtnInnerRecording: {
    backgroundColor: '#DC2626',
    borderColor: '#991B1B',
  },
  textInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  sendBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  sendBtnShadowDisabled: {
    backgroundColor: '#E5E7EB',
  },
  sendBtnInner: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: THEME.popYellow,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  sendBtnInnerDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
});
