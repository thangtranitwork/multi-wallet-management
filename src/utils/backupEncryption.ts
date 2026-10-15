import * as Crypto from 'expo-crypto';
import { BackupData } from '../database/backup';

const BACKUP_PEPPER = 'mw_backup_vault_v1_sec_salt_';

export interface EncryptedBackupEnvelope {
  app: 'multi-wallet-management';
  version: 1;
  encrypted: true;
  algorithm: 'chacha20-sha256-v1';
  salt: string;
  nonce: string;
  checksum: string;
  exported_at: string;
  payload: string;
}

/**
 * Hàm Quarter Round của thuật toán ChaCha20 (RFC 8439)
 */
function quarterRound(x: Uint32Array, a: number, b: number, c: number, d: number): void {
  x[a] = (x[a] + x[b]) >>> 0; x[d] ^= x[a]; x[d] = ((x[d] << 16) | (x[d] >>> 16)) >>> 0;
  x[c] = (x[c] + x[d]) >>> 0; x[b] ^= x[c]; x[b] = ((x[b] << 12) | (x[b] >>> 20)) >>> 0;
  x[a] = (x[a] + x[b]) >>> 0; x[d] ^= x[a]; x[d] = ((x[d] << 8)  | (x[d] >>> 24)) >>> 0;
  x[c] = (x[c] + x[d]) >>> 0; x[b] ^= x[c]; x[b] = ((x[b] << 7)  | (x[b] >>> 25)) >>> 0;
}

function getU32LE(b: Uint8Array, offset: number): number {
  return ((b[offset]) | (b[offset + 1] << 8) | (b[offset + 2] << 16) | (b[offset + 3] << 24)) >>> 0;
}

function setU32LE(b: Uint8Array, offset: number, val: number): void {
  b[offset] = val & 0xff;
  b[offset + 1] = (val >>> 8) & 0xff;
  b[offset + 2] = (val >>> 16) & 0xff;
  b[offset + 3] = (val >>> 24) & 0xff;
}

/**
 * Xử lý mã hóa / giải mã stream cipher ChaCha20 256-bit (RFC 8439)
 */
export function chacha20Process(
  keyBytes: Uint8Array,
  nonceBytes: Uint8Array,
  inputBytes: Uint8Array,
  initialCounter: number = 1
): Uint8Array {
  const keyWords = new Uint32Array(8);
  for (let i = 0; i < 8; i++) {
    keyWords[i] = getU32LE(keyBytes, i * 4);
  }

  const nonceWords = new Uint32Array(3);
  for (let i = 0; i < 3; i++) {
    nonceWords[i] = getU32LE(nonceBytes, i * 4);
  }

  const state = new Uint32Array(16);
  // Hằng số định danh RFC 8439 "expand 32-byte k"
  state[0] = 0x61707865;
  state[1] = 0x3320646e;
  state[2] = 0x79622d32;
  state[3] = 0x6b206574;
  for (let i = 0; i < 8; i++) {
    state[4 + i] = keyWords[i];
  }
  state[13] = nonceWords[0];
  state[14] = nonceWords[1];
  state[15] = nonceWords[2];

  const working = new Uint32Array(16);
  const keyStream = new Uint8Array(64);
  const output = new Uint8Array(inputBytes.length);
  let counter = initialCounter;

  for (let offset = 0; offset < inputBytes.length; offset += 64) {
    state[12] = counter;
    for (let i = 0; i < 16; i++) {
      working[i] = state[i];
    }
    // 20 vòng xoay ChaCha20 (10 lần 2 vòng)
    for (let i = 0; i < 10; i++) {
      quarterRound(working, 0, 4, 8, 12);
      quarterRound(working, 1, 5, 9, 13);
      quarterRound(working, 2, 6, 10, 14);
      quarterRound(working, 3, 7, 11, 15);
      quarterRound(working, 0, 5, 10, 15);
      quarterRound(working, 1, 6, 11, 12);
      quarterRound(working, 2, 7, 8, 13);
      quarterRound(working, 3, 4, 9, 14);
    }
    for (let i = 0; i < 16; i++) {
      setU32LE(keyStream, i * 4, (working[i] + state[i]) >>> 0);
    }
    const blockSize = Math.min(64, inputBytes.length - offset);
    for (let i = 0; i < blockSize; i++) {
      output[offset + i] = inputBytes[offset + i] ^ keyStream[i];
    }
    counter = (counter + 1) >>> 0;
  }

  return output;
}

/**
 * Chuyển đổi Uint8Array sang chuỗi Hex
 */
function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Chuyển đổi chuỗi Hex sang Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim();
  const len = cleanHex.length;
  const bytes = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Sinh key 32 bytes từ salt và vault pepper bằng SHA-256
 */
