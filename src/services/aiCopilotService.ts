import * as SQLite from 'expo-sqlite';
import dayjs from 'dayjs';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';
import { Category, Wallet, ReceiptItem } from '../types';
import {
  getGeminiApiKey,
  getPreferredGeminiModel,
  getModelFallbackList,
  formatGeminiErrorMessage,
  isNetworkError,
} from './geminiService';
import * as queries from '../database/queries';

export type CopilotIntent =
  | 'create_transaction'
  | 'create_transactions'
  | 'transfer_money'
  | 'settle_debt'
  | 'create_debt'
  | 'create_planned'
  | 'adjust_balance'
  | 'delete_transaction'
  | 'update_transaction'
  | 'query'
  | 'unknown';

export interface CopilotParsedBalanceAdjustment {
  wallet_id: string;
  wallet_name: string;
  current_balance: number;
  new_balance: number;
  diff: number; // new_balance - current_balance
  note?: string;
}

export interface CopilotParsedDeleteTransaction {
  transaction_id: string;
  amount: number;
  note?: string;
  wallet_id?: string;
  wallet_name?: string;
  transacted_at?: string;
}

export interface CopilotParsedUpdateTransaction {
  transaction_id: string;
  old_amount?: number;
  new_amount?: number;
  old_wallet_id?: string;
  new_wallet_id?: string;
  new_wallet_name?: string;
  old_category_id?: string;
  new_category_id?: string;
  new_category_name?: string;
  old_note?: string;
  new_note?: string;
  new_transacted_at?: string;
}

export interface CopilotParsedTransaction {
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  wallet_id?: string | null;
  wallet_name?: string | null;
  to_wallet_id?: string | null;
  to_wallet_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  category_icon?: string | null;
  category_color?: string | null;
  note?: string;
  transacted_at: string;
  items?: ReceiptItem[] | null;
}

export interface CopilotParsedTransfer {
  from_wallet_id?: string | null;
  from_wallet_name?: string | null;
  to_wallet_id?: string | null;
  to_wallet_name?: string | null;
  amount: number;
  note?: string;
  transacted_at?: string;
}

export interface CopilotParsedDebtSettlement {
  debt_id?: string | null;
  person_name: string;
  amount: number;
  type: 'receive' | 'pay'; // 'receive' = người khác trả mình, 'pay' = mình trả người khác
  wallet_id?: string | null;
  wallet_name?: string | null;
  note?: string;
}

export interface CopilotParsedPlannedExpense {
  title: string;
  amount: number;
  target_date: string;
  wallet_id?: string | null;
  wallet_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  note?: string;
}

export interface CopilotParsedDebt {
  type: 'lend' | 'borrow';
  person_name: string;
  amount: number;
  wallet_id?: string | null;
  wallet_name?: string | null;
  due_date?: string | null;
  note?: string;
}

export interface CopilotResponse {
  intent: CopilotIntent;
  message: string;
  transcript?: string;
  transaction?: CopilotParsedTransaction;
  transactions?: CopilotParsedTransaction[];
  transfer?: CopilotParsedTransfer;
  debt?: CopilotParsedDebt;
  debt_settlement?: CopilotParsedDebtSettlement;
  planned_expense?: CopilotParsedPlannedExpense;
  adjust_balance?: CopilotParsedBalanceAdjustment;
  delete_transaction?: CopilotParsedDeleteTransaction;
  update_transaction?: CopilotParsedUpdateTransaction;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  imageUri?: string;
  imageUris?: string[];
  audioUri?: string;
  copilotResponse?: CopilotResponse;
  isSaved?: boolean;
}

export type CopilotPersonalityId =
  | 'cheerful'
  | 'strict'
  | 'affluent'
  | 'confidant'
  | 'minimalist'
  | 'genz';

export interface CopilotPersonality {
  id: CopilotPersonalityId;
  name: string;
  badge: string;
  desc: string;
  sampleQuote: string;
  icon: string;
  color: string;
  promptInstruction: string;
}

export const COPILOT_PERSONALITIES: Record<CopilotPersonalityId, CopilotPersonality> = {
  cheerful: {
    id: 'cheerful',
    name: 'Vui vẻ, dí dỏm',
    badge: 'Hài hước',
    desc: 'Lạc quan, tràn đầy năng lượng, khen ngợi và trêu đùa vui tươi.',
    sampleQuote: 'Dạ có ngay! Bún đậu ngon miệng nha bạn ơi, đã ghi 55k ví MoMo xong xuôi!',
    icon: 'happy-outline',
    color: '#FACC15',
    promptInstruction: `
TÍNH CÁCH BẮT BUỘC: VUI VẺ, HÀI HƯỚC, DÍ DỎM VÀ ĐẦY NĂNG LƯỢNG TÍCH CỰC!
- Tuyệt đối KHÔNG trả lời khô khan hay máy móc như robot.
- Dùng từ ngữ đời thường, tươi vui, hóm hỉnh (VD: "Có ngay bạn ơi!", "Ăn ngon miệng nha!", "Ví đang rủng rỉnh thế này thì xõa thôi!").
- Khi người dùng chi tiêu ăn uống hay giải trí, hãy chúc ngon miệng hoặc trêu đùa nhẹ nhàng, sảng khoái.
- Khi người dùng tiết kiệm được tiền, hãy nhiệt tình vỗ tay khen ngợi!
`.trim(),
  },
  strict: {
    id: 'strict',
    name: 'Khó tính, nghiêm khắc',
    badge: 'Kỷ luật thép',
    desc: 'Cực kỳ nguyên tắc, thẳng thắn phê bình chi tiêu hoang phí, nhắc tiết kiệm.',
    sampleQuote: 'Lại ăn hàng nữa à? Hôm nay tiêu quá nhiều rồi đấy, lo mà tiết kiệm đi!',
    icon: 'alert-circle-outline',
    color: '#FB7185',
    promptInstruction: `
TÍNH CÁCH BẮT BUỘC: VIÊN KIỂM TOÁN TÀI CHÍNH CỰC KỲ KHÓ TÍNH, THẲNG THẮN VÀ NGHIÊM KHẮC!
- Tuyệt đối KHÔNG nịnh bợ, không trả lời nhạt nhẽo như bot.
- Soi xét gắt gao các khoản chi tiêu: Nếu người dùng chi tiêu vào ăn vặt, trà sữa, mua sắm không thiết yếu, hãy thẳng thắn cảnh báo và mắng yêu/phê bình kỷ luật (VD: "Lại tiêu tiền nữa à? Sổ nợ còn chưa trả hết kìa!", "Đổ xăng thì được, chứ mua thêm trà sữa nữa là tôi báo động đỏ đấy nhé!").
- Luôn thúc giục người dùng thắt lưng buộc bụng và giữ kỷ luật tài chính thép.
`.trim(),
  },
  affluent: {
    id: 'affluent',
    name: 'Tài phiệt, sang chảnh',
    badge: 'Chủ tịch',
    desc: 'Gọi người dùng là Chủ tịch/Sếp, coi tiền bạc là nghệ thuật kiểm soát dòng tiền.',
    sampleQuote: 'Mấy chục nghìn lẻ này không đáng để Chủ tịch bận tâm, tôi đã giải ngân xong!',
    icon: 'diamond-outline',
    color: '#38BDF8',
    promptInstruction: `
TÍNH CÁCH BẮT BUỘC: PHONG CÁCH TÀI PHIỆT, ĐẠI GIA QUÝ TỘC, ĐIỀM ĐẠM VÀ SANG CHẢNH!
- Luôn gọi người dùng là "Chủ tịch" hoặc "Sếp".
- Nói chuyện đĩnh đạc, tự tin, phong thái của một trợ lý tài phiệt cao cấp.
- Coi các khoản chi tiêu nhỏ là chuyện vặt (VD: "Khoản tiền lẻ này không đáng để Chủ tịch bận tâm, tôi đã giải ngân ghi sổ chu đáo rồi!", "Một quyết định đầu tư dòng tiền đầy sắc bén của Chủ tịch!").
`.trim(),
  },
  confidant: {
    id: 'confidant',
    name: 'Bạn thân tâm sự',
    badge: 'Tri kỷ',
    desc: 'Ấm áp, biết lắng nghe, chia sẻ chân thành như một người bạn tri kỷ.',
    sampleQuote: 'Đi làm vất vả rồi, ăn ngon chút cho ấm lòng nha bạn, tui ghi sổ giúp rồi nè.',
    icon: 'heart-outline',
    color: '#22C55E',
    promptInstruction: `
TÍNH CÁCH BẮT BUỘC: NGƯỜI BẠN TRI KỶ CHÂN THÀNH, ẤM ÁP VÀ BIẾT LẮNG NGHE!
- Xưng hô "mình - bạn" hoặc "tui - bạn" rất tự nhiên, ấm áp.
- Thấu cảm với những vất vả, lo toan cuộc sống của người dùng (VD: "Làm việc cả ngày mệt rồi, ăn bát bún đậu ngon cho lại sức nha bạn, tui đã ghi lại 55k vào ví MoMo giúp bạn rồi nè!").
- Luôn đưa ra lời khuyên tài chính chân tình, nhẹ nhàng và nâng đỡ tinh thần người dùng.
`.trim(),
  },
  minimalist: {
    id: 'minimalist',
    name: 'Thực tế, tối giản',
    badge: 'Tối giản',
    desc: 'Siêu ngắn gọn, trực diện, chỉ tập trung vào số liệu cốt lõi, không một lời thừa.',
    sampleQuote: 'Đã ghi 55.000 ₫ bún đậu vào ví MoMo.',
    icon: 'flash-outline',
    color: '#94A3B8',
    promptInstruction: `
TÍNH CÁCH BẮT BUỘC: SIÊU TỐI GIẢN, TRỰC DIỆN, NGẮN GỌN TUYỆT ĐỐI!
- Không mở đầu rườm rà, không chào hỏi dài dòng.
- Trả lời đúng 1 câu ngắn gọn, súc tích, đầy đủ số liệu chính xác (VD: "Đã ghi 55.000 ₫ bún đậu vào ví MoMo.", "Chi tiêu cafe tháng này: 480.000 ₫.").
`.trim(),
  },
  genz: {
    id: 'genz',
    name: 'Gen Z lầy lội',
    badge: 'Bắt trend',
    desc: 'Bắt trend hài hước, ngôn ngữ trẻ trung, coi tiền bạc vừa áp lực vừa tấu hài.',
    sampleQuote: 'Ét ô ét ví đang kêu cứu nhưng kèo bún đậu này 10 điểm không có nhưng, duyệt luôn 55k ví MoMo!',
    icon: 'flame-outline',
    color: '#EC4899',
    promptInstruction: `
TÍNH CÁCH BẮT BUỘC: GEN Z SIÊU HÀI HƯỚC, LẦY LỘI, BẮT TREND CỰC ĐỈNH!
- Dùng từ ngữ phong cách giới trẻ Gen Z tự nhiên (VD: "Ét ô ét", "cháy ví", "keo lì", "10 điểm không có nhưng", "hết nước chấm", "mê chữ ê kéo dài", "tới công chiện", "flex").
- Nói chuyện vui tính, xem tiền bạc vừa áp lực vừa tấu hài, tạo cảm giác như đứa bạn cùng phòng lầy lội.
- Khi người dùng chi tiêu ăn uống hay mua sắm: "Ăn cho đã cái nư đi rồi cày cuốc bù sau!", "Ví bảo ét ô ét nhưng con tim bảo xứng đáng!".
`.trim(),
  },
};

