import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import dayjs from 'dayjs';
import { Category, ReceiptScanResult, Wallet, ReceiptItem } from '../types';
import { getAppSetting, setAppSetting } from '../database/queries';
import {
  getCloudinaryConfig,
  uploadToCloudinary,
  CloudinaryConfig,
} from './cloudinaryService';
import { parseImageUris } from '../utils/imageUtils';
import { normalizeToIsoString } from '../utils/dateUtils';

export const GEMINI_SETTING_KEYS = {
  API_KEY: 'gemini_api_key',
  PREFERRED_MODEL: 'gemini_preferred_model',
};

export const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.0-flash-lite',
  'gemini-1.5-pro',
];

export interface GeminiModelInfo {
  id: string;
  name: string;
  badge?: string;
  desc: string;
}

export const GEMINI_MODEL_OPTIONS: GeminiModelInfo[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    badge: 'Khuyên dùng',
    desc: 'Thế hệ mới nhất, phản hồi tức thì & thị giác chuẩn xác',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    badge: 'Ổn định',
    desc: 'Mô hình tiêu chuẩn, quota cao, vận hành bền bỉ',
  },
  {
    id: 'gemini-1.5-flash-8b',
    name: 'Gemini 1.5 Flash-8B',
    badge: 'Siêu nhẹ',
    desc: 'Bản rút gọn siêu nhanh cho hóa đơn gọn gàng',
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    desc: 'Tối ưu độ trễ thấp và tiết kiệm tài nguyên',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    badge: 'Chuyên sâu',
    desc: 'Phân tích hóa đơn phức tạp, dài hoặc chữ viết tay',
  },
];

/**
 * Kiểm tra xem lỗi có phải do mạng / offline / DNS không giải quyết được hostname không
 */
export function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : String(err?.message || err || '');
  const lower = msg.toLowerCase();
  return (
    lower.includes('unknownhostexception') ||
    lower.includes('unable to resolve host') ||
    lower.includes('no address associated with hostname') ||
    lower.includes('enotfound') ||
    lower.includes('enetunreach') ||
    lower.includes('econnrefused') ||
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('offline')
  );
}

/**
 * Định dạng thông điệp lỗi sang tiếng Việt thân thiện, rõ ràng
 */
export function formatGeminiErrorMessage(err: any): string {
  if (!err) return 'Đã có lỗi xảy ra khi kết nối tới AI.';
  const msg = typeof err === 'string' ? err : String(err?.message || err);
  const lower = msg.toLowerCase();

  if (isNetworkError(err)) {
    return 'Không có kết nối Internet hoặc không thể kết nối tới máy chủ Google AI.\n\nVui lòng kiểm tra lại kết nối mạng (Wi-Fi/4G/5G) hoặc VPN của thiết bị.';
  }

  if (lower.includes('timeout') || lower.includes('etimedout') || lower.includes('timed out')) {
    return 'Quá thời gian kết nối (Timeout).\n\nVui lòng kiểm tra lại tốc độ mạng và thử lại.';
  }

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('ip_referrer_blocked') ||
    lower.includes('unauthenticated') ||
    lower.includes('key not found') ||
    lower.includes('(401)') ||
    lower.includes('(403)')
  ) {
    return 'Gemini API Key không hợp lệ hoặc đã bị chặn.\n\nVui lòng vào Cài đặt để cập nhật lại API Key.';
  }

  if (
    lower.includes('resource_exhausted') ||
    lower.includes('429') ||
    lower.includes('quota')
  ) {
    return 'Đã vượt quá giới hạn lượt dùng Gemini API miễn phí (Quota limit).\n\nVui lòng chờ 1-2 phút rồi thử lại.';
  }

  if (
    lower.includes('503') ||
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('overloaded') ||
    lower.includes('service unavailable')
  ) {
    return 'Máy chủ Google Gemini hiện đang quá tải.\n\nVui lòng thử lại sau giây lát.';
  }

  return msg.replace(/^Error:\s*/i, '');
}

export async function getGeminiApiKey(db: SQLite.SQLiteDatabase): Promise<string> {
  return await getAppSetting(db, GEMINI_SETTING_KEYS.API_KEY, '');
}

export async function saveGeminiApiKey(db: SQLite.SQLiteDatabase, apiKey: string): Promise<void> {
  await setAppSetting(db, GEMINI_SETTING_KEYS.API_KEY, apiKey.trim());
}