async function deriveKey(salt: string): Promise<Uint8Array> {
  const hashHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    BACKUP_PEPPER + salt
  );
  return hexToBytes(hashHex);
}

/**
 * Tạo checksum SHA-256 cho dữ liệu mã hóa để xác thực tính toàn vẹn (HMAC-like checksum)
 */
async function computeChecksum(salt: string, nonce: string, payloadHex: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${nonce}:${payloadHex}:${BACKUP_PEPPER}`
  );
}

/**
 * So sánh an toàn độ trễ (constant-time comparison) để chống tấn công timing
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Kiểm tra xem dữ liệu có phải là envelope mã hóa hay không
 */
export function isEncryptedBackup(data: any): data is EncryptedBackupEnvelope {
  return Boolean(
    data &&
    typeof data === 'object' &&
    data.app === 'multi-wallet-management' &&
    data.encrypted === true &&
    typeof data.payload === 'string' &&
    typeof data.salt === 'string' &&
    typeof data.nonce === 'string' &&
    typeof data.checksum === 'string'
  );
}

/**
 * Mã hóa dữ liệu BackupData thành chuỗi JSON envelope bảo mật
 */
export async function encryptBackupPayload(
  plainDataOrJson: string | BackupData
): Promise<string> {
  const plainText = typeof plainDataOrJson === 'string'
    ? plainDataOrJson
    : JSON.stringify(plainDataOrJson);

  // Sinh salt 16 bytes và nonce 12 bytes ngẫu nhiên
  const rawSalt = (Crypto.randomUUID() + Crypto.randomUUID()).replace(/[^a-f0-9]/gi, '').slice(0, 32);
  const salt = rawSalt.padEnd(32, '0').toLowerCase();

  const rawNonce = (Crypto.randomUUID() + Crypto.randomUUID()).replace(/[^a-f0-9]/gi, '').slice(0, 24);
  const nonce = rawNonce.padEnd(24, 'a').toLowerCase();

  const keyBytes = await deriveKey(salt);
  const nonceBytes = hexToBytes(nonce);
  const plainBytes = new TextEncoder().encode(plainText);

  const cipherBytes = chacha20Process(keyBytes, nonceBytes, plainBytes);
  const payloadHex = bytesToHex(cipherBytes);
  const checksum = await computeChecksum(salt, nonce, payloadHex);

  const envelope: EncryptedBackupEnvelope = {
    app: 'multi-wallet-management',
    version: 1,
    encrypted: true,
    algorithm: 'chacha20-sha256-v1',
    salt,
    nonce,
    checksum,
    exported_at: new Date().toISOString(),
    payload: payloadHex,
  };

  return JSON.stringify(envelope, null, 2);
}

/**
 * Giải mã dữ liệu sao lưu. Hỗ trợ tự động:
 * 1. Dữ liệu đã mã hóa (ChaCha20 + checksum verification)
 * 2. Dữ liệu sao lưu cũ chưa mã hóa (backward compatibility)
 */
export async function decryptBackupPayload(
  rawInput: string | any
): Promise<BackupData> {
  if (!rawInput) {
    throw new Error('Dữ liệu sao lưu trống.');
  }

  let parsed: any = rawInput;
  if (typeof rawInput === 'string') {
    try {
      parsed = JSON.parse(rawInput);
    } catch {
      throw new Error('Định dạng file không phải là JSON hợp lệ.');
    }
  }

  // Nếu là file cũ chưa mã hóa (hoặc đối tượng BackupData thuần túy)
  if (!isEncryptedBackup(parsed)) {
    return parsed as BackupData;
  }

  // Xác thực toàn vẹn checksum trước khi giải mã
  const expectedChecksum = await computeChecksum(parsed.salt, parsed.nonce, parsed.payload);
  if (!constantTimeCompare(parsed.checksum, expectedChecksum)) {
    throw new Error('Bản sao lưu không hợp lệ hoặc đã bị thay đổi (lỗi xác thực toàn vẹn checksum).');
  }

  try {
    const keyBytes = await deriveKey(parsed.salt);
    const nonceBytes = hexToBytes(parsed.nonce);
    const cipherBytes = hexToBytes(parsed.payload);

    const decryptedBytes = chacha20Process(keyBytes, nonceBytes, cipherBytes);
    const jsonString = new TextDecoder().decode(decryptedBytes);
    const decryptedData = JSON.parse(jsonString);

    return decryptedData as BackupData;
  } catch (err: any) {
    throw new Error(`Không thể giải mã dữ liệu sao lưu: ${err?.message || 'Khóa hoặc định dạng không đúng'}`);
  }
}
