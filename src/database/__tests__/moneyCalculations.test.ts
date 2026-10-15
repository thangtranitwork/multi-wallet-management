import { describe, it, expect, jest } from '@jest/globals';
import {
  createTransaction,
  processDebtPayment,
  createCreditExpenseWithPlan,
} from '../queries';
import { Wallet, Debt } from '../../types';

function createMockDb(initialWallets: Wallet[] = [], initialDebts: Debt[] = []) {
  const wallets = new Map<string, Wallet>(initialWallets.map(w => [w.id, { ...w }]));
  const debts = new Map<string, Debt>(initialDebts.map(d => [d.id, { ...d }]));
  const queries: { sql: string; params?: any[] }[] = [];

  const mockDb: any = {
    queries,
    wallets,
    debts,
    withTransactionAsync: async (cb: () => Promise<any>) => {
      return await cb();
    },
    getFirstAsync: async (sql: string, params: any[] = []) => {
      queries.push({ sql, params });
      if (sql.includes('FROM wallets') && (sql.includes('id = ?') || sql.includes('w.id = ?'))) {
        const w = wallets.get(params[0]);
        return w ? { ...w } : null;
      }
      if (sql.includes('FROM debts') && (sql.includes('id = ?') || sql.includes('d.id = ?'))) {
        const d = debts.get(params[0]);
        return d ? { ...d } : null;
      }
      return null;
    },
    runAsync: async (sql: string, params: any[] = []) => {
      queries.push({ sql, params });
      if (sql.includes('UPDATE wallets SET balance = balance - ? WHERE id = ?')) {
        const amount = params[0];
        const id = params[1];
        const w = wallets.get(id);
        if (w) w.balance -= amount;
      } else if (sql.includes('UPDATE wallets SET balance = balance + ? WHERE id = ?')) {
        const amount = params[0];
        const id = params[1];
        const w = wallets.get(id);
        if (w) w.balance += amount;
      } else if (sql.includes('UPDATE debts SET remaining_amount = ?, status = ? WHERE id = ?')) {
        const [rem, status, id] = params;
        const d = debts.get(id);
        if (d) {
          d.remaining_amount = rem;
          d.status = status;
        }
      }
      return { changes: 1, lastInsertRowId: 1 };
    },
    getAllAsync: async (sql: string, params: any[] = []) => {
      queries.push({ sql, params });
      return [];
    },
  };

  return mockDb;
}

