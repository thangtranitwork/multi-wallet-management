import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { getAppSetting, setAppSetting } from '../database/queries';
import { parseImageUris } from '../utils/imageUtils';

export const CLOUDINARY_SETTING_KEYS = {
  CLOUD_NAME: 'cloudinary_cloud_name',
  UPLOAD_PRESET: 'cloudinary_upload_preset',
  FOLDER: 'cloudinary_folder',
  ENABLED: 'cloudinary_enabled',
};

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
  folder: string;
  enabled: boolean;
}

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
}

/**
 * Lấy cấu hình Cloudinary từ SQLite
 */
export async function getCloudinaryConfig(db: SQLite.SQLiteDatabase): Promise<CloudinaryConfig> {
  const [cloudName, uploadPreset, folder, enabledStr] = await Promise.all([
    getAppSetting(db, CLOUDINARY_SETTING_KEYS.CLOUD_NAME, ''),
    getAppSetting(db, CLOUDINARY_SETTING_KEYS.UPLOAD_PRESET, ''),
    getAppSetting(db, CLOUDINARY_SETTING_KEYS.FOLDER, 'multi_wallet_receipts'),
    getAppSetting(db, CLOUDINARY_SETTING_KEYS.ENABLED, 'false'),
  ]);

  return {
    cloudName: cloudName.trim(),
    uploadPreset: uploadPreset.trim(),
    folder: folder.trim() || 'multi_wallet_receipts',
    enabled: enabledStr === 'true',
  };
}

/**
 * Lưu cấu hình Cloudinary vào SQLite
 */
export async function saveCloudinaryConfig(
  db: SQLite.SQLiteDatabase,
  config: Partial<CloudinaryConfig>
): Promise<void> {
  if (config.cloudName !== undefined) {
    await setAppSetting(db, CLOUDINARY_SETTING_KEYS.CLOUD_NAME, config.cloudName.trim());
  }
  if (config.uploadPreset !== undefined) {
    await setAppSetting(db, CLOUDINARY_SETTING_KEYS.UPLOAD_PRESET, config.uploadPreset.trim());
  }
  if (config.folder !== undefined) {
    await setAppSetting(db, CLOUDINARY_SETTING_KEYS.FOLDER, config.folder.trim());
  }
  if (config.enabled !== undefined) {
    await setAppSetting(db, CLOUDINARY_SETTING_KEYS.ENABLED, config.enabled ? 'true' : 'false');
  }
}

/**
 * Upload một file ảnh cục bộ lên Cloudinary bằng REST API (Unsigned Preset)
 * Hỗ trợ native streaming (uploadAsync) và fallback Base64 data URI tương thích 100% với Expo WinterCG fetch
 * @param localUri Đường dẫn file cục bộ (file://... hoặc content://...)
 * @param config Cấu hình Cloudinary (nếu không truyền sẽ tự đọc từ db)
 * @param customFolder Thư mục lưu trữ trên Cloudinary (tùy chọn)
 */
export async function uploadToCloudinary(
  localUri: string,
  config: CloudinaryConfig,
  customFolder?: string
): Promise<CloudinaryUploadResult> {
  if (!config.cloudName || !config.uploadPreset) {
    throw new Error('Chưa cấu hình Cloud Name hoặc Upload Preset');
  }

  // Nếu là ảnh đã nằm trên Cloudinary (bắt đầu bằng http:// hoặc https://) thì không upload lại
  if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
    return {
      secureUrl: localUri,
      publicId: '',
    };
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;
  const folder = customFolder || config.folder || 'multi_wallet_receipts';

  // Xác định định dạng ảnh
  const extMatch = localUri.split('?')[0].split('.').pop()?.toLowerCase();
  const ext = extMatch && ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(extMatch) ? extMatch : 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  // Kiểm tra và giải quyết đường dẫn đọc được (phòng trường hợp đổi giữa Dev Build và Expo Go)
  const targetUri = (await resolveReadableUri(localUri)) || localUri;

  // 1. Thử dùng FileSystem.uploadAsync để stream native trực tiếp từ thiết bị
  try {
    const uploadRes = await FileSystem.uploadAsync(endpoint, targetUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
      parameters: {
        upload_preset: config.uploadPreset,
        ...(folder ? { folder } : {}),
      },
    });

    if (uploadRes.status >= 200 && uploadRes.status < 300) {
      const responseData = JSON.parse(uploadRes.body);
      if (responseData.secure_url) {
        return {
          secureUrl: responseData.secure_url,
          publicId: responseData.public_id || '',
          format: responseData.format,
          bytes: responseData.bytes,
          width: responseData.width,
          height: responseData.height,
        };
      }
    }
  } catch (nativeErr) {
    // Nếu uploadAsync gặp lỗi hoặc không hỗ trợ scheme uri, tiếp tục fallback sang Base64
  }

  // 2. Fallback sang Base64 data URI qua fetch (tương thích tuyệt đối với Expo WinterCG fetch runtime)
  const base64 = await FileSystem.readAsStringAsync(targetUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const dataUri = `data:${mimeType};base64,${base64}`;

  const formData = new FormData();
  formData.append('file', dataUri);
  formData.append('upload_preset', config.uploadPreset);
  if (folder) {
    formData.append('folder', folder);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
    headers: {
      Accept: 'application/json',
    },
  });

  const responseData = await response.json();

  if (!response.ok || !responseData.secure_url) {
    const errorMsg = responseData?.error?.message || `Lỗi tải ảnh lên Cloudinary (${response.status})`;
    throw new Error(errorMsg);
  }

  return {
    secureUrl: responseData.secure_url,
    publicId: responseData.public_id || '',
    format: responseData.format,
    bytes: responseData.bytes,
    width: responseData.width,
    height: responseData.height,
  };
}

