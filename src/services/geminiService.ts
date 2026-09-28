import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import dayjs from 'dayjs';
import { Category, ReceiptScanResult } from '../types';
import { getAppSetting, setAppSetting } from '../database/queries';

export const GEMINI_SETTING_KEYS = {
  API_KEY: 'gemini_api_key',
  PREFERRED_MODEL: 'gemini_preferred_model',
};

export const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
];

export async function getGeminiApiKey(db: SQLite.SQLiteDatabase): Promise<string> {
  return await getAppSetting(db, GEMINI_SETTING_KEYS.API_KEY, '');
}

export async function saveGeminiApiKey(db: SQLite.SQLiteDatabase, apiKey: string): Promise<void> {
  await setAppSetting(db, GEMINI_SETTING_KEYS.API_KEY, apiKey.trim());
}

/**
 * Lấy danh sách model dự phòng theo thứ tự ưu tiên
 */
export async function getModelFallbackList(
  db: SQLite.SQLiteDatabase,
  apiKey?: string
): Promise<string[]> {
  const preferred = await getAppSetting(db, GEMINI_SETTING_KEYS.PREFERRED_MODEL, '');
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

  if (
    preferred &&
    candidateList.includes(preferred) &&
    !preferred.includes('tts') &&
    !preferred.includes('audio')
  ) {
    return [preferred, ...candidateList.filter((m) => m !== preferred)];
  }

  return candidateList;
}

/**
 * Phân tích chuỗi JSON lưu trong DB thành danh sách đường dẫn ảnh
 */
export function parseImageUris(raw?: string | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
      }
    } catch {
      // Fallback nếu chuỗi JSON lỗi
    }
  }
  return [trimmed];
}

/**
 * Lưu các ảnh tạm từ ImagePicker vào thư mục lưu trữ cục bộ lâu dài của ứng dụng
 */
export async function saveReceiptImages(sourceUris: string[]): Promise<string[]> {
  if (!sourceUris || sourceUris.length === 0) return [];

  const receiptDir = `${FileSystem.documentDirectory}transaction_receipts/`;
  const dirInfo = await FileSystem.getInfoAsync(receiptDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(receiptDir, { intermediates: true });
  }

  const savedUris: string[] = [];
  const timestamp = Date.now();

  for (let i = 0; i < sourceUris.length; i++) {
    const src = sourceUris[i];
    // Nếu ảnh đã nằm trong thư mục receipts của app thì không cần copy lại
    if (src.includes('transaction_receipts/')) {
      savedUris.push(src);
      continue;
    }

    try {
      const extMatch = src.split('?')[0].split('.').pop();
      const ext = extMatch && extMatch.length <= 4 ? extMatch : 'jpg';
      const targetUri = `${receiptDir}receipt_${timestamp}_${i}.${ext}`;
      await FileSystem.copyAsync({ from: src, to: targetUri });
      savedUris.push(targetUri);
    } catch (err) {
      console.warn('Lỗi copy ảnh hóa đơn:', err);
      // Nếu copy lỗi thì giữ URI gốc
      savedUris.push(src);
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
  apiKeyOverride?: string
): Promise<{ success: boolean; message: string; model?: string }> {
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

  const models = await getModelFallbackList(db, apiKey);
  let lastError = '';

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

        // Nếu lỗi tạm thời (503 Service Unavailable / High demand, 429 Rate Limit, 404 Model Not Found, hoặc 5xx Server Error)
        // thì tự động chuyển sang model tiếp theo
        const isAuthError =
          errMsg.includes('API_KEY_INVALID') ||
          errMsg.includes('API key not valid') ||
          errMsg.includes('IP_REFERRER_BLOCKED');
        if (isAuthError) {
          return { success: false, message: lastError };
        }

        // Với tất cả các lỗi khác (400 modal AUDIO không hỗ trợ TEXT, 404 không có model, 429 quota, 503 overload, 5xx server):
        // Luôn tự động thử model tiếp theo trong danh sách
        continue;
      }

      if (data?.candidates && data.candidates.length > 0) {
        await setAppSetting(db, GEMINI_SETTING_KEYS.PREFERRED_MODEL, model).catch(() => {});
        return {
          success: true,
          message: `Kết nối thành công qua mô hình ${model}`,
          model,
        };
      }
    } catch (err: any) {
      lastError = `[${model}] Lỗi mạng: ${err?.message || err}`;
    }
  }

  return { success: false, message: lastError || 'Tất cả mô hình Gemini đều bận hoặc hết Quota.' };
}

/**
 * Đọc và phân tích một hoặc nhiều ảnh hóa đơn bằng Gemini Vision API
 */
