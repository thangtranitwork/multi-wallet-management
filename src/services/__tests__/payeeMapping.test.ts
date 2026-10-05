import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  cleanPayeeName,
  findPayeeMapping,
  upsertPayeeMapping,
  getAllPayeeMappings,
  deletePayeeMapping,
  getSmartPayeeMappingEnabled,
  setSmartPayeeMappingEnabled,
} from '../../database/queries';
import { PayeeMapping } from '../../types';

// Mock in-memory SQLite database
class MockSQLiteDatabase {
  settings: Map<string, string> = new Map();
  payeeMappings: Map<string, PayeeMapping> = new Map();

  async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    if (sql.includes('FROM app_settings WHERE key = ?')) {
      const key = params[0];
      const val = this.settings.get(key);
      if (val !== undefined) {
        return { key, value: val } as unknown as T;
      }
      return null;
    }

    if (sql.includes('FROM payee_mappings WHERE account_number = ?')) {
      const acc = params[0];
      for (const m of this.payeeMappings.values()) {
        if (m.account_number === acc) return m as unknown as T;
      }
      return null;
    }

    if (sql.includes('FROM payee_mappings WHERE payee_name = ?')) {
      const name = params[0];
      for (const m of this.payeeMappings.values()) {
        if (m.payee_name === name) return m as unknown as T;
      }
      return null;
    }

    if (sql.includes('FROM payee_mappings WHERE payee_name LIKE ?')) {
      const cleaned = params[1] || '';
      for (const m of this.payeeMappings.values()) {
        if (cleaned.includes(m.payee_name) || m.payee_name.includes(cleaned)) {
          return m as unknown as T;
        }
      }
      return null;
    }

    return null;
  }

  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (sql.includes('FROM payee_mappings')) {
      return Array.from(this.payeeMappings.values()).sort(
        (a, b) => (b.use_count || 0) - (a.use_count || 0)
      ) as unknown as T[];
    }
    return [];
  }

  async runAsync(sql: string, params: any[] = []): Promise<any> {
    if (sql.includes('INSERT INTO app_settings') || sql.includes('settings')) {
      const [key, value] = params;
      this.settings.set(key, String(value));
      return { changes: 1 };
    }

    if (sql.includes('INSERT INTO payee_mappings')) {
      const [
        id,
        payee_name,
        payee_display_name,
        account_number,
        bank_name,
        suggested_note,
        suggested_category_id,
        suggested_wallet_id,
        recent_notes,
        last_used_at,
        created_at,
      ] = params;
      const mapping: PayeeMapping = {
        id,
        payee_name,
        payee_display_name,
        account_number,
        bank_name,
        suggested_note,
        suggested_category_id,
        suggested_wallet_id,
        use_count: 1,
        recent_notes,
        last_used_at,
        created_at,
      };
      this.payeeMappings.set(id, mapping);
      return { changes: 1 };
    }

    if (sql.includes('UPDATE payee_mappings')) {
      const id = params[params.length - 1];
      const existing = this.payeeMappings.get(id);
      if (existing) {
        existing.suggested_note = params[0];
        if (params[1]) existing.suggested_category_id = params[1];
        if (params[2]) existing.suggested_wallet_id = params[2];
        if (params[3]) existing.payee_display_name = params[3];
        if (params[4]) existing.account_number = params[4];
        if (params[5]) existing.bank_name = params[5];
        existing.use_count += 1;
        existing.recent_notes = params[6];
        existing.last_used_at = params[7];
      }
      return { changes: 1 };
    }

    if (sql.includes('DELETE FROM payee_mappings WHERE id = ?')) {
      const id = params[0];
      this.payeeMappings.delete(id);
      return { changes: 1 };
    }

    return { changes: 1 };
  }
}