describe('Money Calculations & Validations', () => {
  describe('createTransaction', () => {
    const mockWalletA: Wallet = {
      id: 'w_cash',
      name: 'Tiền mặt',
      type: 'cash',
      balance: 1000000,
      credit_limit: 0,
      currency: 'VND',
      color: '#10B981',
      icon: 'cash-outline',
      is_excluded: 0,
      created_at: new Date().toISOString(),
    };

    const mockWalletB: Wallet = {
      id: 'w_bank',
      name: 'Ngân hàng',
      type: 'bank',
      balance: 500000,
      credit_limit: 0,
      currency: 'VND',
      color: '#3B82F6',
      icon: 'card-outline',
      is_excluded: 0,
      created_at: new Date().toISOString(),
    };

    it('rounds floating-point amounts to integer VND on expense', async () => {
      const db = createMockDb([mockWalletA]);
      await createTransaction(db, {
        id: 'tx_1',
        type: 'expense',
        amount: 45678.9,
        wallet_id: 'w_cash',
        transacted_at: new Date().toISOString(),
      });

      const updated = db.wallets.get('w_cash');
      expect(updated?.balance).toBe(1000000 - 45679);
    });

    it('rounds floating-point amounts to integer VND on income', async () => {
      const db = createMockDb([mockWalletA]);
      await createTransaction(db, {
        id: 'tx_2',
        type: 'income',
        amount: 20000.4,
        wallet_id: 'w_cash',
        transacted_at: new Date().toISOString(),
      });

      const updated = db.wallets.get('w_cash');
      expect(updated?.balance).toBe(1000000 + 20000);
    });

    it('throws error on transfer if to_wallet_id is missing', async () => {
      const db = createMockDb([mockWalletA, mockWalletB]);
      await expect(
        createTransaction(db, {
          id: 'tx_err',
          type: 'transfer',
          amount: 100000,
          wallet_id: 'w_cash',
          to_wallet_id: null,
          transacted_at: new Date().toISOString(),
        })
      ).rejects.toThrow('Giao dịch chuyển tiền yêu cầu chọn ví nhận');
    });

    it('throws error on transfer if source and destination wallets are identical', async () => {
      const db = createMockDb([mockWalletA]);
      await expect(
        createTransaction(db, {
          id: 'tx_err',
          type: 'transfer',
          amount: 100000,
          wallet_id: 'w_cash',
          to_wallet_id: 'w_cash',
          transacted_at: new Date().toISOString(),
        })
      ).rejects.toThrow('Ví gửi và ví nhận không được trùng nhau');
    });

    it('throws error on transfer if target wallet does not exist', async () => {
      const db = createMockDb([mockWalletA]);
      await expect(
        createTransaction(db, {
          id: 'tx_err',
          type: 'transfer',
          amount: 100000,
          wallet_id: 'w_cash',
          to_wallet_id: 'non_existent_wallet',
          transacted_at: new Date().toISOString(),
        })
      ).rejects.toThrow('Ví nhận không tồn tại');
    });

    it('successfully transfers rounded integer money between wallets', async () => {
      const db = createMockDb([mockWalletA, mockWalletB]);
      await createTransaction(db, {
        id: 'tx_transfer',
        type: 'transfer',
        amount: 150000.75,
        wallet_id: 'w_cash',
        to_wallet_id: 'w_bank',
        transacted_at: new Date().toISOString(),
      });

      const wA = db.wallets.get('w_cash');
      const wB = db.wallets.get('w_bank');

      expect(wA?.balance).toBe(1000000 - 150001);
      expect(wB?.balance).toBe(500000 + 150001);
    });

    it('throws error if transaction amount is zero or negative', async () => {
      const db = createMockDb([mockWalletA]);
      await expect(
        createTransaction(db, {
          id: 'tx_neg',
          type: 'expense',
          amount: 0,
          wallet_id: 'w_cash',
          transacted_at: new Date().toISOString(),
        })
      ).rejects.toThrow('Số tiền giao dịch phải lớn hơn 0');

      await expect(
        createTransaction(db, {
          id: 'tx_neg2',
          type: 'expense',
          amount: -50000,
          wallet_id: 'w_cash',
          transacted_at: new Date().toISOString(),
        })
      ).rejects.toThrow('Số tiền giao dịch phải lớn hơn 0');
    });
  });

  describe('processDebtPayment', () => {
    const mockWallet: Wallet = {
      id: 'w_main',
      name: 'Ví chính',
      type: 'cash',
      balance: 2000000,
      credit_limit: 0,
      currency: 'VND',
      color: '#10B981',
      icon: 'cash-outline',
      is_excluded: 0,
      created_at: new Date().toISOString(),
    };

    const mockLendDebt: Debt = {
      id: 'd_lend',
      type: 'lend',
      person_name: 'Nguyen Van A',
      initial_amount: 500000,
      remaining_amount: 500000,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    const mockBorrowDebt: Debt = {
      id: 'd_borrow',
      type: 'borrow',
      person_name: 'Tran Thi B',
      initial_amount: 800000,
      remaining_amount: 800000,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    it('handles partial debt repayment and updates status to partially_paid', async () => {
      const db = createMockDb([mockWallet], [mockLendDebt]);
      await processDebtPayment(db, {
        debtId: 'd_lend',
        amount: 200000,
        walletId: 'w_main',
      });

      const debt = db.debts.get('d_lend');
      const wallet = db.wallets.get('w_main');

      expect(debt?.remaining_amount).toBe(300000);
      expect(debt?.status).toBe('partially_paid');
      // Lend: someone pays us back -> wallet balance increases
      expect(wallet?.balance).toBe(2000000 + 200000);
    });

    it('caps overpayment at remaining amount and marks status as settled', async () => {
      const db = createMockDb([mockWallet], [mockBorrowDebt]);
      await processDebtPayment(db, {
        debtId: 'd_borrow',
        amount: 1000000, // exceeds remaining 800,000
        walletId: 'w_main',
      });

      const debt = db.debts.get('d_borrow');
      const wallet = db.wallets.get('w_main');

      expect(debt?.remaining_amount).toBe(0);
      expect(debt?.status).toBe('settled');
      // Borrow: we pay them back -> wallet balance decreases by actual remaining (800,000)
      expect(wallet?.balance).toBe(2000000 - 800000);
    });

    it('throws error if debt repayment amount is zero or negative', async () => {
      const db = createMockDb([mockWallet], [mockBorrowDebt]);
      await expect(
        processDebtPayment(db, {
          debtId: 'd_borrow',
          amount: 0,
          walletId: 'w_main',
        })
      ).rejects.toThrow('Số tiền thanh toán nợ phải lớn hơn 0');

      await expect(
        processDebtPayment(db, {
          debtId: 'd_borrow',
          amount: -100000,
          walletId: 'w_main',
        })
      ).rejects.toThrow('Số tiền thanh toán nợ phải lớn hơn 0');
    });
  });

  describe('createCreditExpenseWithPlan', () => {
    const mockCreditWallet: Wallet = {
      id: 'w_credit',
      name: 'VPBank StepUp',
      type: 'credit',
      balance: 10000000, // Credit limit remaining
      credit_limit: 20000000,
      currency: 'VND',
      color: '#EF4444',
      icon: 'card',
      is_excluded: 0,
      created_at: new Date().toISOString(),
    };

    it('correctly splits installment principal with remainder in the final term', async () => {
      const db = createMockDb([mockCreditWallet]);
      // 1,000,000 divided into 3 terms:
      // term 1: Math.floor(1000000 / 3) = 333,333
      // term 2: 333,333
      // term 3 (remainder): 1000000 - (333333 * 2) = 333,334
      // Fee per installment: 10,000 * 3 = 30,000
      // Total remaining credit reduction: 1,000,000 + 30,000 = 1,030,000
      await createCreditExpenseWithPlan(db, {
        creditWalletId: 'w_credit',
        amount: 1000000,
        isInstallment: true,
        installmentCount: 3,
        feePerInstallment: 10000,
        firstDueDate: '2026-11-15',
        note: 'Mua laptop',
        transactedAt: new Date().toISOString(),
      });

      const creditWallet = db.wallets.get('w_credit');
      expect(creditWallet?.balance).toBe(10000000 - 1030000);

      // Verify planned expense inserts
      const planInserts = db.queries.filter((q: any) => q.sql.includes('INSERT INTO planned_expenses'));
      expect(planInserts.length).toBe(3);

      // Check principal of each term (termPrincipal + fee in target_amount)
      // params: [id, title, target_amount, ...]
      const term1Amount = planInserts[0].params?.[2];
      const term2Amount = planInserts[1].params?.[2];
      const term3Amount = planInserts[2].params?.[2];

      expect(term1Amount).toBe(333333 + 10000);
      expect(term2Amount).toBe(333333 + 10000);
      expect(term3Amount).toBe(333334 + 10000);
      expect(term1Amount + term2Amount + term3Amount).toBe(1030000);
    });

    it('correctly accounts for pre-paid installments', async () => {
      const db = createMockDb([mockCreditWallet]);
      // 1,200,000 in 4 terms = 300,000 each
      // paidInstallmentCount: 1 (term 1 already paid before entering app)
      // remaining terms: 2, 3, 4 (3 terms)
      // remaining amount: 3 * 300,000 = 900,000
      await createCreditExpenseWithPlan(db, {
        creditWalletId: 'w_credit',
        amount: 1200000,
        isInstallment: true,
        installmentCount: 4,
        paidInstallmentCount: 1,
        feePerInstallment: 0,
        firstDueDate: '2026-11-15',
        note: 'Tủ lạnh',
        transactedAt: new Date().toISOString(),
      });

      const creditWallet = db.wallets.get('w_credit');
      expect(creditWallet?.balance).toBe(10000000 - 900000);

      const planInserts = db.queries.filter((q: any) => q.sql.includes('INSERT INTO planned_expenses'));
      expect(planInserts.length).toBe(3); // only 3 unpaid terms created
    });

    it('throws error if credit expense amount is zero or negative', async () => {
      const db = createMockDb([mockCreditWallet]);
      await expect(
        createCreditExpenseWithPlan(db, {
          creditWalletId: 'w_credit',
          amount: 0,
          firstDueDate: '2026-11-15',
          transactedAt: new Date().toISOString(),
        })
      ).rejects.toThrow('Số tiền chi tiêu thẻ tín dụng phải lớn hơn 0');

      await expect(
        createCreditExpenseWithPlan(db, {
          creditWalletId: 'w_credit',
          amount: -500000,
          firstDueDate: '2026-11-15',
          transactedAt: new Date().toISOString(),
        })
      ).rejects.toThrow('Số tiền chi tiêu thẻ tín dụng phải lớn hơn 0');
    });
  });
});