export async function analyzeReceiptImages(
  db: SQLite.SQLiteDatabase,
  imageUris: string[],
  categories: Category[]
): Promise<ReceiptScanResult> {
  const apiKey = await getGeminiApiKey(db);
  if (!apiKey) {
    throw new Error('Chưa cấu hình Gemini API Key. Vui lòng vào Cài đặt để thêm API Key.');
  }

  if (!imageUris || imageUris.length === 0) {
    throw new Error('Chưa chọn hình ảnh hóa đơn để quét.');
  }

  // Chuẩn bị danh sách danh mục để AI phân loại
  const catPromptList = categories
    .filter((c) => c.type === 'expense')
    .map((c) => `- ID: "${c.id}", Tên: "${c.name}"`)
    .join('\n');

  // Đọc tất cả các ảnh sang Base64
  const imageParts: Array<{ inline_data: { mime_type: string; data: string } }> = [];

  for (const uri of imageUris) {
    try {
      const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'webp') mimeType = 'image/webp';

      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

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
    throw new Error('Không thể đọc dữ liệu ảnh hóa đơn. Vui lòng thử chụp hoặc chọn lại.');
  }

  const promptText = `Bạn là một chuyên gia kế toán và trợ lý tài chính thông minh.
Nhiệm vụ của bạn là đọc và phân tích kỹ lưỡng ${imageParts.length} hình ảnh hóa đơn / chứng từ / biên lai thanh toán sau đây để trích xuất dữ liệu chi tiêu dưới dạng JSON chuẩn.

Danh sách các danh mục chi tiêu có sẵn trong ứng dụng:
${catPromptList}

Hãy phân tích và trả về đúng định dạng JSON sau:
{
  "amount": number (tổng số tiền thanh toán thực tế cuối cùng bằng số nguyên VND, ví dụ 150000. Nếu có giảm giá hãy lấy số tiền thực khách phải trả. Nếu không tìm thấy trả về 0),
  "note": string (tên cửa hàng / thương hiệu / dịch vụ + tóm tắt ngắn gọn các mặt hàng chính, ví dụ: "Highlands Coffee - 2 Cà phê phin", "WinMart - Rau củ thịt", "Nhà thuốc Long Châu - Thuốc cảm"),
  "transacted_at": string hoặc null (ngày giờ in trên hóa đơn theo format "YYYY-MM-DDTHH:mm:ss" hoặc "YYYY-MM-DD". Nếu không thấy thì để null),
  "category_id": string hoặc null (chọn đúng ID danh mục phù hợp nhất từ danh sách trên, ví dụ "cat_food", "cat_coffee", hoặc null nếu không rõ),
  "category_name": string hoặc null (tên danh mục tương ứng),
  "items": [
    {
      "name": string (tên món hàng),
      "quantity": number (số lượng, mặc định 1),
      "price": number (đơn giá hoặc thành tiền bằng VND)
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
  const models = await getModelFallbackList(db, apiKey);

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
          throw lastError;
        }

        // Với tất cả các lỗi khác (400 modal AUDIO không hỗ trợ TEXT, 404 không có model, 429 quota, 503 overload, 5xx server):
        // Luôn tự động thử model tiếp theo trong danh sách
        continue;
      }

      if (data?.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];
        const rawText = candidate?.content?.parts?.[0]?.text;
        if (!rawText) {
          throw new Error('AI không trả về nội dung.');
        }

        // Lưu model đang hoạt động tốt nhất
        await setAppSetting(db, GEMINI_SETTING_KEYS.PREFERRED_MODEL, model).catch(() => {});

        const parsed = JSON.parse(rawText);
        return {
          amount: typeof parsed.amount === 'number' ? Math.round(parsed.amount) : 0,
          note: typeof parsed.note === 'string' ? parsed.note.trim() : '',
          category_id: typeof parsed.category_id === 'string' ? parsed.category_id : null,
          category_name: typeof parsed.category_name === 'string' ? parsed.category_name : null,
          transacted_at: typeof parsed.transacted_at === 'string' ? parsed.transacted_at : null,
          items: Array.isArray(parsed.items)
            ? parsed.items.map((it: any) => ({
                name: String(it.name || ''),
                quantity: typeof it.quantity === 'number' ? it.quantity : 1,
                price: typeof it.price === 'number' ? it.price : 0,
              }))
            : [],
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
        };
      }
    } catch (err: any) {
      lastError = err;
      // Nếu là lỗi mạng hoặc parse JSON, tiếp tục thử model khác
      continue;
    }
  }

  throw lastError || new Error('Không thể phân tích hóa đơn qua các mô hình Gemini hiện có.');
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
 * Thống kê số lượng ảnh và dung lượng của các giao dịch cũ hơn N ngày
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

  for (const row of rows) {
    const uris = parseImageUris(row.image_uris);
    imageCount += uris.length;
    for (const uri of uris) {
      try {
        if (uri.startsWith('file://')) {
          const info = await FileSystem.getInfoAsync(uri);
          if (info.exists && (info as any).size) {
            totalBytes += (info as any).size;
          }
        }
      } catch {
        // bỏ qua lỗi đọc file đơn lẻ
      }
    }
  }

  return {
    transactionCount: rows.length,
    imageCount,
    totalBytes,
    totalFormatted: formatFileSize(totalBytes),
    cutoffDateStr: cutoffDate.format('DD/MM/YYYY'),
  };
}

/**
 * Xóa vĩnh viễn các file ảnh của các giao dịch cũ hơn N ngày và giải phóng bộ nhớ
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

  const allUrisToDelete: string[] = [];
  let totalBytes = 0;

  for (const row of rows) {
    const uris = parseImageUris(row.image_uris);
    for (const u of uris) {
      allUrisToDelete.push(u);
      try {
        if (u.startsWith('file://')) {
          const info = await FileSystem.getInfoAsync(u);
          if (info.exists && (info as any).size) {
            totalBytes += (info as any).size;
          }
        }
      } catch {}
    }
  }

  // 1. Xóa file vật lý khỏi bộ nhớ máy
  await deleteReceiptFiles(allUrisToDelete);

  // 2. Cập nhật database: gán image_uris = NULL cho các giao dịch trước cutoffDate
  await db.runAsync(
    `UPDATE transactions 
     SET image_uris = NULL 
     WHERE image_uris IS NOT NULL AND image_uris != '' AND transacted_at < ?`,
    [cutoffIso]
  );

  return {
    cleanedTransactions: rows.length,
    cleanedImages: allUrisToDelete.length,
    freedFormatted: formatFileSize(totalBytes),
    cutoffDateStr: cutoffDate.format('DD/MM/YYYY'),
  };
}