export async function getPreferredGeminiModel(db: SQLite.SQLiteDatabase): Promise<string> {
  const model = await getAppSetting(db, GEMINI_SETTING_KEYS.PREFERRED_MODEL, '');
  return model || GEMINI_MODELS[0];
}

export async function savePreferredGeminiModel(
  db: SQLite.SQLiteDatabase,
  model: string
): Promise<void> {
  await setAppSetting(db, GEMINI_SETTING_KEYS.PREFERRED_MODEL, model.trim());
}

/**
 * Lấy danh sách model dự phòng theo thứ tự ưu tiên
 */
export async function getModelFallbackList(
  db: SQLite.SQLiteDatabase,
  apiKey?: string,
  preferredOverride?: string
): Promise<string[]> {
  const preferred = preferredOverride || (await getPreferredGeminiModel(db));
  const candidateList = [...GEMINI_MODELS];

  if (apiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.models)) {
          const apiModels: string[] = data.models
            .filter(
              (m: any) =>
                Array.isArray(m.supportedGenerationMethods) &&
                m.supportedGenerationMethods.includes('generateContent')
            )
            .map((m: any) => (m.name || '').replace(/^models\//, ''))
            .filter((name: string) => {
              const lower = name.toLowerCase();
              return (
                lower.includes('flash') &&
                !lower.includes('tts') &&
                !lower.includes('audio') &&
                !lower.includes('speech') &&
                !lower.includes('image') &&
                !lower.includes('realtime') &&
                !lower.includes('live') &&
                !lower.includes('embedding') &&
                !lower.includes('aqa')
              );
            });

          for (const m of apiModels) {
            if (!candidateList.includes(m)) {
              candidateList.push(m);
            }
          }
        }
      }
    } catch {
      // Bỏ qua nếu lỗi mạng khi lấy danh sách model
    }
  }

  const selectedModel = preferred || candidateList[0];
  if (candidateList.includes(selectedModel)) {
    return [selectedModel, ...candidateList.filter((m) => m !== selectedModel)];
  }
  return [selectedModel, ...candidateList];
}

export { parseImageUris } from '../utils/imageUtils';

/**
 * Lưu các ảnh hóa đơn (lên Cloudinary nếu có cấu hình hoặc fallback vào thư mục cục bộ)
 */
export async function saveReceiptImages(
  sourceUris: string[],
  db?: SQLite.SQLiteDatabase
): Promise<string[]> {
  if (!sourceUris || sourceUris.length === 0) return [];

  // 1. Kiểm tra cấu hình Cloudinary nếu có db
  let cloudinaryConfig: CloudinaryConfig | null = null;
  if (db) {
    try {
      const cfg = await getCloudinaryConfig(db);
      if (cfg.enabled && cfg.cloudName && cfg.uploadPreset) {
        cloudinaryConfig = cfg;
      }
    } catch {}
  }

  const receiptDir = `${FileSystem.documentDirectory}transaction_receipts/`;
  let dirChecked = false;

  const savedUris: string[] = [];
  const timestamp = Date.now();

  for (let i = 0; i < sourceUris.length; i++) {
    const src = sourceUris[i];

    // Nếu đã là link Cloudinary (hoặc URL https) thì giữ nguyên
    if (src.startsWith('http://') || src.startsWith('https://')) {
      savedUris.push(src);
      continue;
    }

    // Nếu Cloudinary được kích hoạt, ưu tiên upload lên mây
    if (cloudinaryConfig) {
      try {
        const uploadRes = await uploadToCloudinary(src, cloudinaryConfig);
        if (uploadRes.secureUrl) {
          savedUris.push(uploadRes.secureUrl);
          // Dọn file tạm ban đầu nếu nằm trong cache (trì hoãn 5s để tránh xung đột với tiến trình đọc Base64 / AI)
          if (
            src.includes('ImagePicker') ||
            src.includes('cache') ||
            src.includes('shared_bank_receipt')
          ) {
            setTimeout(() => {
              FileSystem.deleteAsync(src, { idempotent: true }).catch(() => {});
            }, 5000);
          }
          continue;
        }
      } catch (cloudErr) {
        console.warn('Lỗi tải ảnh lên Cloudinary, fallback lưu local:', cloudErr);
      }
    }

    // Fallback: Lưu vào bộ nhớ máy cục bộ
    if (src.includes('transaction_receipts/')) {
      savedUris.push(src);
      continue;
    }

    if (!dirChecked) {
      const dirInfo = await FileSystem.getInfoAsync(receiptDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(receiptDir, { intermediates: true });
      }
      dirChecked = true;
    }

    try {
      const extMatch = src.split('?')[0].split('.').pop();
      const ext = extMatch && extMatch.length <= 4 ? extMatch : 'jpg';
      const targetUri = `${receiptDir}receipt_${timestamp}_${i}.${ext}`;
      await FileSystem.copyAsync({ from: src, to: targetUri });
      savedUris.push(targetUri);
      // Dọn dẹp tệp tạm trong cache sau khi đã lưu vĩnh viễn vào documentDirectory
      // (Trì hoãn 5 giây để tránh xung đột race condition nếu Gemini Vision API đang đọc song song)
      if (
        src.includes('cache') ||
        src.includes('shared_bank_receipt') ||
        src.includes('ImagePicker')
      ) {
        setTimeout(() => {
          FileSystem.deleteAsync(src, { idempotent: true }).catch(() => {});
        }, 5000);
      }
    } catch (err) {
      console.warn('Lỗi copy ảnh hóa đơn:', err);
      try {
        const info = await FileSystem.getInfoAsync(src);
        if (info.exists) {
          savedUris.push(src);
        }
      } catch {}
    }
  }

  return savedUris;
}