export const COPILOT_SETTING_KEYS = {
  IN_APP_MIC_ENABLED: 'copilot_in_app_mic_enabled',
  PERSONALITY: 'copilot_personality',
  TTS_ENABLED: 'copilot_tts_enabled',
};

export async function getInAppMicEnabled(db: SQLite.SQLiteDatabase): Promise<boolean> {
  const val = await queries.getAppSetting(db, COPILOT_SETTING_KEYS.IN_APP_MIC_ENABLED);
  return val === null ? true : val === '1' || val === 'true';
}

export async function setInAppMicEnabled(
  db: SQLite.SQLiteDatabase,
  enabled: boolean
): Promise<void> {
  await queries.setAppSetting(db, COPILOT_SETTING_KEYS.IN_APP_MIC_ENABLED, enabled ? '1' : '0');
}

export async function getCopilotTtsEnabled(db: SQLite.SQLiteDatabase): Promise<boolean> {
  const val = await queries.getAppSetting(db, COPILOT_SETTING_KEYS.TTS_ENABLED);
  return val === null ? true : val === '1' || val === 'true';
}

export async function setCopilotTtsEnabled(
  db: SQLite.SQLiteDatabase,
  enabled: boolean
): Promise<void> {
  await queries.setAppSetting(db, COPILOT_SETTING_KEYS.TTS_ENABLED, enabled ? '1' : '0');
}

export async function getCopilotPersonality(
  db: SQLite.SQLiteDatabase
): Promise<CopilotPersonalityId> {
  const val = await queries.getAppSetting(db, COPILOT_SETTING_KEYS.PERSONALITY);
  if (val && val in COPILOT_PERSONALITIES) {
    return val as CopilotPersonalityId;
  }
  return 'cheerful';
}

export async function setCopilotPersonality(
  db: SQLite.SQLiteDatabase,
  personality: CopilotPersonalityId
): Promise<void> {
  await queries.setAppSetting(db, COPILOT_SETTING_KEYS.PERSONALITY, personality);
}

/**
 * Làm sạch chuỗi markdown / emoji để phát âm tiếng Việt tự nhiên nhất
 */
