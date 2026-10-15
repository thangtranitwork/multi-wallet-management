import * as Crypto from 'expo-crypto';

/**
 * Tạo chuỗi hash SHA-256 có muối (salted SHA-256) cho mã PIN.
 * Tuyệt đối không lưu mã PIN dạng plaintext vào cơ sở dữ liệu.
 */
export async function hashPin(pin: string, salt?: string): Promise<{ hash: string; salt: string; encoded: string }> {
  const activeSalt = salt || Crypto.randomUUID().replace(/-/g, '');
  const combined = `${activeSalt}:${pin}`;
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, combined);
  return {
    hash,
    salt: activeSalt,
    encoded: `${activeSalt}:${hash}`,
  };
}

/**
 * Xác minh mã PIN nhập vào khớp với giá trị salt:hash đã lưu trong máy.
 * So sánh an toàn độ trễ (constant-time check).
 */
export async function verifyPinHash(inputPin: string, storedSaltHash: string): Promise<boolean> {
  if (!storedSaltHash || typeof storedSaltHash !== 'string' || !storedSaltHash.includes(':')) {
    return false;
  }

  const [salt, expectedHash] = storedSaltHash.split(':');
  if (!salt || !expectedHash) {
    return false;
  }

  const { hash } = await hashPin(inputPin, salt);
  if (hash.length !== expectedHash.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < hash.length; i++) {
    result |= hash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }

  return result === 0;
}