/**
 * Xóa các file ảnh cục bộ khi xóa giao dịch
 */
export async function deleteReceiptFiles(uris: string[]): Promise<void> {
  for (const uri of uris) {
    try {
      if (uri.startsWith('file://') && uri.includes('transaction_receipts/')) {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      }
    } catch (err) {
      console.warn('Lỗi xóa file ảnh hóa đơn:', err);
    }
  }
}

/**
 * Kiểm tra kết nối Gemini API
 */
export async function testGeminiConnection(
  db: SQLite.SQLiteDatabase,
  apiKeyOverride?: string,
  preferredModelOverride?: string
): Promise<{
  success: boolean;
  message: string;
  model?: string;
  isFallback?: boolean;
  originalModel?: string;
}> {
  const apiKey = apiKeyOverride !== undefined ? apiKeyOverride.trim() : await getGeminiApiKey(db);
  if (!apiKey) {
    return { success: false, message: 'Chưa cấu hình Gemini API Key' };
  }

  const testPayload = {
    contents: [
      {
        parts: [{ text: 'Trả về chuỗi JSON: {"status": "ok"}' }],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
    },
  };

  const chosenModel = preferredModelOverride || (await getPreferredGeminiModel(db));
  const models = await getModelFallbackList(db, apiKey, chosenModel);
  let lastError: any = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });

      const data = await response.json();
      if (!response.ok) {
        const errCode = Number(data?.error?.code || response.status);
        const errMsg = String(data?.error?.message || response.statusText || '');
        lastError = `[${model}] (${errCode}): ${errMsg}`;

        const isAuthError =
          errMsg.includes('API_KEY_INVALID') ||
          errMsg.includes('API key not valid') ||
          errMsg.includes('IP_REFERRER_BLOCKED');
        if (isAuthError) {
          return { success: false, message: formatGeminiErrorMessage(lastError) };
        }

        // Với tất cả các lỗi khác (400, 404, 429 quota, 503 overload, 5xx server):
        // Luôn tự động thử model tiếp theo trong danh sách
        continue;
      }

      if (data?.candidates && data.candidates.length > 0) {
        const isFallback = model !== chosenModel;
        return {
          success: true,
          message: isFallback
            ? `Đã kết nối qua mô hình dự phòng ${model}`
            : `Kết nối thành công qua mô hình ${model}`,
          model,
          isFallback,
          originalModel: chosenModel,
        };
      }
    } catch (err: any) {
      lastError = err;
      if (isNetworkError(err)) {
        return { success: false, message: formatGeminiErrorMessage(err) };
      }
    }
  }

  return {
    success: false,
    message: lastError ? formatGeminiErrorMessage(lastError) : 'Tất cả mô hình Gemini đều bận hoặc hết Quota.',
  };
}

