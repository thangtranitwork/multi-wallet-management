import { describe, it, expect } from '@jest/globals';
import {
  encryptBackupPayload,
  decryptBackupPayload,
  isEncryptedBackup,
} from '../backupEncryption';
import { BackupData } from '../../database/backup';

describe('backupEncryption', () => {
  const sampleBackupData: BackupData = {
    app: 'multi-wallet-management',
    version: 1,
    exported_at: '2026-10-15T12:00:00.000Z',
    stats: {
      wallets_count: 2,
      categories_count: 5,
      debts_count: 1,
      transactions_count: 3,
      debt_payments_count: 0,
      planned_expenses_count: 0,
      contacts_count: 1,
    },
    data: {
      wallets: [
        {
          id: 'w_main',
          name: 'Ví Chi Tiêu Bí Mật',
          type: 'cash',
          balance: 15000000,
          credit_limit: 0,
          currency: 'VND',
          color: '#10B981',
          icon: 'wallet-outline',
          is_excluded: 0,
          bank_account: '998877665544',
          created_at: '2026-10-15T10:00:00.000Z',
        },
      ],
      categories: [
        { id: 'c_food', name: 'Ăn uống', type: 'expense', icon: 'fast-food', color: '#F97316' },
      ],
      debts: [
        {
          id: 'd_1',
          type: 'borrow',
          person_name: 'Nguyen Van B',
          initial_amount: 2000000,
          remaining_amount: 1500000,
          status: 'active',
          created_at: '2026-10-15T10:00:00.000Z',
        },
      ],
      transactions: [
        {
          id: 'tx_secret',
          type: 'expense',
          amount: 250000,
          wallet_id: 'w_main',
          note: 'Giao dịch nhạy cảm không được để lộ',
          transacted_at: '2026-10-15T11:00:00.000Z',
          created_at: '2026-10-15T11:00:00.000Z',
        },
      ],
      debt_payments: [],
      contacts: [
        {
          id: 'ct_secret',
          name: 'Nguyen Van B',
          phone: '0912345678',
          created_at: '2026-10-15T10:00:00.000Z',
        },
      ],
    },
  };

  it('encrypts backup data so that sensitive strings are not readable in the payload', async () => {
    const encryptedJson = await encryptBackupPayload(sampleBackupData);
    const parsed = JSON.parse(encryptedJson);

    expect(isEncryptedBackup(parsed)).toBe(true);
    expect(parsed.app).toBe('multi-wallet-management');
    expect(parsed.encrypted).toBe(true);
    expect(parsed.algorithm).toBe('chacha20-sha256-v1');
    expect(parsed.payload).toBeDefined();
    expect(typeof parsed.payload).toBe('string');

    // Dữ liệu nhạy cảm không được xuất hiện dưới dạng plain text trong payload
    expect(encryptedJson).not.toContain('Ví Chi Tiêu Bí Mật');
    expect(encryptedJson).not.toContain('Giao dịch nhạy cảm không được để lộ');
    expect(encryptedJson).not.toContain('998877665544');
    expect(encryptedJson).not.toContain('0912345678');
  });

  it('decrypts an encrypted backup envelope back to the original BackupData correctly', async () => {
    const encryptedJson = await encryptBackupPayload(sampleBackupData);
    const decrypted = await decryptBackupPayload(encryptedJson);

    expect(decrypted.app).toBe('multi-wallet-management');
    expect(decrypted.data.wallets).toHaveLength(1);
    expect(decrypted.data.wallets[0].name).toBe('Ví Chi Tiêu Bí Mật');
    expect(decrypted.data.wallets[0].bank_account).toBe('998877665544');
    expect(decrypted.data.transactions[0].note).toBe('Giao dịch nhạy cảm không được để lộ');
    expect(decrypted.data.debts[0].person_name).toBe('Nguyen Van B');
    expect(decrypted.data.contacts?.[0].phone).toBe('0912345678');
  });

  it('supports backward compatibility by returning legacy unencrypted backups intact', async () => {
    const plainJson = JSON.stringify(sampleBackupData);
    const resultFromString = await decryptBackupPayload(plainJson);
    expect(resultFromString.data.wallets[0].name).toBe('Ví Chi Tiêu Bí Mật');

    const resultFromObject = await decryptBackupPayload(sampleBackupData);
    expect(resultFromObject.data.transactions[0].note).toBe('Giao dịch nhạy cảm không được để lộ');
  });

  it('throws an error if the payload has been tampered with or corrupted (checksum mismatch)', async () => {
    const encryptedJson = await encryptBackupPayload(sampleBackupData);
    const parsed = JSON.parse(encryptedJson);

    // Thay đổi 1 ký tự trong payload ciphertext
    const originalPayload = parsed.payload as string;
    const tamperedPayload = (originalPayload[0] === 'a' ? 'b' : 'a') + originalPayload.slice(1);
    parsed.payload = tamperedPayload;

    await expect(decryptBackupPayload(parsed)).rejects.toThrow(
      /lỗi xác thực toàn vẹn checksum/i
    );
  });

  it('throws an error on empty or invalid input', async () => {
    await expect(decryptBackupPayload('')).rejects.toThrow(/trống/i);
    await expect(decryptBackupPayload('{ invalid json')).rejects.toThrow(/JSON/i);
  });
});
