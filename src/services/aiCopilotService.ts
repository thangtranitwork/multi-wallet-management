import * as SQLite from 'expo-sqlite';
import dayjs from 'dayjs';
import { Category, Wallet } from '../types';
import {
  getGeminiApiKey,
  getPreferredGeminiModel,
  getModelFallbackList,
  formatGeminiErrorMessage,
  isNetworkError,
} from './geminiService';
import * as queries from '../database/queries';

export type CopilotIntent = 'create_transaction' | 'create_debt' | 'query' | 'unknown';

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
  debt?: CopilotParsedDebt;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
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
 * Trích xuất JSON an toàn từ phản hồi của LLM
 */
function cleanAndParseJSON(raw: string): any {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned);
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
      `- ${d.type === 'lend' ? 'Cho vay' : 'Đi vay'}: ${d.person_name} | Số tiền còn lại: ${d.remaining_amount.toLocaleString('vi-VN')} ₫${d.note ? ` (Ghi chú: ${d.note})` : ''}`
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
${specificSearchResults}
`.trim();
}

/**
 * Xử lý văn bản đầu vào: Phân loại Ghi chép giao dịch HOẶC Trả lời câu hỏi tài chính
 */
export async function processCopilotTextInput(
  db: SQLite.SQLiteDatabase,
  userInput: string,
  wallets: Wallet[],
  categories: Category[],
  chatHistory: { role: 'user' | 'model'; text: string }[] = []
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

  const systemInstruction = `
Bạn là "Trợ lý Tài chính AI" (Financial Copilot) của ứng dụng MultiWallet.
HÃY TUÂN THỦ TÍNH CÁCH VÀ VĂN PHONG DƯỚI ĐÂY KHI TRÒ CHUYỆN:
${personality.promptInstruction}

${context}

QUY TẮC PHÂN LOẠI Ý ĐỊNH (INTENT):
1. INTENT "create_transaction": Khi người dùng muốn ghi nhận một khoản chi tiêu hoặc thu nhập.
   Ví dụ: "Ăn bún đậu 55k ví momo", "Đổ xăng 70k tiền mặt", "Nhận lương 20tr techcombank trưa nay", "cf 35k mb".
   - Bóc tách:
     + amount: Số tiền dạng số nguyên VND (hiểu tiếng lóng: "55k" -> 55000, "1tr"/"1 củ" -> 1000000, "trăm rưỡi" -> 150000, "hai lốp" -> 200000).
     + type: "expense" (chi tiêu) hoặc "income" (thu nhập).
     + wallet_id & wallet_name: Khớp chính xác với ID và Tên trong Danh sách Ví. Nếu không nói rõ ví, chọn ví tiền mặt hoặc ví đầu tiên.
     + category_id & category_name: Khớp chính xác với ID và Tên trong Danh sách Danh mục.
     + note: Ghi chú ngắn gọn về nội dung chi tiêu.
     + transacted_at: Chuỗi ISO timestamp. Nếu có "trưa nay", "hôm qua", "sáng nay", hãy lùi/tiến giờ so với thời gian hiện tại cho chuẩn.

2. INTENT "create_debt": Khi người dùng muốn ghi nhận cho vay hoặc vay nợ.
   Ví dụ: "Cho Nam vay 200k từ ví momo", "Vay anh Hùng 1 triệu ví techcom".
   - Bóc tách: person_name, amount, type ("lend" là cho vay, "borrow" là vay), wallet_id, note.

3. INTENT "query": Khi người dùng hỏi đáp về tình hình tài chính, số dư ví, thống kê chi tiêu hoặc lời khuyên.
   Ví dụ: "Tháng này uống cafe hết bao nhiêu?", "Ví nào nhiều tiền nhất?", "Ai đang nợ tiền tui?", "So sánh thu chi tháng này".
   - Dựa vào THÔNG TIN TÀI CHÍNH THỰC TẾ được cung cấp ở trên để trả lời cụ thể, chính xác, ngắn gọn, có số liệu và định dạng tiền tệ rõ ràng (ví dụ: 480.000 ₫).
   - Tuyệt đối không bịa đặt số liệu không có trong ngữ cảnh.