/**
 * Kiểm tra kết nối tới Cloudinary bằng cách gọi API với ảnh 1px trong suốt
 */
export async function testCloudinaryConnection(
  cloudName: string,
  uploadPreset: string
): Promise<{ success: boolean; message: string }> {
  if (!cloudName.trim()) {
    return { success: false, message: 'Vui lòng nhập Cloud Name.' };
  }
  if (!uploadPreset.trim()) {
    return { success: false, message: 'Vui lòng nhập Upload Preset.' };
  }

  try {
    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName.trim()}/image/upload`;
    // Base64 1x1 GIF trong suốt siêu nhẹ (43 bytes) để test upload
    const testPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    const formData = new FormData();
    formData.append('file', testPixel);
    formData.append('upload_preset', uploadPreset.trim());
    formData.append('folder', 'multi_wallet_test');

    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json',
      },
    });

    const data = await res.json();
    if (res.ok && data.secure_url) {
      return {
        success: true,
        message: 'Kết nối Cloudinary thành công! Upload Preset hoạt động tốt.',
      };
    } else {
      return {
        success: false,
        message: data?.error?.message || `Lỗi phản hồi (${res.status}) từ Cloudinary.`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Không thể kết nối tới Cloudinary. Vui lòng kiểm tra lại mạng.',
    };
  }
}

export interface MigrationProgress {
  total: number;
  current: number;
  successCount: number;
  failCount: number;
  statusText: string;
}

export interface LocalImagesStats {
  receiptImagesCount: number;
  qrImagesCount: number;
  totalCount: number;
  hasSandboxMismatch: boolean;
}

/**
 * Tìm đường dẫn file có thể đọc được trong môi trường hiện tại (hỗ trợ chuyển đổi giữa Dev Build và Expo Go)
 */
export async function resolveReadableUri(uri: string): Promise<string | null> {
  if (!uri) return null;
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;

  // 1. Thử kiểm tra chính đường dẫn uri đó
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      return uri;
    }
  } catch {
    // Không đọc được do quyền truy cập sandbox khác app hoặc đường dẫn lỗi
  }

  // 2. Thử tìm file tương ứng trong documentDirectory hoặc cacheDirectory của môi trường hiện tại
  const docDir = FileSystem.documentDirectory;
  const cacheDir = FileSystem.cacheDirectory;

  if (uri.includes('wallet_qrs/')) {
    const fileName = uri.split('wallet_qrs/').pop();
    if (fileName) {
      if (docDir) {
        const candidate = `${docDir}wallet_qrs/${fileName}`;
        try {
          const info = await FileSystem.getInfoAsync(candidate);
          if (info.exists) return candidate;
        } catch {}
      }
      if (cacheDir) {
        const candidate = `${cacheDir}wallet_qrs/${fileName}`;
        try {
          const info = await FileSystem.getInfoAsync(candidate);
          if (info.exists) return candidate;
        } catch {}
      }
    }
  }

  if (uri.includes('transaction_receipts/')) {
    const fileName = uri.split('transaction_receipts/').pop();
    if (fileName) {
      if (docDir) {
        const candidate = `${docDir}transaction_receipts/${fileName}`;
        try {
          const info = await FileSystem.getInfoAsync(candidate);
          if (info.exists) return candidate;
        } catch {}
      }
      if (cacheDir) {
        const candidate = `${cacheDir}transaction_receipts/${fileName}`;
        try {
          const info = await FileSystem.getInfoAsync(candidate);
          if (info.exists) return candidate;
        } catch {}
      }
    }
  }

  return null;
}

/**
 * Thống kê số lượng ảnh cục bộ chưa được đưa lên Cloudinary
 */
export async function getLocalImagesStats(
  db: SQLite.SQLiteDatabase
): Promise<LocalImagesStats> {
  const currentDocDir = FileSystem.documentDirectory || '';

  // 1. Quét giao dịch
  const txRows = await db.getAllAsync<{ image_uris: string }>(
    `SELECT image_uris FROM transactions WHERE image_uris IS NOT NULL AND image_uris != ''`
  );

  let receiptImagesCount = 0;
  let hasSandboxMismatch = false;

  for (const r of txRows) {
    const uris = parseImageUris(r.image_uris);
    for (const u of uris) {
      if (u.startsWith('file://') || u.includes('transaction_receipts/')) {
        receiptImagesCount++;
        if (u.includes('/com.thang.multiwallet/') && !currentDocDir.includes('/com.thang.multiwallet/')) {
          hasSandboxMismatch = true;
        }
      }
    }
  }

  // 2. Quét QR ví
  const walletRows = await db.getAllAsync<{ qr_image_uri: string }>(
    `SELECT qr_image_uri FROM wallets WHERE qr_image_uri IS NOT NULL AND qr_image_uri != ''`
  );

  let qrImagesCount = 0;
  for (const w of walletRows) {
    if (w.qr_image_uri && (w.qr_image_uri.startsWith('file://') || w.qr_image_uri.includes('wallet_qrs/'))) {
      qrImagesCount++;
      if (w.qr_image_uri.includes('/com.thang.multiwallet/') && !currentDocDir.includes('/com.thang.multiwallet/')) {
        hasSandboxMismatch = true;
      }
    }
  }

  return {
    receiptImagesCount,
    qrImagesCount,
    totalCount: receiptImagesCount + qrImagesCount,
    hasSandboxMismatch,
  };
}

/**
 * Di chuyển toàn bộ ảnh cục bộ (file://) lên Cloudinary và cập nhật lại DB
 */
export async function migrateLocalImagesToCloudinary(
  db: SQLite.SQLiteDatabase,
  onProgress?: (p: MigrationProgress) => void
): Promise<{ success: number; failed: number }> {
  const config = await getCloudinaryConfig(db);
  if (!config.cloudName || !config.uploadPreset) {
    throw new Error('Chưa cấu hình Cloudinary Cloud Name hoặc Upload Preset');
  }

  const txRows = await db.getAllAsync<{ id: string; image_uris: string }>(
    `SELECT id, image_uris FROM transactions WHERE image_uris IS NOT NULL AND image_uris != ''`
  );

  const walletRows = await db.getAllAsync<{ id: string; qr_image_uri: string }>(
    `SELECT id, qr_image_uri FROM wallets WHERE qr_image_uri IS NOT NULL AND qr_image_uri != ''`
  );

  // Thu thập danh sách cần upload
  const txTasks: Array<{ txId: string; localUri: string; index: number }> = [];
  txRows.forEach(r => {
    const uris = parseImageUris(r.image_uris);
    uris.forEach((u, idx) => {
      if (u.startsWith('file://') || u.includes('transaction_receipts/')) {
        txTasks.push({ txId: r.id, localUri: u, index: idx });
      }
    });
  });

  const walletTasks: Array<{ walletId: string; localUri: string }> = [];
  walletRows.forEach(w => {
    if (w.qr_image_uri && (w.qr_image_uri.startsWith('file://') || w.qr_image_uri.includes('wallet_qrs/'))) {
      walletTasks.push({ walletId: w.id, localUri: w.qr_image_uri });
    }
  });

  const total = txTasks.length + walletTasks.length;
  let current = 0;
  let successCount = 0;
  let failCount = 0;

  if (total === 0) {
    return { success: 0, failed: 0 };
  }

  // 1. Upload ảnh hóa đơn giao dịch
  for (const task of txTasks) {
    current++;
    onProgress?.({
      total,
      current,
      successCount,
      failCount,
      statusText: `Đang tải ảnh hóa đơn (${current}/${total})...`,
    });

    try {
      const uploadRes = await uploadToCloudinary(task.localUri, config, config.folder);
      // Cập nhật lại URI trong transaction
      const tx = await db.getFirstAsync<{ image_uris: string }>(
        'SELECT image_uris FROM transactions WHERE id = ?',
        [task.txId]
      );
      if (tx) {
        const uris = parseImageUris(tx.image_uris);
        if (uris[task.index] === task.localUri) {
          uris[task.index] = uploadRes.secureUrl;
          await db.runAsync('UPDATE transactions SET image_uris = ? WHERE id = ?', [
            JSON.stringify(uris),
            task.txId,
          ]);
          // Xóa file local sau khi đã upload mây an toàn
          try {
            await FileSystem.deleteAsync(task.localUri, { idempotent: true });
          } catch {}
          successCount++;
        }
      }
    } catch (e) {
      console.warn('Lỗi migrate ảnh hóa đơn:', e);
      failCount++;
    }
  }

  // 2. Upload ảnh mã QR ví
  for (const task of walletTasks) {
    current++;
    onProgress?.({
      total,
      current,
      successCount,
      failCount,
      statusText: `Đang tải mã QR ví (${current}/${total})...`,
    });

    try {
      const uploadRes = await uploadToCloudinary(task.localUri, config, 'multi_wallet_qrs');
      await db.runAsync('UPDATE wallets SET qr_image_uri = ? WHERE id = ?', [
        uploadRes.secureUrl,
        task.walletId,
      ]);
      try {
        await FileSystem.deleteAsync(task.localUri, { idempotent: true });
      } catch {}
      successCount++;
    } catch (e) {
      console.warn('Lỗi migrate ảnh QR ví:', e);
      failCount++;
    }
  }

  return { success: successCount, failed: failCount };
}