export function sanitizeReceiptItems(
  items: any[],
  targetAmount?: number
): ReceiptItem[] {
  if (!Array.isArray(items)) return [];
  let list: ReceiptItem[] = items
    .filter(it => it && typeof it === 'object' && it.name)
    .map(it => ({
      name: String(it.name).trim(),
      quantity: typeof it.quantity === 'number' && it.quantity > 0 ? Math.round(it.quantity) : 1,
      price: typeof it.price === 'number' && it.price >= 0 ? Math.round(it.price) : 0,
    }))
    .filter(it => it.name.length > 0);

  if (list.length === 0) return [];

  const finalAmount = targetAmount && targetAmount > 0 ? targetAmount : 0;
  if (finalAmount > 0) {
    const sumAssumingUnitPrice = list.reduce(
      (acc, it) => acc + (it.price || 0) * (it.quantity || 1),
      0
    );
    const sumAssumingLineTotal = list.reduce((acc, it) => acc + (it.price || 0), 0);

    const hasMultiQty = list.some(it => (it.quantity || 1) > 1);

    // Kịch bản A: Tổng nhân (sumAssumingUnitPrice) vượt quá tổng hóa đơn đáng kể (> 8%),
    // trong khi tổng đơn thuần (sumAssumingLineTotal) lại gần với hóa đơn hơn nhiều:
    // Chứng tỏ LLM đã lấy cột Thành tiền làm "price" cho các món có quantity > 1.
    if (
      hasMultiQty &&
      sumAssumingUnitPrice > finalAmount * 1.08 &&
      Math.abs(sumAssumingLineTotal - finalAmount) < Math.abs(sumAssumingUnitPrice - finalAmount)
    ) {
      list = list.map(it => {
        const q = it.quantity || 1;
        const p = it.price || 0;
        if (q > 1 && p > 0) {
          return {
            ...it,
            price: Math.max(1, Math.round(p / q)),
          };
        }
        return it;
      });
    } else {
      // Kịch bản B: Kiểm tra từng món: nếu riêng 1 món đã có (price * quantity) > finalAmount * 0.9
      // nhưng price <= finalAmount (tức price thực chất là thành tiền của món đó):
      list = list.map(it => {
        const q = it.quantity || 1;
        const p = it.price || 0;
        if (q > 1 && p > 0) {
          if (p * q > finalAmount * 0.9 && p <= finalAmount) {
            return {
              ...it,
              price: Math.max(1, Math.round(p / q)),
            };
          }
        }
        return it;
      });
    }
  }

  return list;
}

/**
 * Đọc và phân tích một hoặc nhiều ảnh (hóa đơn, đồ ăn, món hàng, màn hình chuyển khoản) bằng Gemini Vision API
 */
