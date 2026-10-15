import * as Crypto from 'expo-crypto';

const STORAGE_PEPPER = 'mw_vault_sec_v1_';

/**
 * Mã hóa token trước khi lưu vào SQLite, ngăn chặn token bị lộ dưới dạng plaintext khi DB bị trích xuất
 */
export async function encryptToken(token: string): Promise<string> {
  if (!token || typeof token !== 'string') return '';
  try {
    const keyHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      STORAGE_PEPPER + 'multi_wallet_internal_token_vault'
    );
    const tokenBytes = new TextEncoder().encode(token);
    const keyBytes = new TextEncoder().encode(keyHash);
    const result = new Uint8Array(tokenBytes.length);
    for (let i = 0; i < tokenBytes.length; i++) {
      result[i] = tokenBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return 'enc:' + Array.from(result).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return token;
  }
}

/**
 * Giải mã token đã lưu trong SQLite. Hỗ trợ tự động fallback nếu là token plaintext cũ.
 */
export async function decryptToken(stored: string): Promise<string> {
  if (!stored || typeof stored !== 'string') return '';
  if (!stored.startsWith('enc:')) {
    // Dữ liệu cũ chưa mã hóa
    return stored;
  }
  try {
    const hex = stored.slice(4);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    const keyHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      STORAGE_PEPPER + 'multi_wallet_internal_token_vault'
    );
    const keyBytes = new TextEncoder().encode(keyHash);
    const result = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      result[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return new TextDecoder().decode(result);
  } catch {
    return '';
  }
}