ĐỊNH DẠNG TRẢ VỀ (BẮT BUỘC LÀ JSON NGUYÊN BẢN, KHÔNG BỌC VĂN BẢN NGOÀI):
{
  "intent": "create_transaction" | "create_debt" | "query" | "unknown",
  "message": "Lời nhắn hoặc câu trả lời bằng tiếng Việt (BẮT BUỘC thể hiện đậm nét tính cách [${personality.name}], văn phong sống động, dí dỏm hoặc theo đúng hướng dẫn tính cách ở trên, TUYỆT ĐỐI KHÔNG khô khan máy móc)",
  "transaction": {
    "type": "expense" | "income",
    "amount": 55000,
    "wallet_id": "...",
    "wallet_name": "...",
    "category_id": "...",
    "category_name": "...",
    "category_icon": "...",
    "category_color": "...",
    "note": "...",
    "transacted_at": "..."
  },
  "debt": {
    "type": "lend" | "borrow",
    "person_name": "...",
    "amount": 200000,
    "wallet_id": "...",
    "wallet_name": "...",
    "note": "..."
  }
}
`.trim();

  const conversationContents: any[] = [];
  // Thêm tối đa 4 lượt hội thoại gần nhất để giữ ngữ cảnh
  for (const msg of chatHistory.slice(-4)) {
    conversationContents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    });
  }
  conversationContents.push({
    role: 'user',
    parts: [{ text: userInput }],
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

      // Điền thêm icon & màu danh mục nếu thiếu
      if (parsed.transaction && parsed.transaction.category_id) {
        const cat = categories.find(c => c.id === parsed.transaction.category_id);
        if (cat) {
          parsed.transaction.category_icon = cat.icon;
          parsed.transaction.category_color = cat.color;
        }
      }

      return {
        intent: parsed.intent || 'unknown',
        message: parsed.message || 'Đã phân tích yêu cầu của bạn.',
        transaction: parsed.transaction,
        debt: parsed.debt,
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
 * Xử lý âm thanh trực tiếp (Multimodal Audio) qua Gemini 2.0 Flash
 */
export async function processCopilotAudioInput(
  db: SQLite.SQLiteDatabase,
  base64Audio: string,
  mimeType: string,
  wallets: Wallet[],
  categories: Category[]
): Promise<CopilotResponse> {
  const apiKey = await getGeminiApiKey(db);
  if (!apiKey) {
    throw new Error('Chưa cấu hình Gemini API Key. Vui lòng vào Cài đặt để thêm API Key.');
  }

  // Ưu tiên Gemini 2.0 Flash vì tối ưu Audio Multimodal
  const chosenModel = 'gemini-2.0-flash';
  const models = await getModelFallbackList(db, apiKey, chosenModel);
  const context = await buildFinancialContext(db, wallets, categories);
  const personalityId = await getCopilotPersonality(db);
  const personality = COPILOT_PERSONALITIES[personalityId] || COPILOT_PERSONALITIES.cheerful;

  const promptText = `
Bạn là Trợ lý Tài chính AI của MultiWallet.
HÃY TUÂN THỦ TÍNH CÁCH VÀ VĂN PHONG DƯỚI ĐÂY KHI TRÒ CHUYỆN:
${personality.promptInstruction}

Hãy nghe đoạn âm thanh tiếng Việt này:
1. Phiên âm chính xác nội dung câu nói của người dùng ("transcript").
2. Phân loại ý định:
   - Nếu là ghi chép chi tiêu/thu nhập (VD: "Ăn bún đậu 55k ví MoMo"): bóc tách amount, type, wallet_id, category_id, note, transacted_at.
   - Nếu là cho vay/vay nợ (VD: "Cho Tuấn vay 300k"): bóc tách person_name, amount, type, wallet_id.
   - Nếu là câu hỏi (VD: "Tháng này cafe hết bao nhiêu?"): trả lời dựa trên thông tin tài chính được cung cấp.

${context}

ĐỊNH DẠNG TRẢ VỀ JSON:
{
  "transcript": "Câu nói được phiên âm tiếng Việt của người dùng",
  "intent": "create_transaction" | "create_debt" | "query" | "unknown",
  "message": "Lời nhắn hoặc câu trả lời bằng tiếng Việt (BẮT BUỘC thể hiện đậm nét tính cách [${personality.name}], văn phong sống động, dí dỏm hoặc theo đúng hướng dẫn tính cách ở trên, TUYỆT ĐỐI KHÔNG khô khan máy móc)",
  "transaction": {
    "type": "expense" | "income",
    "amount": 55000,
    "wallet_id": "...",
    "wallet_name": "...",
    "category_id": "...",
    "category_name": "...",
    "category_icon": "...",
    "category_color": "...",
    "note": "...",
    "transacted_at": "..."
  },
  "debt": {
    "type": "lend" | "borrow",
    "person_name": "...",
    "amount": 200000,
    "wallet_id": "...",
    "wallet_name": "...",
    "note": "..."
  }
}
`.trim();

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inline_data: {
              mime_type: mimeType || 'audio/m4a',
              data: base64Audio,
            },
          },
          {
            text: promptText,
          },
        ],
      },
    ],
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

      if (parsed.transaction && parsed.transaction.category_id) {
        const cat = categories.find(c => c.id === parsed.transaction.category_id);
        if (cat) {
          parsed.transaction.category_icon = cat.icon;
          parsed.transaction.category_color = cat.color;
        }
      }

      return {
        intent: parsed.intent || 'unknown',
        transcript: parsed.transcript || '',
        message: parsed.message || (parsed.transcript ? `Đã nghe: "${parsed.transcript}"` : 'Đã phân tích âm thanh thành công.'),
        transaction: parsed.transaction,
        debt: parsed.debt,
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