export async function analyzeReceiptImages(
  db: SQLite.SQLiteDatabase,
  imageUris: string[],
  categories: Category[],
  wallets?: Wallet[]
): Promise<ReceiptScanResult> {
  const apiKey = await getGeminiApiKey(db);
  if (!apiKey) {
    throw new Error('Chưa cấu hình Gemini API Key. Vui lòng vào Cài đặt để thêm API Key.');
  }

  if (!imageUris || imageUris.length === 0) {
    throw new Error('Chưa chọn hình ảnh để quét.');
  }

  // Chuẩn bị danh sách danh mục để AI phân loại
  const catPromptList = categories
    .filter((c) => c.type === 'expense')
    .map((c) => `- ID: "${c.id}", Tên: "${c.name}"`)
    .join('\n');

  // Chuẩn bị danh sách ví của người dùng để AI đối chiếu nhận diện phương thức / ví thanh toán
  const walletPromptList =
    wallets && wallets.length > 0
      ? `DANH SÁCH VÍ / TÀI KHOẢN THANH TOÁN CỦA NGƯỜI DÙNG:
${wallets
  .map(
    (w) =>
      `- ID: "${w.id}", Tên ví: "${w.name}", Loại: "${w.type}"${
        w.bank_account ? `, Số TK: "${w.bank_account}"` : ''
      }`
  )
  .join('\n')}`
      : '';

  // Đọc tất cả các ảnh sang Base64
  const imageParts: Array<{ inline_data: { mime_type: string; data: string } }> = [];

  for (const uri of imageUris) {
    try {
      const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'webp') mimeType = 'image/webp';

      let localPath = uri;
      let needCleanTemp = false;

      // Nếu là ảnh từ xa (Cloudinary), tải về temp cache để đọc Base64
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        const tempPath = `${FileSystem.cacheDirectory}gemini_download_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.jpg`;
        const downloadRes = await FileSystem.downloadAsync(uri, tempPath);
        localPath = downloadRes.uri;
        needCleanTemp = true;
      }

      // Kiểm tra file có tồn tại trước khi đọc để tránh lỗi ENOENT FileNotFoundException
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (!fileInfo.exists) {
        console.log('[GeminiService] Tệp ảnh tạm không còn tồn tại hoặc đã được di chuyển:', localPath);
        continue;
      }

      const base64Data = await FileSystem.readAsStringAsync(localPath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (needCleanTemp) {
        try {
          await FileSystem.deleteAsync(localPath, { idempotent: true });
        } catch {}
      }

      if (base64Data && base64Data.length > 0) {
        imageParts.push({
          inline_data: {
            mime_type: mimeType,
            data: base64Data,
          },
        });
      }
    } catch (readErr: any) {
      console.warn('Lỗi đọc Base64 ảnh:', uri, readErr);
    }
  }

  if (imageParts.length === 0) {
    throw new Error('Không thể đọc dữ liệu ảnh. Vui lòng thử chụp hoặc chọn lại.');
  }

  const promptText = `Bạn là một trợ lý tài chính và kế toán AI thông minh, sở hữu khả năng thị giác máy tính chuẩn xác.
Nhiệm vụ của bạn là xem xét kỹ lưỡng ${imageParts.length} hình ảnh do người dùng tải lên và trích xuất thông tin chi tiêu chi tiết dưới dạng JSON chuẩn.

HÌNH ẢNH ĐƯỢC TẢI LÊN CÓ THỂ THUỘC CÁC TRƯỜNG HỢP SAU:
1. ẢNH CHỤP MÓN ĐỒ / ĐỒ ĂN THỨC UỐNG / HÀNG HÓA THỰC TẾ (Ví dụ: 2 hộp cơm trưa, ly trà sữa, tô phở, đôi giày, cây xăng đang bơm, giỏ đồ siêu thị...):
   - "note": Mô tả ngắn gọn, chính xác món đồ/đồ ăn kèm số lượng nhận diện được. Ví dụ: "2 hộp cơm", "2 ly trà sữa Highlands", "Tô phở bò", "Đổ xăng xe", "Đôi giày thể thao", "Bánh canh cua", "Bánh mì pate".
   - "amount": Nếu thấy tem giá, menu hoặc nhãn giá rõ ràng thì lấy số tiền. Nếu ảnh chỉ chụp thức ăn/đồ vật không có giá tiền thì trả về 0.
   - "category_id": Tự động xếp vào danh mục chi tiêu phù hợp nhất trong danh sách bên dưới (ví dụ ảnh cơm/phở/bánh mì/nước uống -> danh mục "Ăn uống").
   - "items": Bóc tách các món nhận diện được kèm số lượng (ví dụ: [{"name": "Hộp cơm", "quantity": 2, "price": 0}]).

2. HÓA ĐƠN / BIÊN LAI / BILL THANH TOÁN / PHIẾU THU / VÉ:
   - "amount": Tổng số tiền thanh toán thực tế cuối cùng bằng số nguyên VND (sau khi trừ chiết khấu/giảm giá).
   - "note": Tên cửa hàng/thương hiệu + tóm tắt món (ví dụ: "Highlands Coffee - 2 Cà phê", "WinMart - Rau củ thịt", "Nhà thuốc Long Châu - Thuốc cảm").
   - "transacted_at": Ngày giờ in trên hóa đơn theo format "YYYY-MM-DDTHH:mm:ss" hoặc "YYYY-MM-DD", nếu không thấy để null.
   - "category_id": Chọn ID danh mục phù hợp nhất từ danh sách bên dưới.
   - "items": Danh sách bóc tách chi tiết từng món hàng (tên món, số lượng, đơn giá).

3. ẢNH MÀN HÌNH CHUYỂN KHOẢN / APP NGÂN HÀNG / VÍ ĐIỆN TỬ (Vietcombank, MB, Techcombank, TPBank, BIDV, ACB, MoMo, ZaloPay, ShopeePay, VNPay...):
   - "amount": Số tiền giao dịch chuyển khoản / thanh toán.
   - "note": Nội dung chuyển khoản hoặc tên người/đơn vị nhận tiền (ví dụ: "Chuyển tiền trọ tháng 9", "MoMo - Tiền ăn trưa").
   - "transacted_at": Ngày giờ giao dịch nếu hiển thị trên màn hình.

4. NHẬN DIỆN PHƯƠNG THỨC & VÍ THANH TOÁN (PAYMENT METHOD & WALLET DETECTION):
   - Hãy quan sát kỹ toàn bộ ảnh xem có logo app ngân hàng / ví điện tử (MoMo, ZaloPay, Vietcombank, Techcombank, MB Bank, TPBank, VPBank, ACB, BIDV, ShopeePay, Apple Pay...), hoặc dấu hiệu trả tiền mặt, quẹt thẻ tín dụng (Visa, Mastercard, JCB, Napas...) hay không.
   - "detected_payment_method": Tên phương thức / app / ngân hàng nhận diện được (ví dụ: "MoMo", "Vietcombank", "MB Bank", "Tiền mặt", "Thẻ tín dụng Visa"...), nếu không có để null.
   - "wallet_id": Đối chiếu với danh sách ví của người dùng bên dưới. Nếu tìm thấy ví phù hợp nhất thì điền ID của ví đó, nếu không trùng hoặc không rõ thì để null.

5. ĐỐI CHIẾU & TÍNH TOÁN GIÁ CÁC MÓN VỚI TỔNG TIỀN (RECONCILE ITEMS & TOTAL AMOUNT):
   - ⚠️ PHÂN BIỆT RÕ CỘT [ĐƠN GIÁ] VÀ [THÀNH TIỀN]:
     + Hóa đơn thường in: [Tên hàng] [Số lượng] [Đơn giá] [Thành tiền].
     + Trường "price" trong items BẮT BUỘC là ĐƠN GIÁ của 1 sản phẩm (UNIT PRICE).
     + Ví dụ: "Hảo Hảo Big 100 | SL: 4 | Đơn giá: 6,500 | Thành tiền: 26,000"
       -> ĐIỀN: { "name": "Hảo Hảo Big 100", "quantity": 4, "price": 6500 }
       -> TUYỆT ĐỐI KHÔNG ĐIỀN { "quantity": 4, "price": 26000 } vì khi đó 4 * 26.000 = 104.000 là SAI HOÀN TOÀN!
     + Nếu hóa đơn chỉ in Thành tiền mà không in Đơn giá: tính price = Math.round(Thành_tiền / quantity).
   - Hãy tính tổng thành tiền của danh sách món: sum_items = sum(quantity * price).
   - So sánh sum_items với tổng số tiền thanh toán thực tế (amount):
     + sum_items phải khớp hoặc chỉ lệch do thuế VAT / chiết khấu giảm giá.
     + Nếu sum_items lớn hơn bất thường so với amount, hãy kiểm tra lại ngay xem có dòng nào bị nhầm cột Thành tiền thành Đơn giá không!
     + Nếu hóa đơn có thuế VAT, phí dịch vụ hoặc giảm giá voucher: amount phải là số tiền thanh toán thực tế cuối cùng sau thuế và giảm giá.
     + Nếu trường 'amount' bị thiếu, bị mờ hoặc = 0 nhưng danh sách món (items) có đơn giá rõ ràng: hãy lấy tổng các món (sum_items) làm giá trị cho 'amount'.

DANH SÁCH DANH MỤC CHI TIÊU CỦA NGƯỜI DÙNG:
${catPromptList}

${walletPromptList}

HÃY TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON SAU (TUYỆT ĐỐI KHÔNG KÈM TEXT NGOÀI JSON):
{
  "amount": number (số tiền thực tế thanh toán bằng VND, số nguyên. Nếu không thấy giá tiền trả về 0),
  "note": string (mô tả món đồ/đồ ăn/tên quán/nội dung giao dịch, ví dụ "2 hộp cơm", "Highlands Coffee - 2 Cà phê", "Chuyển khoản tiền phòng"),
  "transacted_at": string hoặc null (format "YYYY-MM-DDTHH:mm:ss" hoặc "YYYY-MM-DD", nếu không thấy để null),
  "category_id": string hoặc null (ID danh mục chi tiêu phù hợp nhất từ danh sách trên, hoặc null),
  "category_name": string hoặc null (tên danh mục tương ứng, hoặc null),
  "wallet_id": string hoặc null (ID ví phù hợp nhất từ danh sách ví trên nếu nhận diện được, hoặc null),
  "detected_payment_method": string hoặc null (tên app/ngân hàng/phương thức nhận diện được, ví dụ "MoMo", "Vietcombank", "Tiền mặt"),
  "items": [
    {
      "name": string (tên món hàng/món ăn),
      "quantity": number (số lượng, mặc định 1),
      "price": number (BẮT BUỘC LÀ ĐƠN GIÁ CỦA 1 SẢN PHẨM bằng VND. TUYỆT ĐỐI KHÔNG điền cột thành tiền vào price khi số lượng > 1, ví dụ mua 4 gói mì hết 26.000đ thì quantity: 4, price: 6500)
    }
  ],
  "confidence": number (độ tin cậy từ 0.0 đến 1.0)
}

LƯU Ý QUAN TRỌNG:
- Nếu có nhiều ảnh, hãy kết hợp thông tin từ tất cả các ảnh để trích xuất đầy đủ nhất.
- Tuyệt đối chỉ trả về đối tượng JSON hợp lệ, không chứa bất kỳ văn bản giải thích nào ngoài JSON.`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: promptText }, ...imageParts],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.1,
    },
  };

  let lastError: any = null;
  const originalPreferredModel = await getPreferredGeminiModel(db);
  const models = await getModelFallbackList(db, apiKey, originalPreferredModel);

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (!response.ok) {
        const errCode = Number(data?.error?.code || response.status);
        const errMsg = String(data?.error?.message || response.statusText || '');
        lastError = new Error(`[${model}] (${errCode}): ${errMsg}`);

        const isAuthError =
          errMsg.includes('API_KEY_INVALID') ||
          errMsg.includes('API key not valid') ||
          errMsg.includes('IP_REFERRER_BLOCKED');
        if (isAuthError) {
          throw new Error(formatGeminiErrorMessage(lastError));
        }

        // Với tất cả các lỗi khác (400, 404, 429 quota, 503 overload, 5xx server):
        // Luôn tự động thử model tiếp theo trong danh sách
        continue;
      }

      if (data?.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];
        const rawText = candidate?.content?.parts?.[0]?.text;
        if (!rawText) {
          throw new Error('AI không trả về nội dung.');
        }

        const parsed = JSON.parse(rawText);
        const isFallback = model !== originalPreferredModel;
        let finalAmount = typeof parsed.amount === 'number' ? Math.round(parsed.amount) : 0;
        const sanitizedItems = sanitizeReceiptItems(parsed.items, finalAmount);
        const itemsSum = sanitizedItems.reduce((acc: number, it: any) => acc + (it.price * (it.quantity || 1)), 0);

        // Nếu amount = 0 mà items có giá tiền, tự động lấy tổng các items làm amount
        if (finalAmount <= 0 && itemsSum > 0) {
          finalAmount = itemsSum;
        }

        const hasDiscrepancy = sanitizedItems.length > 0 && itemsSum > 0 && finalAmount > 0 && Math.abs(itemsSum - finalAmount) > 100;

        return {
          amount: finalAmount,
          note: typeof parsed.note === 'string' ? parsed.note.trim() : '',
          category_id: typeof parsed.category_id === 'string' ? parsed.category_id : null,
          category_name: typeof parsed.category_name === 'string' ? parsed.category_name : null,
          wallet_id: typeof parsed.wallet_id === 'string' ? parsed.wallet_id : null,
          detected_payment_method:
            typeof parsed.detected_payment_method === 'string'
              ? parsed.detected_payment_method.trim()
              : null,
          transacted_at: typeof parsed.transacted_at === 'string' ? normalizeToIsoString(parsed.transacted_at) : null,
          items: sanitizedItems,
          items_sum: itemsSum,
          has_discrepancy: hasDiscrepancy,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
          used_model: model,
          is_fallback: isFallback,
          original_model: originalPreferredModel,
        };
      }
    } catch (err: any) {
      lastError = err;
      if (isNetworkError(err)) {
        throw new Error(formatGeminiErrorMessage(err));
      }
      // Nếu là lỗi khác, tiếp tục thử model tiếp theo
      continue;
    }
  }

  throw new Error(
    lastError ? formatGeminiErrorMessage(lastError) : 'Không thể phân tích ảnh qua các mô hình Gemini hiện có.'
  );
}