export function cleanMarkdownForSpeech(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bỏ in đậm
    .replace(/\*(.*?)\*/g, '$1')     // Bỏ in nghiêng
    .replace(/`(.*?)`/g, '$1')       // Bỏ code
    .replace(/#{1,6}\s+/g, '')       // Bỏ tiêu đề
    .replace(/[•\-\*]\s+/g, '')      // Bỏ gạch đầu dòng
    .replace(/💬\s*["“](.*?)["”]/g, '$1')
    .replace(/₫/g, ' đồng')          // Thay ký hiệu tiền tệ ₫ thành chữ 'đồng' để engine TTS dễ phát âm
    .replace(/[✨🎉🎩💖⚡🔥🚨📋💎❤️☀️🇻🇳]/g, '') // Bỏ emoji
    .replace(/[\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Đọc câu trả lời của AI bằng giọng nói tiếng Việt theo tính cách
 */
export async function speakCopilotMessage(
  text: string,
  personalityId: CopilotPersonalityId = 'cheerful'
): Promise<void> {
  console.log('[Copilot TTS] 🎙️ speakCopilotMessage called. Text length:', text?.length);
  try {
    const cleanText = cleanMarkdownForSpeech(text);
    console.log('[Copilot TTS] 🧹 Cleaned text:', cleanText);
    if (!cleanText) {
      console.log('[Copilot TTS] ⚠️ Clean text is empty, nothing to speak.');
      return;
    }

    try {
      const isSpeaking = await Speech.isSpeakingAsync();
      console.log('[Copilot TTS] Is currently speaking?:', isSpeaking);
      if (isSpeaking) {
        console.log('[Copilot TTS] Stopping previous speech before new utterance...');
        await Speech.stop();
      }
    } catch (stopErr) {
      console.log('[Copilot TTS] Speech.stop error (non-fatal):', stopErr);
    }

    let pitch = 1.0;
    let rate = 1.0;
    if (personalityId === 'cheerful') {
      pitch = 1.08;
      rate = 1.02;
    } else if (personalityId === 'strict') {
      pitch = 0.95;
      rate = 1.05;
    } else if (personalityId === 'affluent') {
      pitch = 0.9;
      rate = 0.95;
    } else if (personalityId === 'confidant') {
      pitch = 1.0;
      rate = 0.95;
    } else if (personalityId === 'minimalist') {
      pitch = 1.0;
      rate = 1.1;
    } else if (personalityId === 'genz') {
      pitch = 1.12;
      rate = 1.08;
    }

    console.log('[Copilot TTS] 🔊 Executing Speech.speak with language: "vi" (ISO 639-1)...');

    Speech.speak(cleanText, {
      language: 'vi',
      pitch,
      rate,
      onStart: () => {
        console.log('[Copilot TTS] ▶️ onStart: Sound playback started successfully!');
      },
      onDone: () => {
        console.log('[Copilot TTS] ✅ onDone: Sound playback completed successfully!');
      },
      onStopped: () => {
        console.log('[Copilot TTS] ⏹️ onStopped: Speech playback was stopped.');
      },
      onError: (err: any) => {
        console.warn('[Copilot TTS] ❌ onError: Speech error occurred:', err);
      },
    });
  } catch (err) {
    console.warn('[Copilot TTS] ❌ Exception in speakCopilotMessage:', err);
  }
}

export function stopCopilotSpeech(): void {
  try {
    console.log('[Copilot TTS] stopCopilotSpeech requested');
    Speech.stop();
  } catch {}
}

/**
 * Trích xuất JSON an toàn từ phản hồi của LLM
 */
function cleanAndParseJSON(raw: string): any {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  const parsed = JSON.parse(cleaned);

  // Chuẩn hóa mảng transactions / transaction
  if (
    parsed.transactions &&
    Array.isArray(parsed.transactions) &&
    parsed.transactions.length === 1 &&
    !parsed.transaction
  ) {
    parsed.transaction = parsed.transactions[0];
  } else if (
    parsed.transaction &&
    (!parsed.transactions || parsed.transactions.length === 0)
  ) {
    parsed.transactions = [parsed.transaction];
  }

  // Chuẩn hóa items nếu LLM đặt ở root
  if (Array.isArray(parsed.items) && parsed.items.length > 0) {
    if (parsed.transaction && (!parsed.transaction.items || parsed.transaction.items.length === 0)) {
      parsed.transaction.items = parsed.items;
    }
    if (
      parsed.transactions &&
      parsed.transactions.length === 1 &&
      (!parsed.transactions[0].items || parsed.transactions[0].items.length === 0)
    ) {
      parsed.transactions[0].items = parsed.items;
    }
  }

  // Chuẩn hóa cấu trúc từng item trong items
  const normalizeItems = (items: any[]): ReceiptItem[] => {
    if (!Array.isArray(items)) return [];
    return items
      .filter(it => it && typeof it === 'object' && it.name)
      .map(it => ({
        name: String(it.name).trim(),
        quantity: typeof it.quantity === 'number' && it.quantity > 0 ? it.quantity : 1,
        price: typeof it.price === 'number' && it.price >= 0 ? it.price : 0,
      }));
  };

  if (parsed.transaction?.items) {
    parsed.transaction.items = normalizeItems(parsed.transaction.items);
  }
  if (Array.isArray(parsed.transactions)) {
    parsed.transactions.forEach((tx: any) => {
      if (tx?.items) {
        tx.items = normalizeItems(tx.items);
      }
    });
  }

  // Chuẩn hóa alias cho các intent phụ trợ
  if ((parsed as any).planned_transaction && !parsed.planned_expense) {
    parsed.planned_expense = (parsed as any).planned_transaction;
  }
  if (parsed.planned_expense) {
    if (!parsed.planned_expense.title && (parsed.planned_expense as any).name) {
      parsed.planned_expense.title = (parsed.planned_expense as any).name;
    }
    if (!parsed.planned_expense.target_date && (parsed.planned_expense as any).due_date) {
      parsed.planned_expense.target_date = (parsed.planned_expense as any).due_date;
    }
  }
  if ((parsed as any).balance_adjustment && !parsed.adjust_balance) {
    parsed.adjust_balance = (parsed as any).balance_adjustment;
  }

  // Lọc và loại bỏ các giao dịch không hợp lệ (amount <= 0 hoặc không có số tiền)
  if (parsed.transaction) {
    const amt = Number(parsed.transaction.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      delete parsed.transaction;
      if (parsed.intent === 'create_transaction') {
        parsed.intent = 'query';
      }
    } else {
      parsed.transaction.amount = amt;
    }
  }

  if (Array.isArray(parsed.transactions)) {
    parsed.transactions = parsed.transactions.filter((tx: any) => {
      const amt = Number(tx?.amount);
      if (Number.isFinite(amt) && amt > 0) {
        tx.amount = amt;
        return true;
      }
      return false;
    });
    if (parsed.transactions.length === 0) {
      delete parsed.transactions;
      if (parsed.intent === 'create_transactions') {
        parsed.intent = 'query';
      }
    }
  }

  // Đồng bộ lại transaction và transactions sau khi lọc
  if (
    parsed.transactions &&
    Array.isArray(parsed.transactions) &&
    parsed.transactions.length === 1 &&
    !parsed.transaction
  ) {
    parsed.transaction = parsed.transactions[0];
  } else if (
    parsed.transaction &&
    (!parsed.transactions || parsed.transactions.length === 0)
  ) {
    parsed.transactions = [parsed.transaction];
  }

  // Lọc các hành động tài chính khác nếu amount <= 0 hoặc thiếu thông tin cốt lõi
  if (parsed.transfer) {
    const amt = Number(parsed.transfer.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      delete parsed.transfer;
      if (parsed.intent === 'transfer_money') parsed.intent = 'query';
    } else {
      parsed.transfer.amount = amt;
    }
  }

  if (parsed.debt) {
    const amt = Number(parsed.debt.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      delete parsed.debt;
      if (parsed.intent === 'create_debt') parsed.intent = 'query';
    } else {
      parsed.debt.amount = amt;
    }
  }

  if (parsed.debt_settlement) {
    const amt = Number(parsed.debt_settlement.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      delete parsed.debt_settlement;
      if (parsed.intent === 'settle_debt') parsed.intent = 'query';
    } else {
      parsed.debt_settlement.amount = amt;
    }
  }

  if (parsed.planned_expense) {
    const amt = Number(parsed.planned_expense.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      delete parsed.planned_expense;
      if (parsed.intent === 'create_planned') parsed.intent = 'query';
    } else {
      parsed.planned_expense.amount = amt;
    }
  }

  if (parsed.delete_transaction && !parsed.delete_transaction.transaction_id) {
    delete parsed.delete_transaction;
    if (parsed.intent === 'delete_transaction') parsed.intent = 'query';
  }

  if (parsed.update_transaction && !parsed.update_transaction.transaction_id) {
    delete parsed.update_transaction;
    if (parsed.intent === 'update_transaction') parsed.intent = 'query';
  }

  return parsed;
}

/**
 * Thu thập ngữ cảnh tài chính tổng quát từ SQLite để cung cấp cho Copilot
 */
export async function buildFinancialContext(
  db: SQLite.SQLiteDatabase,
  wallets: Wallet[],
  categories: Category[],
  userPrompt?: string
): Promise<string> {
  const now = dayjs();
  const startOfMonth = now.startOf('month').toISOString();
  const endOfMonth = now.endOf('month').toISOString();

  // 1. Số dư ví
  const walletLines = wallets.map(
    w => `- Ví "${w.name}" (ID: ${w.id}, Loại: ${w.type}): ${Number(w.balance).toLocaleString('vi-VN')} ₫`
  );
  const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance), 0);

  // 2. Thống kê tháng này
  let monthlyInfo = '';
  try {
    const rangeData = await queries.getAnalyticsByRange(db, startOfMonth, endOfMonth);
    monthlyInfo = `
THỐNG KÊ THÁNG ${now.format('MM/YYYY')} ĐẾN HIỆN TẠI:
- Tổng thu nhập: ${rangeData.income.toLocaleString('vi-VN')} ₫
- Tổng chi tiêu: ${rangeData.expense.toLocaleString('vi-VN')} ₫
- Thặng dư/Tiết kiệm: ${rangeData.net.toLocaleString('vi-VN')} ₫
- Chi tiết chi tiêu theo danh mục tháng này:
${rangeData.categorySpendings
  .map(c => `  + ${c.category_name}: ${c.total_amount.toLocaleString('vi-VN')} ₫ (${c.percentage}%)`)
  .join('\n')}`;
  } catch {}

  // 3. Sổ nợ hiện tại
  let debtInfo = '';
  try {
    const debts = await queries.getDebts(db);
    const activeDebts = debts.filter(d => d.status === 'active' || d.remaining_amount > 0);
    if (activeDebts.length > 0) {
      debtInfo = `
SỔ NỢ ĐANG CÓ HIỆU LỰC:
${activeDebts
  .map(
    d =>
      `- [ID: "${d.id}"] ${d.type === 'lend' ? 'Cho vay' : 'Đi vay'}: ${d.person_name} | Số tiền còn lại: ${d.remaining_amount.toLocaleString('vi-VN')} ₫${d.note ? ` (Ghi chú: ${d.note})` : ''}`
  )
  .join('\n')}`;
    } else {
      debtInfo = '\nSỔ NỢ: Hiện không có khoản nợ hay cho vay nào chưa tất toán.';
    }
  } catch {}

  // 4. Nếu người dùng hỏi từ khóa cụ thể (VD: cafe, xăng, shopee, pizza, lẩu...), tìm kiếm thêm giao dịch liên quan
  let specificSearchResults = '';
  if (userPrompt) {
    const keywords = ['cafe', 'cà phê', 'xăng', 'shopee', 'grab', 'bún', 'phở', 'cơm', 'trà sữa', 'tiền nhà', 'tiền trọ'];
    const matched = keywords.filter(kw => userPrompt.toLowerCase().includes(kw));
    if (matched.length > 0) {
      try {
        const rows = await db.getAllAsync<{
          amount: number;
          note: string;
          transacted_at: string;
          category_name: string;
          wallet_name: string;
        }>(
          `SELECT t.amount, t.note, t.transacted_at, c.name as category_name, w.name as wallet_name
           FROM transactions t
           LEFT JOIN categories c ON t.category_id = c.id
           LEFT JOIN wallets w ON t.wallet_id = w.id
           WHERE t.transacted_at >= ? AND (${matched.map(() => "t.note LIKE ? OR c.name LIKE ?").join(' OR ')})
           ORDER BY t.transacted_at DESC LIMIT 15`,
          [
            startOfMonth,
            ...matched.flatMap(m => [`%${m}%`, `%${m}%`]),
          ]
        );
        if (rows.length > 0) {
          const totalSpent = rows.reduce((s, r) => s + r.amount, 0);
          specificSearchResults = `
KẾT QUẢ TÌM KIẾM LIÊN QUAN TRONG THÁNG CHO TỪ KHÓA [${matched.join(', ')}]:
- Tìm thấy ${rows.length} giao dịch, tổng cộng: ${totalSpent.toLocaleString('vi-VN')} ₫.
- Danh sách gần nhất:
${rows.slice(0, 8).map(r => `  + ${dayjs(r.transacted_at).format('DD/MM')}: ${r.amount.toLocaleString('vi-VN')} ₫ (${r.note || r.category_name}) [Ví: ${r.wallet_name}]`).join('\n')}`;
        }
      } catch {}
    }
  }

  // 5. Danh sách các giao dịch gần đây nhất (Để AI biết chính xác giao dịch nào cần SỬA hoặc XÓA khi người dùng yêu cầu)
  let recentTxInfo = '';
  try {
    const recentRows = await db.getAllAsync<{
      id: string;
      type: string;
      amount: number;
      note: string;
      transacted_at: string;
      wallet_id: string;
      wallet_name: string;
      category_id: string | null;
      category_name: string | null;
    }>(
      `SELECT t.id, t.type, t.amount, t.note, t.transacted_at, t.wallet_id, w.name as wallet_name, t.category_id, c.name as category_name
       FROM transactions t
       LEFT JOIN wallets w ON t.wallet_id = w.id
       LEFT JOIN categories c ON t.category_id = c.id
       ORDER BY t.transacted_at DESC, t.created_at DESC
       LIMIT 15`
    );
    if (recentRows.length > 0) {
      recentTxInfo = `
DANH SÁCH 15 GIAO DỊCH GẦN ĐÂY NHẤT TRONG HỆ THỐNG (Dùng để đối chiếu và lấy ID [ID: "..."] khi người dùng yêu cầu SỬA hoặc XÓA giao dịch):
${recentRows
  .map(
    r =>
      `- [ID: "${r.id}"] Loại: ${r.type} | Số tiền: ${r.amount.toLocaleString('vi-VN')} ₫ | Ghi chú: "${r.note || 'Không có'}" | Ví: "${r.wallet_name || 'Không rõ'}" (ID: "${r.wallet_id}") | Danh mục: "${r.category_name || 'Khác'}" (ID: "${r.category_id || ''}") | Lúc: ${dayjs(r.transacted_at).format('YYYY-MM-DD HH:mm:ss')} (${dayjs(r.transacted_at).format('HH:mm DD/MM/YYYY')})`
  )
  .join('\n')}`;
    }
  } catch {}

  return `
THÔNG TIN TÀI CHÍNH THỰC TẾ TRONG HỆ THỐNG:
- Thời gian hiện tại: ${now.format('dddd, DD/MM/YYYY HH:mm:ss')} (Giờ Việt Nam)
- TỔNG TÀI SẢN TẤT CẢ CÁC VÍ: ${totalBalance.toLocaleString('vi-VN')} ₫
DANH SÁCH VÍ:
${walletLines.join('\n')}

DANH SÁCH DANH MỤC THU/CHI CÓ TRÊN THIẾT BỊ:
${categories.map(c => `- ID: "${c.id}", Tên: "${c.name}", Loại: "${c.type}"`).join('\n')}
${monthlyInfo}
${debtInfo}
${recentTxInfo}
${specificSearchResults}
`.trim();
}

/**
 * Xử lý văn bản đầu vào: Phân loại Ghi chép giao dịch HOẶC Trả lời câu hỏi tài chính
 */
/**
 * Xây dựng chỉ dẫn hệ thống toàn diện cho Copilot (dùng chung cho cả Text, Voice, và Image Multimodal)
 */
function buildCopilotSystemInstruction(
  context: string,
  personality: CopilotPersonality
): string {
  return `
Bạn là "Trợ lý Tài chính AI" (Financial Copilot) của ứng dụng MultiWallet.
HÃY TUÂN THỦ TÍNH CÁCH VÀ VĂN PHONG DƯỚI ĐÂY KHI TRÒ CHUYỆN:
${personality.promptInstruction}

${context}

QUY TẮC PHÂN LOẠI Ý ĐỊNH (INTENT):
1. INTENT "create_transaction": Ghi nhận 1 KHOẢN DUY NHẤT chi tiêu hoặc thu nhập.
   - Ví dụ: "Ăn bún đậu 55k ví momo", "Đổ xăng 70k tiền mặt", "Nhận lương 20tr techcombank trưa nay", "cf 35k mb".
   - Bóc tách: amount, type ("expense" | "income"), wallet_id, wallet_name, category_id, category_name, note, transacted_at.

2. INTENT "create_transactions": Khi người dùng ghi NHIỀU KHOẢN chi tiêu/thu nhập cùng lúc trong một câu, hoặc gửi ảnh hóa đơn/biên lai có nhiều món.
   - Ví dụ: "Sáng ăn phở 45k tiền mặt, đổ xăng 60k MoMo, mua trà sữa 35k", "Hôm nay: cafe 30k, trưa 50k, tối 70k ví MB".
   - Bóc tách thành mảng "transactions" chứa từng khoản riêng biệt với đầy đủ { type, amount, wallet_id, wallet_name, category_id, category_name, note, transacted_at }.

3. INTENT "transfer_money": Chuyển tiền liên ví giữa các ví của người dùng.
   - Ví dụ: "Chuyển 500k từ Techcombank sang MoMo", "Rút 2 triệu từ BIDV về tiền mặt", "Nạp 200k vào MoMo từ Vietcombank".
   - Bóc tách "transfer": { from_wallet_id, from_wallet_name, to_wallet_id, to_wallet_name, amount, note, transacted_at }.

4. INTENT "settle_debt": Trả nợ hoặc Thu nợ cũ từ danh sách "SỔ NỢ ĐANG CÓ HIỆU LỰC".
   - Ví dụ: "Tuấn vừa trả tui 200k nợ vào ví MoMo", "Vừa trả anh Hùng 500k tiền mặt nợ tuần trước".
   - Khớp person_name với các khoản trong SỔ NỢ ĐANG CÓ HIỆU LỰC để lấy debt_id.
   - Bóc tách "debt_settlement": { debt_id, person_name, amount, type: "receive" (khi người khác trả mình) | "pay" (khi mình trả người khác), wallet_id, wallet_name, note }.

5. INTENT "create_debt": Khi người dùng tạo một khoản vay nợ mới (cho vay hoặc đi vay).
   - Ví dụ: "Cho Nam vay 200k từ ví momo", "Vay anh Hùng 1 triệu ví techcom".
   - Bóc tách "debt": { person_name, amount, type: "lend" (cho vay) | "borrow" (đi vay), wallet_id, wallet_name, due_date, note }.

6. INTENT "create_planned": Lên lịch kế hoạch dự chi tương lai.
   - Ví dụ: "Nhắc tui ngày 5 tháng sau đóng tiền nhà 4.5tr", "Dự kiến 20/10 mua quà 500k ví zalopay".
   - Bóc tách "planned_expense": { title, amount, category_id, category_name, wallet_id, wallet_name, target_date, note }.

7. INTENT "adjust_balance": Điều chỉnh/khớp lại số dư thực tế của một ví.
   - Ví dụ: "Ví Tiền mặt chỉ còn 200k thôi", "Chỉnh lại ví MoMo thành 1 triệu", "Số dư ví Techcombank thực tế là 5.500.000đ".
   - Bóc tách "adjust_balance": { wallet_id, wallet_name, current_balance, new_balance, diff, note }.

8. INTENT "create_transactions": Khi người dùng ghi nhận NHIỀU khoản thu/chi khác nhau trong 1 câu nói hoặc hình ảnh.
   - Ví dụ: "Sáng ăn phở 40k ví tiền mặt, trưa uống trà sữa 35k momo, tối mua sắm 200k".
   - Bóc tách mảng "transactions": [ { type, amount, note, wallet_id, wallet_name, category_id, category_name, transacted_at, items } ].

9. INTENT "delete_transaction": Xóa / hủy bỏ một giao dịch đã tạo trước đó.
   - Ví dụ: "Xóa giao dịch cafe vừa tạo", "Xóa khoản chi 20k vừa rồi", "Hủy giao dịch đổ xăng trưa nay", "Xóa giao dịch bò cụng".
   - BẮT BUỘC tra cứu trong DANH SÁCH 15 GIAO DỊCH GẦN ĐÂY NHẤT để tìm ra ID chính xác (tx_...).
   - Bóc tách "delete_transaction": { transaction_id, amount, note, wallet_id, wallet_name, transacted_at }.

10. INTENT "update_transaction": Sửa thông tin (số tiền, ghi chú, đổi ví, đổi danh mục) của một giao dịch gần đây.
   - Ví dụ: "Sửa giao dịch vừa rồi thành 35k", "Đổi ví giao dịch bún bò sang ví MoMo", "Sửa ghi chú giao dịch gần nhất thành Cà phê muối", "Đổi danh mục giao dịch cafe thành Giải trí".
   - BẮT BUỘC tra cứu trong DANH SÁCH 15 GIAO DỊCH GẦN ĐÂY NHẤT để tìm ID giao dịch cần sửa (tx_...).
   - Bóc tách "update_transaction": { transaction_id, old_amount, new_amount, old_wallet_id, new_wallet_id, new_wallet_name, old_category_id, new_category_id, new_category_name, old_note, new_note, new_transacted_at }.

QUY TẮC NHẬN DIỆN HÌNH ẢNH & ĐA PHƯƠNG THỨC (MULTIMODAL - ẢNH / GIỌNG NÓI / CHỮ):
11. HÌNH ẢNH CÓ THỂ LÀ HÓA ĐƠN HOẶC ĐỒ VẬT / SẢN PHẨM / ĐỒ ĂN / THỨC UỐNG MUA SẮM TIÊU DÙNG:
   - Trường hợp A - Hóa đơn / Biên lai / Bill thanh toán / Phiếu thu / Vé / Màn hình chuyển khoản:
     + Bóc tách số tiền tổng thực tế thanh toán (amount), thời gian (transacted_at), phân loại danh mục (category_id, category_name) và tạo giao dịch ("create_transaction").
     + BÓC TÁCH CHI TIẾT TỪNG MÓN (ITEMS) TRONG HÓA ĐƠN VÀO TRƯỜNG "items":
       Mỗi món gồm { "name": string (tên món hàng/món ăn), "quantity": number (số lượng, mặc định 1), "price": number (đơn giá hoặc thành tiền bằng VND, nếu không có để 0) }.
       Ví dụ: "items": [
         { "name": "Cà phê sữa đá", "quantity": 2, "price": 30000 },
         { "name": "Bánh mì que", "quantity": 1, "price": 15000 }
       ]
     + Ghi chú (note): Tên cửa hàng/thương hiệu + tóm tắt món (ví dụ: "Highlands Coffee - 2 Cà phê, 1 Bánh mì").
   - Trường hợp B - Đồ vật / Sản phẩm / Đồ ăn / Thức uống (ví dụ: lon nước tăng lực Red Bull / bò cụng, ly cà phê, tô phở, hộp bánh, hoặc chụp mâm cơm / bàn ăn / giỏ hàng có NHIỀU món):
     + Nhận diện chính xác TẤT CẢ các món đồ/sản phẩm có trong ảnh kèm số lượng từng món (ví dụ: 1 tô phở bò, 1 đĩa quẩy, 1 ly trà đá; hoặc 2 lon bò cụng, 1 gói snack khoai tây).
     + Tự động ghép vào danh mục chi tiêu phù hợp nhất trong danh sách danh mục (ví dụ: Ăn uống, Cà phê & Đồ uống, Mua sắm...).
     + NẾU câu lệnh (chữ hoặc giọng nói) ĐÃ KÈM THEO số tiền hoặc ví (ví dụ: gửi ảnh mâm ăn kèm câu "hết 65k tiền mặt", gửi ảnh lon bò cụng "20k momo"):
       -> Tạo ngay giao dịch chi tiêu ("create_transaction"):
          * amount: số tiền người dùng cung cấp (ví dụ: 65000)
          * type: "expense"
          * note: tên tóm tắt các món nhận diện được từ ảnh (ví dụ: "Phở bò, quẩy, trà đá" hoặc "2 Lon bò cụng (Red Bull)")
          * wallet_id & wallet_name: ví người dùng chỉ định (nếu không chỉ định, lấy ví đầu tiên)
          * category_id & category_name: danh mục phù hợp (ví dụ: Ăn uống)
          * items: BẮT BUỘC bóc tách đầy đủ danh sách TẤT CẢ các món nhận diện được trong ảnh kèm số lượng (ví dụ: [{ "name": "Tô phở bò", "quantity": 1, "price": 50000 }, { "name": "Đĩa quẩy", "quantity": 1, "price": 10000 }, { "name": "Ly trà đá", "quantity": 1, "price": 5000 }]). Nếu chỉ có số tiền tổng, hãy phân bổ giá hợp lý cho từng món để tổng bằng amount.
     + NẾU người dùng chỉ gửi ảnh mà CHƯA CÓ số tiền (kể cả không thể suy luận từ ngữ cảnh trò chuyện trước đó):
       -> Nhận diện rõ danh sách từng món đồ, intent = "query", phản hồi bằng giọng điệu vui vẻ, tự nhiên liệt kê các món nhìn thấy trong ảnh và hỏi người dùng số tiền và ví đã chi để ghi chép (ví dụ: "Mình thấy trong ảnh có 1 hộp bánh cuốn chả lụa chả quế nè! 🤤 Bữa này bạn ăn hết bao nhiêu và chi từ ví nào để mình ghi lại nhé?").
       -> TUYỆT ĐỐI CẤM: KHÔNG TRẢ VỀ object "transaction" hoặc "transactions" có amount = 0! Khi chưa biết số tiền, tuyệt đối không tạo giao dịch 0đ, chỉ dùng intent = "query" và hỏi trong message.

12. QUY TẮC KẾ THỪA NGỮ CẢNH ĐA LƯỢT VÀ QUY CHIẾU ĐẠI TỪ (MULTI-TURN MEMORY & CO-REFERENCE RESOLUTION):
   - KẾ THỪA MÓN ĐỒ / HÓA ĐƠN TRƯỚC ĐÓ:
     Khi người dùng gửi tin nhắn bổ sung thông tin (bằng chữ hoặc giọng nói, ví dụ: "20k tiền mặt", "hết 65k ví momo nhé"):
     BẮT BUỘC phải xâu chuỗi với hình ảnh hoặc nội dung đồ vật ở các lượt trò chuyện gần nhất trong lịch sử hội thoại (chatHistory)!
     Kế thừa toàn bộ danh sách món đồ đã nhận diện ở lượt trước để điền vào trường "note" và mảng "items" của giao dịch mới (Ví dụ: Lượt trước người dùng gửi ảnh lon bò cụng; Lượt này nhắn hoặc nói "20k tiền mặt" -> Tạo ngay giao dịch 20.000đ từ ví Tiền mặt cho "Lon bò cụng (Red Bull)" thuộc danh mục "Ăn uống" và items: [{ "name": "Lon bò cụng (Red Bull)", "quantity": 1, "price": 20000 }]. TUYỆT ĐỐI không quên món đồ ở lượt trước!).
   - QUY CHIẾU ĐẠI TỪ CHỈ ĐỊNH VỀ TIỀN & VÍ ("tiền đó", "số tiền đó", "tiền này", "khoản đó", "khoản vừa nạp", "ví đó", "ví vừa nạp", "bằng ví nãy"):
     Khi người dùng nói các câu mang tính quy chiếu như:
     * "Tôi mới dùng tiền đó ăn bánh cuốn nè"
     * "Vừa lấy tiền đó mua cafe rồi"
     * "Dùng khoản đó trả nợ cho Nam"
     * "Lấy tiền vừa nạp đi đổ xăng"
     BẮT BUỘC phải tra ngược các tin nhắn gần nhất trong chatHistory (hoặc danh sách giao dịch gần nhất vừa được nhắc tới):
     1. Tìm số tiền của giao dịch/khoản tiền vừa được nhắc tới (Ví dụ: tin nhắn trước Copilot vừa thông báo "vụ nạp 33.840 đ vào MoMo" -> "tiền đó" chính là 33.840 đ).
     2. Tìm ví nguồn/ví chi: Nếu giao dịch trước đó là nạp tiền/nhận tiền vào một ví (như MoMo), thì khi người dùng nói "dùng tiền đó...", ví chi tiền chính là ví đó (MoMo).
     3. Tạo ngay giao dịch chi tiêu tương ứng với: amount = 33840, wallet_name = "MoMo", note = "Bánh cuốn (chả lụa, chả quế, nem chua)", category_name = "Ăn uống". TUYỆT ĐỐI KHÔNG hỏi lại số tiền và ví khi ngữ cảnh đã nói rõ!

13. QUY TẮC PHÁT NGÔN KHI TRẢ VỀ CÁC HÀNH ĐỘNG CẦN XÁC NHẬN (CONFIRMATION CARDS):
   - Khi intent là tạo, sửa, xóa, chuyển tiền hoặc điều chỉnh số dư:
     Nội dung trường "message" CHỈ THÔNG BÁO là bạn ĐÃ TÌM THẤY hoặc ĐÃ LÊN THÔNG TIN và mời người dùng bấm nút xác nhận ở thẻ bên dưới!
   - TUYỆT ĐỐI KHÔNG khẳng định là "Đã xóa xong rồi", "Đã lưu thành công", "Đã bay màu" trước khi người dùng thực sự bấm nút xác nhận trên thẻ.
   - Ví dụ chuẩn khi xóa: "Mình đã tìm thấy khoản chi mua chuột máy tính 100.000 đ ở ví Tiền mặt rồi nè. Bạn xác nhận xóa ở thẻ bên dưới nhé! 🧹"
   - Ví dụ chuẩn khi tạo/sửa: "Mình đã chuẩn bị sẵn phiếu giao dịch bên dưới, bạn kiểm tra rồi bấm xác nhận nhé!"

ĐỊNH DẠNG TRẢ VỀ (BẮT BUỘC LÀ JSON NGUYÊN BẢN, KHÔNG BỌC VĂN BẢN NGOÀI):
{
  "transcript": "Câu nói được phiên âm tiếng Việt của người dùng (khi có âm thanh)",
  "intent": "create_transaction" | "create_transactions" | "transfer_money" | "settle_debt" | "create_debt" | "create_planned" | "adjust_balance" | "delete_transaction" | "update_transaction" | "query" | "unknown",
  "message": "Lời nhắn hoặc câu trả lời bằng tiếng Việt (BẮT BUỘC thể hiện đậm nét tính cách [${personality.name}])",
  "transaction": {
    "type": "expense" | "income",
    "amount": 55000,
    "wallet_id": "...",
    "wallet_name": "...",
    "category_id": "...",
    "category_name": "...",
    "note": "...",
    "transacted_at": "...",
    "items": [
      {
        "name": "Tên món hàng/món ăn",
        "quantity": 1,
        "price": 55000
      }
    ]
  },
  "transactions": [
    {
      "type": "expense" | "income",
      "amount": 45000,
      "wallet_id": "...",
      "wallet_name": "...",
      "category_id": "...",
      "category_name": "...",
      "note": "...",
      "transacted_at": "...",
      "items": []
    }
  ],
  "transfer": {
    "from_wallet_id": "...",
    "from_wallet_name": "...",
    "to_wallet_id": "...",
    "to_wallet_name": "...",
    "amount": 500000,
    "note": "...",
    "transacted_at": "..."
  },
  "debt_settlement": {
    "debt_id": "...",
    "person_name": "...",
    "amount": 200000,
    "type": "receive" | "pay",
    "wallet_id": "...",
    "wallet_name": "...",
    "note": "..."
  },
  "debt": {
    "type": "lend" | "borrow",
    "person_name": "...",
    "amount": 200000,
    "wallet_id": "...",
    "wallet_name": "...",
    "due_date": "...",
    "note": "..."
  },
  "planned_expense": {
    "title": "...",
    "amount": 4500000,
    "target_date": "YYYY-MM-DD",
    "wallet_id": "...",
    "wallet_name": "...",
    "category_id": "...",
    "category_name": "...",
    "note": "..."
  },
  "adjust_balance": {
    "wallet_id": "...",
    "wallet_name": "...",
    "current_balance": 500000,
    "new_balance": 200000,
    "diff": -300000,
    "note": "Cân đối số dư ví"
  },
  "delete_transaction": {
    "transaction_id": "tx_...",
    "amount": 20000,
    "note": "Lon bò cụng (Red Bull)",
    "wallet_id": "...",
    "wallet_name": "...",
    "transacted_at": "..."
  },
  "update_transaction": {
    "transaction_id": "tx_...",
    "old_amount": 20000,
    "new_amount": 35000,
    "old_wallet_id": "...",
    "new_wallet_id": "...",
    "new_wallet_name": "...",
    "old_category_id": "...",
    "new_category_id": "...",
    "new_category_name": "...",
    "old_note": "Lon bò cụng",
    "new_note": "Lon bò cụng + bánh",
    "new_transacted_at": "..."
  }
}
`.trim();
}

/**
 * Xử lý văn bản hoặc hình ảnh đầu vào: Phân loại Ghi chép giao dịch HOẶC Trả lời câu hỏi tài chính
 */
export async function processCopilotTextInput(
  db: SQLite.SQLiteDatabase,
  userInput: string,
  wallets: Wallet[],
  categories: Category[],
  chatHistory: { role: 'user' | 'model'; text: string }[] = [],
  imageUri?: string | string[]
): Promise<CopilotResponse> {
  const apiKey = await getGeminiApiKey(db);
  if (!apiKey) {
    throw new Error('Chưa cấu hình Gemini API Key. Vui lòng vào Cài đặt để thêm API Key.');
  }

  const preferredModel = await getPreferredGeminiModel(db);
  const models = await getModelFallbackList(db, apiKey, preferredModel);
  const context = await buildFinancialContext(db, wallets, categories, userInput);
  const personalityId = await getCopilotPersonality(db);
  const personality = COPILOT_PERSONALITIES[personalityId] || COPILOT_PERSONALITIES.cheerful;
  const systemInstruction = buildCopilotSystemInstruction(context, personality);

  const conversationContents: any[] = [];
  // Thêm tối đa 6 lượt hội thoại gần nhất để giữ ngữ cảnh đa lượt
  for (const msg of chatHistory.slice(-6)) {
    conversationContents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    });
  }

  const userParts: any[] = [];
  const uriList: string[] = [];
  if (Array.isArray(imageUri)) {
    uriList.push(...imageUri.filter(Boolean));
  } else if (imageUri) {
    uriList.push(imageUri);
  }

  for (const uri of uriList) {
    try {
      const base64Data = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const lower = uri.toLowerCase();
      let mimeType = 'image/jpeg';
      if (lower.endsWith('.png')) mimeType = 'image/png';
      else if (lower.endsWith('.webp')) mimeType = 'image/webp';
      else if (lower.endsWith('.heic')) mimeType = 'image/heic';

      userParts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data,
        },
      });
    } catch (imgErr) {
      console.warn('Failed to read image for Copilot:', imgErr);
    }
  }

  userParts.push({
    text:
      userInput.trim() ||
      'Hãy phân tích hình ảnh này: Có thể là đồ vật/sản phẩm đã mua, thức uống, món ăn, hoặc hóa đơn/biên lai/chuyển khoản.',
  });

  conversationContents.push({
    role: 'user',
    parts: userParts,
  });

  const payload = {
    contents: conversationContents,
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  let lastError: any = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        lastError = data?.error?.message || response.statusText;
        continue;
      }

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = cleanAndParseJSON(rawText);

      // Điền thêm icon & màu danh mục cho transaction đơn lẻ
      if (parsed.transaction && parsed.transaction.category_id) {
        const cat = categories.find(c => c.id === parsed.transaction.category_id);
        if (cat) {
          parsed.transaction.category_icon = cat.icon;
          parsed.transaction.category_color = cat.color;
        }
      }

      // Điền thêm icon & màu danh mục cho mảng transactions
      if (Array.isArray(parsed.transactions)) {
        parsed.transactions.forEach((tx: CopilotParsedTransaction) => {
          if (tx.category_id) {
            const cat = categories.find(c => c.id === tx.category_id);
            if (cat) {
              tx.category_icon = cat.icon;
              tx.category_color = cat.color;
            }
          }
          if (!tx.wallet_name && tx.wallet_id) {
            const w = wallets.find(w => w.id === tx.wallet_id);
            if (w) tx.wallet_name = w.name;
          }
        });
      }

      // Điền wallet names cho transfer nếu thiếu
      if (parsed.transfer) {
        if (!parsed.transfer.from_wallet_name && parsed.transfer.from_wallet_id) {
          const w = wallets.find(w => w.id === parsed.transfer.from_wallet_id);
          if (w) parsed.transfer.from_wallet_name = w.name;
        }
        if (!parsed.transfer.to_wallet_name && parsed.transfer.to_wallet_id) {
          const w = wallets.find(w => w.id === parsed.transfer.to_wallet_id);
          if (w) parsed.transfer.to_wallet_name = w.name;
        }
      }

      // Điền category cho planned_expense
      if (parsed.planned_expense) {
        if (parsed.planned_expense.category_id && !parsed.planned_expense.category_name) {
          const cat = categories.find(c => c.id === parsed.planned_expense.category_id);
          if (cat) parsed.planned_expense.category_name = cat.name;
        }
        if (parsed.planned_expense.wallet_id && !parsed.planned_expense.wallet_name) {
          const w = wallets.find(w => w.id === parsed.planned_expense.wallet_id);
          if (w) parsed.planned_expense.wallet_name = w.name;
        }
      }

      // Điền wallet_name cho adjust_balance
      if (parsed.adjust_balance) {
        if (!parsed.adjust_balance.wallet_name && parsed.adjust_balance.wallet_id) {
          const w = wallets.find(w => w.id === parsed.adjust_balance.wallet_id);
          if (w) parsed.adjust_balance.wallet_name = w.name;
        } else if (parsed.adjust_balance.wallet_name && !parsed.adjust_balance.wallet_id) {
          const w = wallets.find(w =>
            w.name.toLowerCase().includes(parsed.adjust_balance.wallet_name.toLowerCase())
          );
          if (w) {
            parsed.adjust_balance.wallet_id = w.id;
            parsed.adjust_balance.wallet_name = w.name;
          }
        }
      }

      // Điền names cho update_transaction
      if (parsed.update_transaction) {
        if (parsed.update_transaction.new_wallet_id && !parsed.update_transaction.new_wallet_name) {
          const w = wallets.find(w => w.id === parsed.update_transaction.new_wallet_id);
          if (w) parsed.update_transaction.new_wallet_name = w.name;
        }
        if (parsed.update_transaction.new_category_id && !parsed.update_transaction.new_category_name) {
          const c = categories.find(c => c.id === parsed.update_transaction.new_category_id);
          if (c) parsed.update_transaction.new_category_name = c.name;
        }
      }

      return {
        intent: parsed.intent || 'unknown',
        message: parsed.message || 'Đã phân tích yêu cầu của bạn.',
        transaction: parsed.transaction,
        transactions: parsed.transactions,
        transfer: parsed.transfer,
        debt: parsed.debt,
        debt_settlement: parsed.debt_settlement,
        planned_expense: parsed.planned_expense,
        adjust_balance: parsed.adjust_balance,
        delete_transaction: parsed.delete_transaction,
        update_transaction: parsed.update_transaction,
      };
    } catch (err: any) {
      lastError = err;
      if (isNetworkError(err)) {
        throw new Error(formatGeminiErrorMessage(err));
      }
    }
  }

  throw new Error(lastError ? formatGeminiErrorMessage(lastError) : 'Không thể kết nối đến Trợ lý AI.');
}