describe('cleanPayeeName', () => {
  it('normalizes Vietnamese accents and upper cases names', () => {
    expect(cleanPayeeName('Nguyễn Văn A')).toBe('NGUYEN VAN A');
    expect(cleanPayeeName('Trần Thị Bích')).toBe('TRAN THI BICH');
    expect(cleanPayeeName('Lê Đức Đạt')).toBe('LE DUC DAT');
  });

  it('strips common banking transfer prefixes', () => {
    expect(cleanPayeeName('Chuyển khoản đến Nguyễn Văn A')).toBe('NGUYEN VAN A');
    expect(cleanPayeeName('Người nhận: Nguyễn Văn A')).toBe('NGUYEN VAN A');
    expect(cleanPayeeName('Chuyển tiền cho NGUYEN VAN A')).toBe('NGUYEN VAN A');
    expect(cleanPayeeName('Người thụ hưởng: NGUYEN VAN A')).toBe('NGUYEN VAN A');
    expect(cleanPayeeName('Bên nhận: NGUYEN VAN A')).toBe('NGUYEN VAN A');
    expect(cleanPayeeName('Tài khoản nhận: NGUYEN VAN A')).toBe('NGUYEN VAN A');
  });

  it('handles empty or whitespace strings', () => {
    expect(cleanPayeeName('')).toBe('');
    expect(cleanPayeeName('   ')).toBe('');
  });
});

describe('Smart Payee Mapping Settings & Database Logic', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = new MockSQLiteDatabase();
  });

  it('defaults to true when setting key does not exist yet', async () => {
    const isEnabled = await getSmartPayeeMappingEnabled(mockDb);
    expect(isEnabled).toBe(true);
  });

  it('can be toggled off and on in settings', async () => {
    await setSmartPayeeMappingEnabled(mockDb, false);
    let isEnabled = await getSmartPayeeMappingEnabled(mockDb);
    expect(isEnabled).toBe(false);

    await setSmartPayeeMappingEnabled(mockDb, true);
    isEnabled = await getSmartPayeeMappingEnabled(mockDb);
    expect(isEnabled).toBe(true);
  });

  it('learns and maps payee when enabled', async () => {
    // 1. First transaction: Transfer to Nguyen Van A, user renames note to "Bò cụng"
    await upsertPayeeMapping(mockDb, {
      payee_name: 'Nguyễn Văn A',
      note: 'Bò cụng',
      category_id: 'cat_beverage',
      wallet_id: 'w_momo',
    });

    // 2. Next transfer to the same person, query finding mapping
    const match = await findPayeeMapping(mockDb, 'Chuyển khoản đến NGUYỄN VĂN A');
    expect(match).not.toBeNull();
    expect(match?.suggested_note).toBe('Bò cụng');
    expect(match?.suggested_category_id).toBe('cat_beverage');
    expect(match?.suggested_wallet_id).toBe('w_momo');
    expect(match?.use_count).toBe(1);
  });

  it('updates suggested_note and increments use_count on subsequent transactions', async () => {
    await upsertPayeeMapping(mockDb, {
      payee_name: 'Nguyễn Văn A',
      note: 'Bò cụng',
      category_id: 'cat_beverage',
    });

    await upsertPayeeMapping(mockDb, {
      payee_name: 'Nguyễn Văn A',
      note: 'Bò cụng',
      category_id: 'cat_beverage',
    });

    const match = await findPayeeMapping(mockDb, 'NGUYEN VAN A');
    expect(match?.use_count).toBe(2);
    expect(match?.suggested_note).toBe('Bò cụng');
  });

  it('does NOT save mappings when setting is toggled off', async () => {
    await setSmartPayeeMappingEnabled(mockDb, false);

    await upsertPayeeMapping(mockDb, {
      payee_name: 'Nguyễn Văn A',
      note: 'Bò cụng',
      category_id: 'cat_beverage',
    });

    const match = await findPayeeMapping(mockDb, 'Nguyễn Văn A');
    expect(match).toBeNull();
  });

  it('can delete payee mapping', async () => {
    await upsertPayeeMapping(mockDb, {
      payee_name: 'Nguyễn Văn A',
      note: 'Bò cụng',
    });

    let mappings = await getAllPayeeMappings(mockDb);
    expect(mappings.length).toBe(1);

    await deletePayeeMapping(mockDb, mappings[0].id);

    mappings = await getAllPayeeMappings(mockDb);
    expect(mappings.length).toBe(0);
  });
});