export interface ReceiptStorageStats {
  transactionCount: number;
  imageCount: number;
  totalBytes: number;
  totalFormatted: string;
  cutoffDateStr: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Thống kê số lượng ảnh CỤC BỘ và dung lượng của các giao dịch cũ hơn N ngày
 * Chỉ tính các ảnh lưu trên máy (file://), không tính các ảnh lưu trên Cloudinary (http://, https://)
 */
export async function getReceiptStorageStats(
  db: SQLite.SQLiteDatabase,
  olderThanDays: number
): Promise<ReceiptStorageStats> {
  const cutoffDate = dayjs().subtract(olderThanDays, 'day').endOf('day');
  const cutoffIso = cutoffDate.toISOString();
  const rows = await db.getAllAsync<{ id: string; image_uris: string; transacted_at: string }>(
    `SELECT id, image_uris, transacted_at 
     FROM transactions 
     WHERE image_uris IS NOT NULL AND image_uris != '' AND transacted_at < ?`,
    [cutoffIso]
  );

  let imageCount = 0;
  let totalBytes = 0;
  let transactionCount = 0;

  for (const row of rows) {
    const uris = parseImageUris(row.image_uris);
    const localUris = uris.filter(u => !u.startsWith('http://') && !u.startsWith('https://'));

    if (localUris.length > 0) {
      transactionCount++;
      imageCount += localUris.length;
      for (const uri of localUris) {
        try {
          if (uri.startsWith('file://')) {
            const info = await FileSystem.getInfoAsync(uri);
            if (info.exists && (info as any).size) {
              totalBytes += (info as any).size;
            }
          }
        } catch {
          // Bỏ qua lỗi đọc file đơn lẻ
        }
      }
    }
  }

  return {
    transactionCount,
    imageCount,
    totalBytes,
    totalFormatted: formatFileSize(totalBytes),
    cutoffDateStr: cutoffDate.format('DD/MM/YYYY'),
  };
}

/**
 * Xóa vĩnh viễn các file ảnh CỤC BỘ (file://) của các giao dịch cũ hơn N ngày để giải phóng bộ nhớ máy.
 * TUYỆT ĐỐI KHÔNG XÓA HOẶC GỠ BỎ các ảnh đã lưu trên Cloudinary (http:// hoặc https://).
 */
export async function purgeReceiptImagesOlderThan(
  db: SQLite.SQLiteDatabase,
  olderThanDays: number
): Promise<{ cleanedTransactions: number; cleanedImages: number; freedFormatted: string; cutoffDateStr: string }> {
  const cutoffDate = dayjs().subtract(olderThanDays, 'day').endOf('day');
  const cutoffIso = cutoffDate.toISOString();
  const rows = await db.getAllAsync<{ id: string; image_uris: string }>(
    `SELECT id, image_uris 
     FROM transactions 
     WHERE image_uris IS NOT NULL AND image_uris != '' AND transacted_at < ?`,
    [cutoffIso]
  );

  if (rows.length === 0) {
    return {
      cleanedTransactions: 0,
      cleanedImages: 0,
      freedFormatted: '0 B',
      cutoffDateStr: cutoffDate.format('DD/MM/YYYY'),
    };
  }

  const allLocalUrisToDelete: string[] = [];
  let totalBytes = 0;
  let cleanedTxCount = 0;

  for (const row of rows) {
    const uris = parseImageUris(row.image_uris);
    const localUris = uris.filter(u => !u.startsWith('http://') && !u.startsWith('https://'));
    const cloudUris = uris.filter(u => u.startsWith('http://') || u.startsWith('https://'));

    // Nếu giao dịch này không có ảnh cục bộ nào (chỉ có ảnh Cloudinary), bỏ qua hoàn toàn!
    if (localUris.length === 0) {
      continue;
    }

    cleanedTxCount++;
    for (const u of localUris) {
      allLocalUrisToDelete.push(u);
      try {
        if (u.startsWith('file://')) {
          const info = await FileSystem.getInfoAsync(u);
          if (info.exists && (info as any).size) {
            totalBytes += (info as any).size;
          }
        }
      } catch {}
    }

    // Cập nhật database: Giữ lại các ảnh Cloudinary (nếu có), chỉ xóa ảnh cục bộ
    const newImageUrisVal = cloudUris.length > 0 ? JSON.stringify(cloudUris) : null;
    await db.runAsync(
      `UPDATE transactions SET image_uris = ? WHERE id = ?`,
      [newImageUrisVal, row.id]
    );
  }

  // Xóa file vật lý cục bộ khỏi bộ nhớ máy
  await deleteReceiptFiles(allLocalUrisToDelete);

  return {
    cleanedTransactions: cleanedTxCount,
    cleanedImages: allLocalUrisToDelete.length,
    freedFormatted: formatFileSize(totalBytes),
    cutoffDateStr: cutoffDate.format('DD/MM/YYYY'),
  };
}