/**
 * Xử lý âm thanh trực tiếp (Multimodal Audio) hoặc kết hợp CẢ ÂM THANH VÀ HÌNH ẢNH qua Gemini 2.0 Flash
 */
export async function processCopilotAudioInput(
  db: SQLite.SQLiteDatabase,
  base64Audio: string,
  mimeType: string,
  wallets: Wallet[],
  categories: Category[],
  chatHistory: { role: 'user' | 'model'; text: string }[] = [],
  imageUri?: string | string[]
): Promise<CopilotResponse> {
  const apiKey = await getGeminiApiKey(db);
  if (!apiKey) {
    throw new Error('Chưa cấu hình Gemini API Key. Vui lòng vào Cài đặt để thêm API Key.');
  }

  // Ưu tiên Gemini 2.0 Flash vì tối ưu Audio & Vision Multimodal
  const preferredModel = await getPreferredGeminiModel(db);
  const chosenModel = preferredModel?.includes('flash') ? preferredModel : 'gemini-2.0-flash';
  const models = await getModelFallbackList(db, apiKey, chosenModel);
  const context = await buildFinancialContext(db, wallets, categories);
  const personalityId = await getCopilotPersonality(db);
  const personality = COPILOT_PERSONALITIES[personalityId] || COPILOT_PERSONALITIES.cheerful;
  const systemInstruction = buildCopilotSystemInstruction(context, personality);

  const conversationContents: any[] = [];
  // Thêm tối đa 6 lượt hội thoại gần nhất để giữ ngữ cảnh đa lượt
  for (const msg of chatHistory.slice(-6)) {
    conversationContents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    });
  }

  const userParts: any[] = [];

  // 1. Đính kèm đoạn âm thanh giọng nói (Multimodal Audio)
  userParts.push({
    inline_data: {
      mime_type: mimeType || 'audio/m4a',
      data: base64Audio,
    },
  });

  // 2. Đính kèm hình ảnh (nếu người dùng VỪA CHỌN ẢNH VỪA GHI ÂM)
  const uriList: string[] = [];
  if (Array.isArray(imageUri)) {
    uriList.push(...imageUri.filter(Boolean));
  } else if (imageUri) {
    uriList.push(imageUri);
  }

  for (const uri of uriList) {
    try {
      const base64Data = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const lower = uri.toLowerCase();
      let imgMime = 'image/jpeg';
      if (lower.endsWith('.png')) imgMime = 'image/png';
      else if (lower.endsWith('.webp')) imgMime = 'image/webp';
      else if (lower.endsWith('.heic')) imgMime = 'image/heic';

      userParts.push({
        inline_data: {
          mime_type: imgMime,
          data: base64Data,
        },
      });
    } catch (imgErr) {
      console.warn('Failed to read image for Copilot Audio Input:', imgErr);
    }
  }

  // 3. Câu lệnh chỉ dẫn cho Gemini khi nghe giọng nói (kèm ảnh nếu có)
  const instructionPrompt = `
Hãy nghe đoạn âm thanh tiếng Việt này và phân tích kèm theo bất kỳ hình ảnh đính kèm nào (nếu có):
1. Phiên âm chính xác nội dung câu nói của người dùng thành trường "transcript".
2. Phân loại ý định (intent) và xử lý giao dịch tài chính:
   - Nếu có hình ảnh đính kèm: Nhận diện đồ vật, món ăn, thức uống, sản phẩm tiêu dùng hoặc bóc tách hóa đơn/biên lai. Kết hợp nội dung câu nói và hình ảnh để tạo giao dịch chi tiêu/thu nhập tương ứng (ví dụ: người dùng nói "20k tiền mặt" và kèm ảnh lon bò cụng -> note: "Lon bò cụng (Red Bull)", amount: 20000, wallet: Tiền mặt, category: Ăn uống).
   - Nếu người dùng đang nói để bổ sung thông tin cho các lượt trò chuyện hoặc hình ảnh trước đó trong lịch sử trò chuyện (chatHistory), hãy kế thừa thông tin đồ vật/hóa đơn trước đó để tạo giao dịch hoàn chỉnh.
3. Xuất kết quả theo định dạng JSON quy định trong systemInstruction.
`.trim();

  userParts.push({
    text: instructionPrompt,
  });

  conversationContents.push({
    role: 'user',
    parts: userParts,
  });

  const payload = {
    contents: conversationContents,
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  let lastError: any = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        lastError = data?.error?.message || response.statusText;
        continue;
      }

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = cleanAndParseJSON(rawText);

      // Điền thêm icon & màu danh mục cho transaction đơn lẻ
      if (parsed.transaction && parsed.transaction.category_id) {
        const cat = categories.find(c => c.id === parsed.transaction.category_id);
        if (cat) {
          parsed.transaction.category_icon = cat.icon;
          parsed.transaction.category_color = cat.color;
        }
      }

      // Điền thêm icon & màu danh mục cho mảng transactions
      if (Array.isArray(parsed.transactions)) {
        parsed.transactions.forEach((tx: CopilotParsedTransaction) => {
          if (tx.category_id) {
            const cat = categories.find(c => c.id === tx.category_id);
            if (cat) {
              tx.category_icon = cat.icon;
              tx.category_color = cat.color;
            }
          }
          if (!tx.wallet_name && tx.wallet_id) {
            const w = wallets.find(w => w.id === tx.wallet_id);
            if (w) tx.wallet_name = w.name;
          }
        });
      }

      // Điền wallet names cho transfer nếu thiếu
      if (parsed.transfer) {
        if (!parsed.transfer.from_wallet_name && parsed.transfer.from_wallet_id) {
          const w = wallets.find(w => w.id === parsed.transfer.from_wallet_id);
          if (w) parsed.transfer.from_wallet_name = w.name;
        }
        if (!parsed.transfer.to_wallet_name && parsed.transfer.to_wallet_id) {
          const w = wallets.find(w => w.id === parsed.transfer.to_wallet_id);
          if (w) parsed.transfer.to_wallet_name = w.name;
        }
      }

      // Điền wallet_name cho adjust_balance
      if (parsed.adjust_balance) {
        if (!parsed.adjust_balance.wallet_name && parsed.adjust_balance.wallet_id) {
          const w = wallets.find(w => w.id === parsed.adjust_balance.wallet_id);
          if (w) parsed.adjust_balance.wallet_name = w.name;
        } else if (parsed.adjust_balance.wallet_name && !parsed.adjust_balance.wallet_id) {
          const w = wallets.find(w =>
            w.name.toLowerCase().includes(parsed.adjust_balance.wallet_name.toLowerCase())
          );
          if (w) {
            parsed.adjust_balance.wallet_id = w.id;
            parsed.adjust_balance.wallet_name = w.name;
          }
        }
      }

      // Điền names cho update_transaction
      if (parsed.update_transaction) {
        if (parsed.update_transaction.new_wallet_id && !parsed.update_transaction.new_wallet_name) {
          const w = wallets.find(w => w.id === parsed.update_transaction.new_wallet_id);
          if (w) parsed.update_transaction.new_wallet_name = w.name;
        }
        if (parsed.update_transaction.new_category_id && !parsed.update_transaction.new_category_name) {
          const c = categories.find(c => c.id === parsed.update_transaction.new_category_id);
          if (c) parsed.update_transaction.new_category_name = c.name;
        }
      }

      return {
        intent: parsed.intent || 'unknown',
        transcript: parsed.transcript || '',
        message:
          parsed.message ||
          (parsed.transcript
            ? `Đã nghe: "${parsed.transcript}"`
            : 'Đã phân tích âm thanh thành công.'),
        transaction: parsed.transaction,
        transactions: parsed.transactions,
        transfer: parsed.transfer,
        debt: parsed.debt,
        debt_settlement: parsed.debt_settlement,
        planned_expense: parsed.planned_expense,
        adjust_balance: parsed.adjust_balance,
        delete_transaction: parsed.delete_transaction,
        update_transaction: parsed.update_transaction,
      };
    } catch (err: any) {
      lastError = err;
      if (isNetworkError(err)) {
        throw new Error(formatGeminiErrorMessage(err));
      }
    }
  }

  throw new Error(lastError ? formatGeminiErrorMessage(lastError) : 'Không thể phân tích âm thanh giọng nói.');
}
