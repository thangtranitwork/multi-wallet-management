import * as Crypto from 'expo-crypto';

/**
 * Tạo ID duy nhất không bao giờ trùng lặp, kết hợp tiền tố, timestamp và UUID ngẫu nhiên.
 * Khắc phục hoàn toàn lỗi collision khi tạo nhiều bản ghi trong cùng 1 millisecond.
 */
export function generateId(prefix: string): string {
  const cleanPrefix = prefix ? `${prefix}_` : '';
  const timestamp = Date.now();
  const uuidSuffix = Crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  return `${cleanPrefix}${timestamp}_${uuidSuffix}`;
}
