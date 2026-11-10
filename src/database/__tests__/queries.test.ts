import { describe, it, expect, jest } from '@jest/globals';
import { getTransactionCount, createDebt } from '../queries';

describe('getTransactionCount', () => {
  it('returns count from database query result', async () => {
    const mockDb = {
      getFirstAsync: async (query: string) => {
        if (query.includes('COUNT(*)')) {
          return { count: 125 };
        }
        return null;
      },
    } as any;

    const count = await getTransactionCount(mockDb);
    expect(count).toBe(125);
  });

  it('returns 0 if getFirstAsync returns null or empty', async () => {
    const mockDb = {
      getFirstAsync: async () => null,
    } as any;

    const count = await getTransactionCount(mockDb);
    expect(count).toBe(0);
  });
});

describe('createDebt', () => {
  it('creates debt without deducting wallet when wallet_id is null (ghi nợ không trừ ví)', async () => {
    const executedQueries: { sql: string; params: any[] }[] = [];
    const mockDb = {
      withTransactionAsync: async (cb: () => Promise<void>) => {
        await cb();
      },
      runAsync: async (sql: string, params: any[]) => {
        executedQueries.push({ sql, params });
      },
    } as any;

    await createDebt(mockDb, {
      id: 'debt_123',
      type: 'lend',
      person_name: 'Nam',
      initial_amount: 500000,
      wallet_id: null,
      note: 'Mượn tiền không trừ ví',
    });

    // 1 query inserted into debts table
    expect(executedQueries.length).toBe(1);
    expect(executedQueries[0].sql).toContain('INSERT INTO debts');
    expect(executedQueries[0].params[0]).toBe('debt_123');
    expect(executedQueries[0].params[1]).toBe('lend');
    expect(executedQueries[0].params[2]).toBe('Nam');
    expect(executedQueries[0].params[4]).toBe(500000); // initial
    expect(executedQueries[0].params[5]).toBe(500000); // remaining
    expect(executedQueries[0].params[6]).toBeNull(); // wallet_id is null

    // Ensure wallets and transactions were NOT updated
    const walletUpdates = executedQueries.filter(q => q.sql.includes('UPDATE wallets'));
    expect(walletUpdates.length).toBe(0);
    const txInserts = executedQueries.filter(q => q.sql.includes('INSERT INTO transactions'));
    expect(txInserts.length).toBe(0);
  });

  it('creates debt without deducting wallet when wallet_id is empty string', async () => {
    const executedQueries: { sql: string; params: any[] }[] = [];
    const mockDb = {
      withTransactionAsync: async (cb: () => Promise<void>) => {
        await cb();
      },
      runAsync: async (sql: string, params: any[]) => {
        executedQueries.push({ sql, params });
      },
    } as any;

    await createDebt(mockDb, {
      id: 'debt_124',
      type: 'borrow',
      person_name: 'Hùng',
      initial_amount: 300000,
      wallet_id: '   ',
      note: 'Vay không cộng ví',
    });

    expect(executedQueries.length).toBe(1);
    expect(executedQueries[0].sql).toContain('INSERT INTO debts');
    expect(executedQueries[0].params[6]).toBeNull();

    const walletUpdates = executedQueries.filter(q => q.sql.includes('UPDATE wallets'));
    expect(walletUpdates.length).toBe(0);
  });

  it('deducts wallet and creates transaction when wallet_id is provided for lend', async () => {
    const executedQueries: { sql: string; params: any[] }[] = [];
    const mockDb = {
      withTransactionAsync: async (cb: () => Promise<void>) => {
        await cb();
      },
      runAsync: async (sql: string, params: any[]) => {
        executedQueries.push({ sql, params });
      },
    } as any;

    await createDebt(mockDb, {
      id: 'debt_125',
      type: 'lend',
      person_name: 'Lan',
      initial_amount: 200000,
      wallet_id: 'w_cash',
      note: 'Cho mượn tiền mặt',
    });

    expect(executedQueries.length).toBe(3);
    // 1. debts insert
    expect(executedQueries[0].sql).toContain('INSERT INTO debts');
    expect(executedQueries[0].params[6]).toBe('w_cash');
    // 2. wallets update balance -
    expect(executedQueries[1].sql).toContain('UPDATE wallets SET balance = balance - ? WHERE id = ?');
    expect(executedQueries[1].params).toEqual([200000, 'w_cash']);
    // 3. transactions insert debt_lend
    expect(executedQueries[2].sql).toContain('INSERT INTO transactions');
    expect(executedQueries[2].params[1]).toBe('debt_lend');
    expect(executedQueries[2].params[2]).toBe(200000);
    expect(executedQueries[2].params[3]).toBe('w_cash');
  });

  it('adds to wallet and creates transaction when wallet_id is provided for borrow', async () => {
    const executedQueries: { sql: string; params: any[] }[] = [];
    const mockDb = {
      withTransactionAsync: async (cb: () => Promise<void>) => {
        await cb();
      },
      runAsync: async (sql: string, params: any[]) => {
        executedQueries.push({ sql, params });
      },
    } as any;

    await createDebt(mockDb, {
      id: 'debt_126',
      type: 'borrow',
      person_name: 'Bình',
      initial_amount: 1000000,
      wallet_id: 'w_vcb',
      note: 'Vay chuyển khoản',
    });

    expect(executedQueries.length).toBe(3);
    // 1. debts insert
    expect(executedQueries[0].sql).toContain('INSERT INTO debts');
    expect(executedQueries[0].params[6]).toBe('w_vcb');
    // 2. wallets update balance +
    expect(executedQueries[1].sql).toContain('UPDATE wallets SET balance = balance + ? WHERE id = ?');
    expect(executedQueries[1].params).toEqual([1000000, 'w_vcb']);
    // 3. transactions insert debt_borrow
    expect(executedQueries[2].sql).toContain('INSERT INTO transactions');
    expect(executedQueries[2].params[1]).toBe('debt_borrow');
  });

  it('throws error when initial_amount is <= 0', async () => {
    const mockDb = {
      withTransactionAsync: async (cb: () => Promise<void>) => {
        await cb();
      },
    } as any;

    await expect(
      createDebt(mockDb, {
        id: 'debt_127',
        type: 'lend',
        person_name: 'An',
        initial_amount: 0,
        wallet_id: null,
      })
    ).rejects.toThrow('Số tiền ghi nợ phải lớn hơn 0');
  });
});
