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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { useWallet } from '../../context/WalletContext';
import { useSecurity } from '../../context/SecurityContext';
import { THEME } from '../../constants';
import dayjs from 'dayjs';
import { Wallet } from '../../types';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '../../utils/haptics';
import { useCustomAlert } from '../CustomAlertModal';
import { normalizeToIsoString } from '../../utils/dateUtils';
import * as queries from '../../database/queries';
import { saveReceiptImages } from '../../services/geminiService';
import {
  processCopilotTextInput,
  processCopilotAudioInput,
  getInAppMicEnabled,
  getCopilotTtsEnabled,
  setCopilotTtsEnabled,
  speakCopilotMessage,
  stopCopilotSpeech,
  getCopilotPersonality,
  COPILOT_PERSONALITIES,
  CopilotPersonalityId,
  CopilotPersonality,
  ChatMessage,
} from '../../services/aiCopilotService';
import { CopilotTransactionCard, CopilotActionData } from './CopilotTransactionCard';

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

export interface FinancialCopilotModalProps {
  visible: boolean;
  onClose: () => void;
  initialImageUris?: string[];
  initialPrompt?: string;
  autoSend?: boolean;
}

export const FinancialCopilotModal: React.FC<FinancialCopilotModalProps> = ({
  visible,
  onClose,
  initialImageUris,
  initialPrompt,
  autoSend,
}) => {
  const db = useSQLiteContext();
  const {
    wallets,
    categories,
    addTransaction,
    addCreditExpenseWithPlan,
    removeTransaction,
    updateTransactionDetails,
    adjustBalance,
    addDebt,
    payOrCollectDebt,
    addPlannedExpense,
  } = useWallet();
  const { temporarilyBypassLock } = useSecurity();
  const { showAlert, AlertModalComponent } = useCustomAlert(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImageUris, setSelectedImageUris] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [inAppMicEnabled, setInAppMicEnabled] = useState(true);
  const [copilotTtsEnabled, setCopilotTtsEnabledState] = useState(true);

  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [personalityId, setPersonalityId] = useState<CopilotPersonalityId>('cheerful');
  const timerRef = useRef<any>(null);

  const isPressingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const isPreparingRef = useRef(false);
  const recordStartTimeRef = useRef(0);
  const hasHandledInitialRef = useRef(false);

  // Khởi tạo AudioRecorder từ expo-audio (chuẩn Expo SDK 57)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    if (visible) {
      console.log('[Copilot Modal] Modal opened. Loading settings and audio mode...');
      getInAppMicEnabled(db).then(setInAppMicEnabled);
      getCopilotTtsEnabled(db).then(ttsOn => {
        console.log('[Copilot Modal] Loaded TTS setting:', ttsOn);
        setCopilotTtsEnabledState(ttsOn);
        getCopilotPersonality(db).then(pid => {
          console.log('[Copilot Modal] Loaded personality:', pid);
          setPersonalityId(pid);
          const p = COPILOT_PERSONALITIES[pid] || COPILOT_PERSONALITIES.cheerful;
          if (messages.length === 0) {
            const welcomeText = getWelcomeMessage(p);
            setMessages([
              {
                id: 'welcome_1',
                sender: 'assistant',
                text: welcomeText,
                timestamp: new Date().toISOString(),
              },
            ]);
            if (ttsOn && !(autoSend && initialImageUris && initialImageUris.length > 0)) {
              console.log('[Copilot Modal] 📢 Auto-speaking welcome message...');
              speakCopilotMessage(welcomeText, pid);
            }
          }
        });
      });

      // Default to normal speakerphone playback mode (allowsRecording: false)
      console.log('[Copilot Audio] Initializing playback audio mode (allowsRecording: false)');
      setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      }).catch(err => console.warn('[Copilot Audio] setAudioMode error:', err));

      // Reset recorder status nếu trước đó chưa giải phóng
      try {
        const currentStatus = recorder.getStatus();
        if (currentStatus.isRecording || currentStatus.canRecord) {
          recorder.stop().catch(() => {});
        }
      } catch (_) {}

      // Xử lý nạp ảnh và tự động phân tích nếu được gửi từ share intent hoặc QuickAdd
      if (initialImageUris && initialImageUris.length > 0 && !hasHandledInitialRef.current) {
        hasHandledInitialRef.current = true;
        if (autoSend) {
          const prompt =
            initialPrompt ||
            'Phân tích hóa đơn / giao dịch này giúp mình và đề xuất ghi nhận sổ nhé';
          setTimeout(() => {
            handleSendText(prompt, initialImageUris);
          }, 350);
        } else {
          setSelectedImageUris(initialImageUris);
          if (initialPrompt) {
            setInputText(initialPrompt);
          }
        }
      }
    } else {
      console.log('[Copilot Modal] Modal closed, stopping TTS');
      hasHandledInitialRef.current = false;
      stopCopilotSpeech();
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
  }, [visible, db, initialImageUris, initialPrompt, autoSend]);

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

  // Chọn ảnh hóa đơn từ thư viện ảnh
  const handlePickImage = async () => {
    try {
      temporarilyBypassLock(120000);
      hapticLight();
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showAlert('Cần cấp quyền', 'Vui lòng cấp quyền truy cập thư viện ảnh để gửi hóa đơn.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedUris = result.assets.map(a => a.uri);
        setSelectedImageUris(prev => [...prev, ...pickedUris]);
      }
    } catch (err: any) {
      hapticError();
      showAlert('Lỗi', err?.message || 'Không thể chọn ảnh từ thư viện');
    }
  };

  // Chụp ảnh hóa đơn trực tiếp bằng camera (thêm vào danh sách ảnh)
  const handleTakePhoto = async () => {
    try {
      temporarilyBypassLock(120000);
      hapticLight();
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showAlert('Cần cấp quyền', 'Vui lòng cấp quyền sử dụng máy ảnh để chụp hóa đơn.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImageUris(prev => [...prev, result.assets[0].uri]);
      }
    } catch (err: any) {
      hapticError();
      showAlert('Lỗi', err?.message || 'Không thể chụp ảnh');
    }
  };

  // Gỡ một ảnh khỏi danh sách đang chọn
  const handleRemoveSelectedImage = (indexToRemove: number) => {
    hapticLight();
    setSelectedImageUris(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSendText = async (textToSend?: string, overrideImages?: string[]) => {
    stopCopilotSpeech(); // Dừng ngay âm thanh nếu đang phát
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    const imagesToSend = overrideImages !== undefined ? overrideImages : [...selectedImageUris];
    if ((!text && imagesToSend.length === 0) || isGenerating) return;

    hapticLight();
    setInputText('');
    setSelectedImageUris([]);

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text:
        text ||
        (imagesToSend.length > 0
          ? (imagesToSend.length > 1
            ? `📷 [${imagesToSend.length} ảnh đính kèm]`
            : '📷 [Ảnh đính kèm]')
          : ''),
      imageUri: imagesToSend[0] || undefined,
      imageUris: imagesToSend.length > 0 ? imagesToSend : undefined,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsGenerating(true);
    scrollToBottom();

    try {
      // Chỉ truyền các lượt hội thoại trước đó (loại trừ userMsg hiện tại để tránh trùng lặp turn)
      const historyPayload = messages.map(m => ({
        role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
        text: m.text,
      }));

      const res = await processCopilotTextInput(
        db,
        text,
        wallets,
        categories,
        historyPayload,
        imagesToSend.length > 0 ? imagesToSend : undefined
      );

      const assistantMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: res.message,
        timestamp: new Date().toISOString(),
        copilotResponse: res,
        imageUri: imagesToSend[0] || undefined,
        imageUris: imagesToSend.length > 0 ? imagesToSend : undefined,
      };

      setMessages(prev => [...prev, assistantMsg]);
      hapticSuccess();

      // Đọc phát âm phản hồi nếu TTS được bật
      if (copilotTtsEnabled) {
        speakCopilotMessage(res.message, personalityId);
      }
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
    stopCopilotSpeech(); // Ngừng phát âm TTS ngay lập tức khi giữ mic
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

      // Đợi một nhịp ngắn (60ms) để native audio focus của TTS giải phóng hoàn toàn
      await new Promise(r => setTimeout(r, 60));

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      if (!isPressingRef.current) {
        isPreparingRef.current = false;
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        }).catch(() => {});
        return;
      }

      try {
        const currentStatus = recorder.getStatus();
        if (currentStatus.isRecording) {
          await recorder.stop();
        }
      } catch (_) {}

      await recorder.prepareToRecordAsync();

      if (!isPressingRef.current) {
        isPreparingRef.current = false;
        try {
          await recorder.stop();
        } catch (_) {}
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        }).catch(() => {});
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

      // Immediately restore playback audio mode so speakerphone isn't blocked
      console.log('[Copilot Audio] Restoring playback audio mode...');
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      }).catch(err => console.warn('[Copilot Audio] Restore audio mode error:', err));

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

      // HỖ TRỢ VỪA GỬI ẢNH VỪA GHI ÂM: Lấy danh sách ảnh đang chọn và dọn sạch preview
      const imagesToSend = [...selectedImageUris];
      setSelectedImageUris([]);

      setIsGenerating(true);
      const userMsg: ChatMessage = {
        id: `user_voice_${Date.now()}`,
        sender: 'user',
        text: '🎤 [Đang nhận diện giọng nói...]',
        imageUri: imagesToSend[0] || undefined,
        imageUris: imagesToSend.length > 0 ? imagesToSend : undefined,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);
      scrollToBottom();

      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      // Lấy lịch sử hội thoại trước đó (loại trừ userMsg hiện tại) để Gemini kế thừa ngữ cảnh
      const historyPayload = messages.map(m => ({
        role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
        text: m.text,
      }));

      const res = await processCopilotAudioInput(
        db,
        base64Audio,
        'audio/m4a',
        wallets,
        categories,
        historyPayload,
        imagesToSend.length > 0 ? imagesToSend : undefined
      );

      // Cập nhật lại text của user bằng transcript chính xác mà Gemini nghe được
      setMessages(prev =>
        prev.map(m =>
          m.id === userMsg.id
            ? {
                ...m,
                text: res.transcript
                  ? `🎤 "${res.transcript}"`
                  : '🎤 [Đoạn ghi âm giọng nói]',
              }
            : m
        )
      );

      const assistantMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: res.message,
        timestamp: new Date().toISOString(),
        copilotResponse: res,
        imageUri: imagesToSend[0] || undefined,
        imageUris: imagesToSend.length > 0 ? imagesToSend : undefined,
      };

      setMessages(prev => [...prev, assistantMsg]);
      hapticSuccess();

      if (copilotTtsEnabled) {
        speakCopilotMessage(res.message, personalityId);
      }
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

  // ==================== XỬ LÝ LƯU GIAO DỊCH / HÀNH ĐỘNG 1 CHẠM ====================

  const savingMsgIdsRef = useRef<Set<string>>(new Set());

  // Helper tính ngày đến hạn thanh toán thông minh cho thẻ tín dụng
  const getSuggestedCreditDueDate = (wallet?: Wallet, baseDate: Date = new Date()): string => {
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

  const handleConfirmSave = async (
    msgId: string,
    data: CopilotActionData,
    attachedImages?: string[] | string
  ) => {
    if (savingMsgIdsRef.current.has(msgId)) return;
    savingMsgIdsRef.current.add(msgId);
    try {
      // 0. Lưu ảnh hóa đơn vĩnh viễn (lên Cloudinary hoặc bộ nhớ máy)
      let persistentUris: string[] | null = null;
      const imgsToSave: string[] = [];
      if (Array.isArray(attachedImages)) {
        imgsToSave.push(...attachedImages.filter(Boolean));
      } else if (typeof attachedImages === 'string' && attachedImages.trim()) {
        imgsToSave.push(attachedImages.trim());
      } else if (Array.isArray(data.imageUris) && data.imageUris.length > 0) {
        imgsToSave.push(...data.imageUris.filter(Boolean));
      } else if (data.imageUri) {
        imgsToSave.push(data.imageUri);
      }

      if (imgsToSave.length > 0) {
        try {
          persistentUris = await saveReceiptImages(imgsToSave, db);
        } catch (imgErr) {
          console.warn('[Copilot] Could not persist receipt images:', imgErr);
          persistentUris = imgsToSave;
        }
      }

      // Chuẩn hoá giao dịch hàng loạt vs đơn lẻ
      const targetTransactions =
        data.transactions && data.transactions.length > 1
          ? data.transactions
          : null;
      const targetSingleTransaction =
        data.transaction ||
        (data.transactions && data.transactions.length === 1
          ? data.transactions[0]
          : null);

      // 1. Lưu bộ giao dịch hàng loạt (Batch Transactions)
      if (targetTransactions && targetTransactions.length > 0) {
        for (const tx of targetTransactions) {
          const targetWalletId =
            tx.wallet_id || (wallets.length > 0 ? wallets[0].id : null);
          if (!targetWalletId) continue;

          const targetWallet = wallets.find(w => w.id === targetWalletId);
          if (targetWallet && targetWallet.type === 'credit' && tx.type === 'expense') {
            const firstDueDate = getSuggestedCreditDueDate(
              targetWallet,
              tx.transacted_at ? new Date(tx.transacted_at) : new Date()
            );
            const itemPayload: any = {};
            if (tx.items && tx.items.length > 0) itemPayload.items = tx.items;
            if (tx.adjustments && tx.adjustments.length > 0) itemPayload.adjustments = tx.adjustments;
            if (tx.members && tx.members.length > 0) itemPayload.members = tx.members;
            const serializedItems = Object.keys(itemPayload).length > 0 ? JSON.stringify(itemPayload) : null;

            await addCreditExpenseWithPlan({
              creditWalletId: targetWalletId,
              amount: tx.amount,
              categoryId: tx.category_id || null,
              note: tx.note || 'Ghi chép từ Trợ lý Copilot',
              transactedAt: normalizeToIsoString(tx.transacted_at),
              firstDueDate,
              image_uris: persistentUris,
              items: serializedItems,
            });
          } else {
            const itemPayload: any = {};
            if (tx.items && tx.items.length > 0) itemPayload.items = tx.items;
            if (tx.adjustments && tx.adjustments.length > 0) itemPayload.adjustments = tx.adjustments;
            if (tx.members && tx.members.length > 0) itemPayload.members = tx.members;
            const serializedItems = Object.keys(itemPayload).length > 0 ? JSON.stringify(itemPayload) : null;

            await addTransaction({
              wallet_id: targetWalletId,
              category_id: tx.category_id || null,
              amount: tx.amount,
              type: tx.type,
              note: tx.note || 'Ghi chép từ Trợ lý Copilot',
              transacted_at: normalizeToIsoString(tx.transacted_at),
              image_uris: persistentUris,
              items: serializedItems,
            });
          }

          if (tx.recipient_name && tx.note) {
            try {
              await queries.upsertPayeeMapping(db, {
                payee_name: tx.recipient_name,
                note: tx.note,
                category_id: tx.category_id || null,
                wallet_id: targetWalletId,
              });
            } catch (payeeErr) {
              console.warn('[Copilot] Could not upsert payee mapping:', payeeErr);
            }
          }
        }
        setMessages(prev =>
          prev.map(m => (m.id === msgId ? { ...m, isSaved: true } : m))
        );
      }
      // 2. Chuyển tiền liên ví (Transfer)
      else if (data.transfer) {
        const tr = data.transfer;
        const fromWalletId =
          tr.from_wallet_id || (wallets.length > 0 ? wallets[0].id : null);
        const toWalletId = tr.to_wallet_id;
        if (!fromWalletId || !toWalletId) {
          throw new Error('Cần xác định đủ ví nguồn và ví đích để chuyển tiền.');
        }
        await addTransaction({
          type: 'transfer',
          wallet_id: fromWalletId,
          to_wallet_id: toWalletId,
          amount: tr.amount,
          note: tr.note || 'Chuyển tiền qua Trợ lý Copilot',
          transacted_at: normalizeToIsoString(tr.transacted_at),
        });
        setMessages(prev =>
          prev.map(m => (m.id === msgId ? { ...m, isSaved: true } : m))
        );
      }
      // 3. Trả nợ / Thu nợ cũ (Debt Settlement)
      else if (data.debtSettlement) {
        const ds = data.debtSettlement;
        let targetDebtId = ds.debt_id;
        if (!targetDebtId) {
          const debts = await queries.getDebts(db);
          const matched = debts.find(
            d =>
              (d.status === 'active' || d.remaining_amount > 0) &&
              d.person_name.toLowerCase().includes(ds.person_name.toLowerCase())
          );
          if (matched) targetDebtId = matched.id;
        }
        if (!targetDebtId) {
          throw new Error(`Không tìm thấy khoản nợ của "${ds.person_name}" để tất toán.`);
        }
        const targetWalletId =
          ds.wallet_id || (wallets.length > 0 ? wallets[0].id : null);
        if (!targetWalletId) {
          throw new Error('Chưa có ví hợp lệ để tất toán nợ.');
        }
        await payOrCollectDebt({
          debtId: targetDebtId,
          amount: ds.amount,
          walletId: targetWalletId,
          note: ds.note || (ds.type === 'receive' ? 'Thu nợ qua Copilot' : 'Trả nợ qua Copilot'),
        });
        setMessages(prev =>
          prev.map(m => (m.id === msgId ? { ...m, isSaved: true } : m))
        );
      }
      // 4. Kế hoạch dự chi tương lai (Planned Expense)
      else if (data.plannedExpense) {
        const pe = data.plannedExpense;
        const targetWalletId =
          pe.wallet_id || (wallets.length > 0 ? wallets[0].id : null);
        await addPlannedExpense({
          title: pe.title || 'Dự chi Copilot',
          amount: pe.amount,
          target_date: pe.target_date || new Date().toISOString().split('T')[0],
          wallet_id: targetWalletId,
          category_id: pe.category_id || null,
          note: pe.note || 'Lên lịch từ Trợ lý Copilot',
        });
        setMessages(prev =>
          prev.map(m => (m.id === msgId ? { ...m, isSaved: true } : m))
        );
      }
      // 5. Giao dịch đơn lẻ (Single Transaction)
      else if (targetSingleTransaction) {
        const tx = targetSingleTransaction;
        const targetWalletId =
          tx.wallet_id || (wallets.length > 0 ? wallets[0].id : null);
        if (!targetWalletId) {
          throw new Error('Chưa có ví hợp lệ để ghi giao dịch.');
        }

        const targetWallet = wallets.find(w => w.id === targetWalletId);
        if (targetWallet && targetWallet.type === 'credit' && tx.type === 'expense') {
          const firstDueDate = getSuggestedCreditDueDate(
            targetWallet,
            tx.transacted_at ? new Date(tx.transacted_at) : new Date()
          );
          const itemPayload: any = {};
          if (tx.items && tx.items.length > 0) itemPayload.items = tx.items;
          if (tx.adjustments && tx.adjustments.length > 0) itemPayload.adjustments = tx.adjustments;
          if (tx.members && tx.members.length > 0) itemPayload.members = tx.members;
          const serializedItems = Object.keys(itemPayload).length > 0 ? JSON.stringify(itemPayload) : null;

          await addCreditExpenseWithPlan({
            creditWalletId: targetWalletId,
            amount: tx.amount,
            categoryId: tx.category_id || null,
            note: tx.note || 'Ghi chép từ Trợ lý Copilot',
            transactedAt: tx.transacted_at || new Date().toISOString(),
            firstDueDate,
            image_uris: persistentUris,
            items: serializedItems,
          });
        } else {
          const itemPayload: any = {};
          if (tx.items && tx.items.length > 0) itemPayload.items = tx.items;
          if (tx.adjustments && tx.adjustments.length > 0) itemPayload.adjustments = tx.adjustments;
          if (tx.members && tx.members.length > 0) itemPayload.members = tx.members;
          const serializedItems = Object.keys(itemPayload).length > 0 ? JSON.stringify(itemPayload) : null;

          await addTransaction({
            wallet_id: targetWalletId,
            category_id: tx.category_id || null,
            amount: tx.amount,
            type: tx.type,
            note: tx.note || 'Ghi chép từ Trợ lý Copilot',
            transacted_at: tx.transacted_at || new Date().toISOString(),
            image_uris: persistentUris,
            items: serializedItems,
          });
        }

        if (tx.recipient_name && tx.note) {
          try {
            await queries.upsertPayeeMapping(db, {
              payee_name: tx.recipient_name,
              note: tx.note,
              category_id: tx.category_id || null,
              wallet_id: targetWalletId,
            });
          } catch (payeeErr) {
            console.warn('[Copilot] Could not upsert payee mapping:', payeeErr);
          }
        }

        setMessages(prev =>
          prev.map(m => (m.id === msgId ? { ...m, isSaved: true } : m))
        );
      }
      // 6. Ghi nợ mới (Create Debt)
      else if (data.debt) {
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
      // 7. Cân đối / Điều chỉnh số dư ví (Adjust Balance)
      else if (data.adjustBalance) {
        const ab = data.adjustBalance;
        await adjustBalance(
          ab.wallet_id,
          ab.new_balance,
          ab.note || 'Cân đối qua Copilot',
          true
        );
        setMessages(prev =>
          prev.map(m => (m.id === msgId ? { ...m, isSaved: true } : m))
        );
      }
      // 8. Xóa giao dịch (Delete Transaction)
      else if (data.deleteTransaction) {
        const dt = data.deleteTransaction;
        await removeTransaction(dt.transaction_id);
        setMessages(prev =>
          prev.map(m => (m.id === msgId ? { ...m, isSaved: true } : m))
        );
      }
      // 9. Cập nhật giao dịch (Update Transaction)
      else if (data.updateTransaction) {
        const ut = data.updateTransaction;
        await updateTransactionDetails(ut.transaction_id, {
          amount: ut.new_amount,
          note: ut.new_note,
          wallet_id: ut.new_wallet_id,
          category_id: ut.new_category_id,
          transacted_at: ut.new_transacted_at ? normalizeToIsoString(ut.new_transacted_at) : undefined,
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
    const cr = item.copilotResponse;
    const hasCard = !isUser && Boolean(cr && (
      cr.transaction ||
      (cr.transactions && cr.transactions.length > 0) ||
      cr.transfer ||
      cr.debt ||
      cr.debt_settlement ||
      cr.planned_expense ||
      cr.adjust_balance ||
      cr.delete_transaction ||
      cr.update_transaction
    ));

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
            hasCard && styles.bubbleShadowWithCard,
          ]}
        >
          <View
            style={[
              styles.bubbleInner,
              isUser ? styles.bubbleInnerUser : styles.bubbleInnerAssistant,
              hasCard && styles.bubbleInnerWithCard,
            ]}
          >
            {/* Ảnh hóa đơn đính kèm nếu có (chỉ hiển thị ở bubble người dùng) */}
            {isUser && (item.imageUris || item.imageUri) && (
              <View style={styles.bubbleImagesGrid}>
                {(item.imageUris || (item.imageUri ? [item.imageUri] : [])).map((img, idx) => (
                  <Image
                    key={idx}
                    source={{ uri: img }}
                    style={
                      (item.imageUris && item.imageUris.length > 1)
                        ? styles.bubbleAttachedImageMulti
                        : styles.bubbleAttachedImage
                    }
                    resizeMode="cover"
                  />
                ))}
              </View>
            )}

            <Text
              style={[
                styles.bubbleText,
                isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
              ]}
            >
              {item.text}
            </Text>

            {/* Thẻ Xem trước & Xác nhận Giao dịch 1 chạm */}
            {item.copilotResponse && (() => {
              let attachedImgs = item.imageUris || (item.imageUri ? [item.imageUri] : []);
              if (attachedImgs.length === 0 && !isUser) {
                const itemIndex = messages.findIndex(m => m.id === item.id);
                // Quét ngược tìm ảnh gần nhất trong các tin nhắn gần đó (lên tới 8 tin nhắn)
                for (let i = itemIndex - 1; i >= 0 && i >= itemIndex - 8; i--) {
                  const prevMsg = messages[i];
                  const prevImgs = prevMsg.imageUris || (prevMsg.imageUri ? [prevMsg.imageUri] : []);
                  if (prevImgs.length > 0) {
                    attachedImgs = prevImgs;
                    break;
                  }
                }
              }

              return (
                <CopilotTransactionCard
                  transaction={item.copilotResponse.transaction}
                  transactions={item.copilotResponse.transactions}
                  transfer={item.copilotResponse.transfer}
                  debt={item.copilotResponse.debt}
                  debtSettlement={item.copilotResponse.debt_settlement}
                  plannedExpense={item.copilotResponse.planned_expense}
                  adjustBalance={item.copilotResponse.adjust_balance}
                  deleteTransaction={item.copilotResponse.delete_transaction}
                  updateTransaction={item.copilotResponse.update_transaction}
                  imageUri={attachedImgs[0] || null}
                  imageUris={attachedImgs}
                  isSaved={item.isSaved}
                  onConfirm={data => handleConfirmSave(item.id, data, attachedImgs)}
                />
              );
            })()}
          </View>
        </View>
      </View>
    );
  };

  const canSend = Boolean(inputText.trim() || selectedImageUris.length > 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        stopCopilotSpeech();
        onClose();
      }}
    >
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.fullScreenSafe}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconBox}>
              <Ionicons name="sparkles" size={16} color="#000000" />
            </View>
            <View style={styles.headerTitleCol}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Trợ Lý Copilot
              </Text>
              <View style={styles.headerSubtitleRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        (COPILOT_PERSONALITIES[personalityId] || COPILOT_PERSONALITIES.cheerful).color,
                    },
                  ]}
                />
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {(COPILOT_PERSONALITIES[personalityId] || COPILOT_PERSONALITIES.cheerful).badge} • Gemini Flash
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.headerRight}>
            {/* Nút Bật / Tắt Giọng đọc TTS */}
            <Pressable
              style={[
                styles.headerActionBtn,
                copilotTtsEnabled ? styles.ttsBtnActive : styles.headerActionBtnMuted,
              ]}
              onPress={() => {
                hapticLight();
                const next = !copilotTtsEnabled;
                setCopilotTtsEnabledState(next);
                setCopilotTtsEnabled(db, next);
                if (!next) {
                  stopCopilotSpeech();
                }
              }}
              hitSlop={6}
            >
              <Ionicons
                name={copilotTtsEnabled ? 'volume-high' : 'volume-mute'}
                size={16}
                color={copilotTtsEnabled ? '#000000' : '#9CA3AF'}
              />
            </Pressable>

            {/* Nút Xóa lịch sử chat (chỉ hiện khi đã có tin nhắn trao đổi) */}
            {messages.length > 1 && (
              <Pressable
                style={styles.headerActionBtn}
                onPress={() => {
                  hapticLight();
                  stopCopilotSpeech();
                  const p = COPILOT_PERSONALITIES[personalityId] || COPILOT_PERSONALITIES.cheerful;
                  setMessages([
                    {
                      id: `welcome_${Date.now()}`,
                      sender: 'assistant',
                      text: getWelcomeMessage(p),
                      timestamp: new Date().toISOString(),
                    },
                  ]);
                }}
                hitSlop={6}
              >
                <Ionicons name="trash-outline" size={16} color="#4B5563" />
              </Pressable>
            )}

            {/* Nút Đóng */}
            <Pressable
              style={[styles.headerActionBtn, styles.closeBtn]}
              onPress={() => {
                stopCopilotSpeech();
                onClose();
              }}
              hitSlop={6}
            >
              <Ionicons name="close" size={18} color="#000000" />
            </Pressable>
          </View>
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

        {/* Input Bar with Camera, Gallery & Mic */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Ảnh được chọn xem trước (hỗ trợ nhiều ảnh) */}
          {selectedImageUris.length > 0 && (
            <View style={styles.imagePreviewBar}>
              <View style={styles.imagePreviewHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="images" size={13} color="#000000" />
                  <Text style={styles.previewTitle}>
                    {selectedImageUris.length} ảnh đính kèm
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    hapticLight();
                    setSelectedImageUris([]);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.previewClearAllText}>Xóa tất cả</Text>
                </Pressable>
              </View>

              <FlatList
                horizontal
                data={selectedImageUris}
                keyExtractor={(_, index) => String(index)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                renderItem={({ item: uri, index }) => (
                  <View style={styles.previewThumbWrapper}>
                    <Image source={{ uri }} style={styles.previewThumb} resizeMode="cover" />
                    <Pressable
                      style={styles.previewRemoveBadge}
                      onPress={() => handleRemoveSelectedImage(index)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close" size={11} color="#FFFFFF" />
                    </Pressable>
                  </View>
                )}
              />
            </View>
          )}

          <View style={styles.inputBar}>
            {/* Camera Button */}
            <Pressable style={styles.actionMediaBtn} onPress={handleTakePhoto}>
              <Ionicons name="camera-outline" size={20} color="#000000" />
            </Pressable>

            {/* Gallery Button */}
            <Pressable style={styles.actionMediaBtn} onPress={handlePickImage}>
              <Ionicons name="image-outline" size={20} color="#000000" />
            </Pressable>

            {/* Optional In-App Mic Button */}
            {inAppMicEnabled && (
              <Pressable
                style={[
                  styles.micBtnShadow,
                  isRecording && styles.micBtnShadowRecording,
                ]}
                onPressIn={() => {
                  stopCopilotSpeech();
                  handleStartRecording();
                }}
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

            {/* Text Input */}
            <TextInput
              style={styles.textInput}
              placeholder={
                selectedImageUris.length > 0
                  ? inAppMicEnabled
                    ? 'Thêm ghi chú hoặc giữ mic để nói...'
                    : 'Thêm ghi chú hoặc bấm gửi ngay...'
                  : inAppMicEnabled
                  ? 'Gõ hoặc giữ mic để nói...'
                  : 'Nhập câu lệnh hoặc chạm mic...'
              }
              placeholderTextColor="#9CA3AF"
              value={inputText}
              onChangeText={text => {
                stopCopilotSpeech();
                setInputText(text);
              }}
              onSubmitEditing={() => handleSendText()}
              returnKeyType="send"
            />

            {/* Send Button */}
            <Pressable
              style={[
                styles.sendBtnShadow,
                !canSend && styles.sendBtnShadowDisabled,
              ]}
              onPress={() => handleSendText()}
              disabled={!canSend || isGenerating}
            >
              <View
                style={[
                  styles.sendBtnInner,
                  !canSend && styles.sendBtnInnerDisabled,
                ]}
              >
                <Ionicons
                  name="arrow-up"
                  size={20}
                  color={canSend ? '#000000' : '#9CA3AF'}
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
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: THEME.popBlue,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.3,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1,
    borderColor: '#000000',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttsBtnActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#000000',
  },
  headerActionBtnMuted: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  closeBtn: {
    backgroundColor: '#F3F4F6',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 4,
    width: '100%',
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
    maxWidth: '85%',
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  bubbleShadowUser: {
    borderBottomRightRadius: 2,
  },
  bubbleShadowAssistant: {
    borderBottomLeftRadius: 2,
  },
  bubbleShadowWithCard: {
    flex: 1,
    maxWidth: '100%',
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
  bubbleInnerWithCard: {},
  bubbleImageWrapper: {
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  bubbleAttachedImage: {
    width: 220,
    height: 140,
    backgroundColor: '#E5E7EB',
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
  imagePreviewBar: {
    backgroundColor: '#FAF8F5',
    borderTopWidth: 2,
    borderTopColor: '#000000',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  imagePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  previewClearAllText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
  },
  previewThumbWrapper: {
    position: 'relative',
    marginRight: 6,
    paddingTop: 3,
    paddingRight: 3,
  },
  previewThumb: {
    width: 44,
    height: 44,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  previewRemoveBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  bubbleImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  bubbleAttachedImageMulti: {
    width: 76,
    height: 76,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderTopColor: '#000000',
  },
  actionMediaBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  micBtnShadowRecording: {
    backgroundColor: '#991B1B',
  },
  micBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -1.5 }, { translateY: -1.5 }],
  },
  micBtnInnerRecording: {
    backgroundColor: '#DC2626',
    borderColor: '#991B1B',
  },
  textInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 9,
    paddingHorizontal: 10,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#000000',
  },
  sendBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 9,
  },
  sendBtnShadowDisabled: {
    backgroundColor: '#E5E7EB',
  },
  sendBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: THEME.popYellow,
    borderWidth: 1.5,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -1.5 }, { translateY: -1.5 }],
  },
  sendBtnInnerDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
});
