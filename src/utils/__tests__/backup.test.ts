import { describe, it, expect } from '@jest/globals';
import { validateBackupData, BackupData } from '../../database/backup';

describe('backup validation', () => {
  it('rejects null or non-object data', () => {
    expect(validateBackupData(null).valid).toBe(false);
    expect(validateBackupData('string').valid).toBe(false);
    expect(validateBackupData(undefined).valid).toBe(false);
  });

  it('rejects objects missing both wallets and transactions', () => {
    expect(validateBackupData({}).valid).toBe(false);
    expect(validateBackupData({ data: {} }).valid).toBe(false);
    expect(validateBackupData({ data: { categories: [] } }).valid).toBe(false);
  });

  it('accepts valid BackupData containing wallets and transactions', () => {
    const validData: BackupData = {
      app: 'multi-wallet-management',
      version: 1,
      exported_at: new Date().toISOString(),
      stats: {
        wallets_count: 1,
        categories_count: 0,
        debts_count: 0,
        transactions_count: 1,
        debt_payments_count: 0,
        planned_expenses_count: 0,
        contacts_count: 1,
      },
      data: {
        wallets: [
          {
            id: 'w_test',
            name: 'Test Wallet',
            type: 'cash',
            balance: 100000,
            credit_limit: 0,
            currency: 'VND',
            color: '#10B981',
            icon: 'cash-outline',
            is_excluded: 0,
            created_at: new Date().toISOString(),
          },
        ],
        categories: [],
        debts: [],
        transactions: [
          {
            id: 'tx_test',
            type: 'expense',
            amount: 50000,
            wallet_id: 'w_test',
            transacted_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            items: JSON.stringify([{ id: '1', name: 'Item 1', quantity: 1, price: 50000, assignedMemberIds: ['me'] }]),
          },
        ],
        debt_payments: [],
        planned_expenses: [],
        contacts: [
          {
            id: 'ct_1',
            name: 'Nguyen Van A',
            phone: '0901234567',
            created_at: new Date().toISOString(),
          },
        ],
      },
    };

    const result = validateBackupData(validData);
    expect(result.valid).toBe(true);
  });
});
