import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock Expo native modules before importing geminiService
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-sqlite', () => ({}));
jest.mock('../cloudinaryService', () => ({
  getCloudinaryConfig: jest.fn(),
  uploadToCloudinary: jest.fn(),
}));

import { getGeminiApiKey, saveGeminiApiKey, GEMINI_SETTING_KEYS } from '../geminiService';

class MockSQLiteDatabase {
  settings: Map<string, string> = new Map();

  async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    if (sql.includes('FROM app_settings WHERE key = ?')) {
      const key = params[0];
      const val = this.settings.get(key);
      if (val !== undefined) {
        return { key, value: val } as unknown as T;
      }
      return null;
    }
    return null;
  }

  async runAsync(sql: string, params: any[] = []): Promise<any> {
    if (sql.includes('app_settings')) {
      const [key, value] = params;
      this.settings.set(key, value);
      return { changes: 1 };
    }
    return { changes: 0 };
  }
}

describe('geminiApiKeyStorage', () => {
  let mockDb: MockSQLiteDatabase;

  beforeEach(() => {
    mockDb = new MockSQLiteDatabase();
  });

  it('obfuscates the Gemini API key in SQLite with the enc: prefix', async () => {
    const rawKey = 'AIzaSyA_sample_secret_gemini_key_12345';
    await saveGeminiApiKey(mockDb as any, rawKey);

    const storedValue = mockDb.settings.get(GEMINI_SETTING_KEYS.API_KEY);
    expect(storedValue).toBeDefined();
    // Giá trị lưu trong database không được là plaintext
    expect(storedValue).not.toBe(rawKey);
    // Bắt đầu bằng tiền tố enc: chuẩn của tokenStorage
    expect(storedValue?.startsWith('enc:')).toBe(true);

    // Khi đọc lại, giải mã trả về đúng khóa gốc
    const retrieved = await getGeminiApiKey(mockDb as any);
    expect(retrieved).toBe(rawKey);
  });

  it('reads legacy plaintext Gemini API key without errors (backward compatibility)', async () => {
    const legacyPlainKey = 'AIzaSyA_legacy_plaintext_key';
    mockDb.settings.set(GEMINI_SETTING_KEYS.API_KEY, legacyPlainKey);

    const retrieved = await getGeminiApiKey(mockDb as any);
    expect(retrieved).toBe(legacyPlainKey);
  });

  it('handles empty or cleared Gemini API key gracefully', async () => {
    await saveGeminiApiKey(mockDb as any, '');
    const storedValue = mockDb.settings.get(GEMINI_SETTING_KEYS.API_KEY);
    expect(storedValue).toBe('');

    const retrieved = await getGeminiApiKey(mockDb as any);
    expect(retrieved).toBe('');
  });
});
