import * as SQLite from 'expo-sqlite';
import {
  Wallet,
  Transaction,
  Debt,
  DebtPayment,
  Category,
  FinancialSummary,
  CategorySpending,
  PlannedExpense,
  PlannedExpenseStatus,
} from '../types';

// ==================== WALLET QUERIES ====================

export async function getWallets(db: SQLite.SQLiteDatabase): Promise<Wallet[]> {
  return await db.getAllAsync<Wallet>(
    'SELECT * FROM wallets ORDER BY created_at ASC'
  );
}

export async function getWalletById(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<Wallet | null> {
  return await db.getFirstAsync<Wallet>(
    'SELECT * FROM wallets WHERE id = ?',
    [id]
  );
}

export async function createWallet(
  db: SQLite.SQLiteDatabase,
  wallet: Omit<Wallet, 'created_at'>
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO wallets (id, name, type, balance, credit_limit, currency, color, icon, is_excluded, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      wallet.id,
      wallet.name,
      wallet.type,
      wallet.balance,
      wallet.credit_limit || 0,
      wallet.currency || 'VND',
      wallet.color,
      wallet.icon,
      wallet.is_excluded ? 1 : 0,
      wallet.note || '',
      now,
    ]
  );
}

export async function updateWallet(
  db: SQLite.SQLiteDatabase,
  wallet: Partial<Wallet> & { id: string }
): Promise<void> {
  await db.runAsync(
    `UPDATE wallets 
     SET name = COALESCE(?, name),
         type = COALESCE(?, type),
         credit_limit = COALESCE(?, credit_limit),
         color = COALESCE(?, color),
         icon = COALESCE(?, icon),
         is_excluded = COALESCE(?, is_excluded),
         note = COALESCE(?, note)
     WHERE id = ?`,
    [
      wallet.name ?? null,
      wallet.type ?? null,
      wallet.credit_limit ?? null,
      wallet.color ?? null,
      wallet.icon ?? null,
      wallet.is_excluded !== undefined ? (wallet.is_excluded ? 1 : 0) : null,
      wallet.note ?? null,
      wallet.id,
    ]
  );
}

export async function adjustWalletBalance(
  db: SQLite.SQLiteDatabase,
  walletId: string,
  newBalance: number,
  note?: string
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const wallet = await getWalletById(db, walletId);
    if (!wallet) return;

    const diff = newBalance - wallet.balance;
    if (diff === 0) return;

    await db.runAsync(
      'UPDATE wallets SET balance = ? WHERE id = ?',
      [newBalance, walletId]
    );

    const txId = 'adj_' + Date.now();
    const now = new Date().toISOString();
    const isIncome = diff > 0;

    await db.runAsync(
      `INSERT INTO transactions (id, type, amount, wallet_id, note, transacted_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        txId,
        isIncome ? 'income' : 'expense',
        Math.abs(diff),
        walletId,
        note ? `Điều chỉnh số dư: ${note}` : 'Điều chỉnh số dư ví',
        now,
        now,
      ]
    );
  });
}

export async function deleteWallet(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM wallets WHERE id = ?', [id]);
}

// ==================== TRANSACTION QUERIES ====================

export async function getTransactions(
  db: SQLite.SQLiteDatabase,
  options?: { walletId?: string; type?: string; limit?: number; offset?: number }
): Promise<Transaction[]> {
  let query = `
    SELECT 
      t.*,
      w.name as wallet_name,
      tw.name as to_wallet_name,
      c.name as category_name,
      c.icon as category_icon,
      c.color as category_color,
      d.person_name as person_name
    FROM transactions t
    LEFT JOIN wallets w ON t.wallet_id = w.id
    LEFT JOIN wallets tw ON t.to_wallet_id = tw.id
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN debts d ON t.debt_id = d.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (options?.walletId) {
    query += ' AND (t.wallet_id = ? OR t.to_wallet_id = ?)';
    params.push(options.walletId, options.walletId);
  }

  if (options?.type) {
    query += ' AND t.type = ?';
    params.push(options.type);
  }

  query += ' ORDER BY t.transacted_at DESC';

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  return await db.getAllAsync<Transaction>(query, params);
}

export async function createTransaction(
  db: SQLite.SQLiteDatabase,
  tx: {
    id: string;
    type: 'expense' | 'income' | 'transfer';
    amount: number;
    wallet_id: string;
    to_wallet_id?: string | null;
    category_id?: string | null;
    note?: string;
    transacted_at: string;
  }
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const now = new Date().toISOString();

    if (tx.type === 'expense') {
      await db.runAsync(
        'UPDATE wallets SET balance = balance - ? WHERE id = ?',
        [tx.amount, tx.wallet_id]
      );
    } else if (tx.type === 'income') {
      await db.runAsync(
        'UPDATE wallets SET balance = balance + ? WHERE id = ?',
        [tx.amount, tx.wallet_id]
      );
    } else if (tx.type === 'transfer' && tx.to_wallet_id) {
      // Trừ ví nguồn, cộng ví đích
      await db.runAsync(
        'UPDATE wallets SET balance = balance - ? WHERE id = ?',
        [tx.amount, tx.wallet_id]
      );
      await db.runAsync(
        'UPDATE wallets SET balance = balance + ? WHERE id = ?',
        [tx.amount, tx.to_wallet_id]
      );
    }

    await db.runAsync(
      `INSERT INTO transactions (id, type, amount, wallet_id, to_wallet_id, category_id, note, transacted_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tx.id,
        tx.type,
        tx.amount,
        tx.wallet_id,
        tx.to_wallet_id || null,
        tx.category_id || null,
        tx.note || '',
        tx.transacted_at,
        now,
      ]
    );
  });
}

export async function deleteTransaction(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const tx = await db.getFirstAsync<Transaction>(
      'SELECT * FROM transactions WHERE id = ?',
      [id]
    );
    if (!tx) return;

    // Hoàn tác số dư
    if (tx.type === 'expense' || tx.type === 'debt_lend' || tx.type === 'debt_repay') {
      await db.runAsync(
        'UPDATE wallets SET balance = balance + ? WHERE id = ?',
        [tx.amount, tx.wallet_id]
      );
    } else if (tx.type === 'income' || tx.type === 'debt_borrow' || tx.type === 'debt_collect') {
      await db.runAsync(
        'UPDATE wallets SET balance = balance - ? WHERE id = ?',
        [tx.amount, tx.wallet_id]
      );
    } else if (tx.type === 'transfer' && tx.to_wallet_id) {
      await db.runAsync(
        'UPDATE wallets SET balance = balance + ? WHERE id = ?',
        [tx.amount, tx.wallet_id]
      );
      await db.runAsync(
        'UPDATE wallets SET balance = balance - ? WHERE id = ?',
        [tx.amount, tx.to_wallet_id]
      );
    }

    await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
  });
}

// ==================== DEBT & LOAN QUERIES ====================

export async function getDebts(
  db: SQLite.SQLiteDatabase,
  type?: 'lend' | 'borrow'
): Promise<Debt[]> {
  let query = `
    SELECT d.*, w.name as wallet_name
    FROM debts d
    LEFT JOIN wallets w ON d.wallet_id = w.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (type) {
    query += ' AND d.type = ?';
    params.push(type);
  }

  query += ' ORDER BY d.status ASC, d.created_at DESC';
  return await db.getAllAsync<Debt>(query, params);
}

export async function getDebtById(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<Debt | null> {
  return await db.getFirstAsync<Debt>(
    `SELECT d.*, w.name as wallet_name
     FROM debts d
     LEFT JOIN wallets w ON d.wallet_id = w.id
     WHERE d.id = ?`,
    [id]
  );
}

export async function getDebtPayments(
  db: SQLite.SQLiteDatabase,
  debtId: string
): Promise<DebtPayment[]> {
  return await db.getAllAsync<DebtPayment>(
    `SELECT dp.*, w.name as wallet_name
     FROM debt_payments dp
     LEFT JOIN wallets w ON dp.wallet_id = w.id
     WHERE dp.debt_id = ?
     ORDER BY dp.paid_at DESC`,
    [debtId]
  );
}

export async function createDebt(
  db: SQLite.SQLiteDatabase,
  debt: {
    id: string;
    type: 'lend' | 'borrow';
    person_name: string;
    person_phone?: string | null;
    initial_amount: number;
    wallet_id?: string | null;
    due_date?: string | null;
    note?: string;
  }
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const now = new Date().toISOString();

    // 1. Cập nhật số dư ví nếu có liên kết ví
    if (debt.wallet_id) {
      if (debt.type === 'lend') {
        // Cho vay: trừ tiền từ ví
        await db.runAsync(
          'UPDATE wallets SET balance = balance - ? WHERE id = ?',
          [debt.initial_amount, debt.wallet_id]
        );
        // Lưu giao dịch tương ứng
        await db.runAsync(
          `INSERT INTO transactions (id, type, amount, wallet_id, debt_id, note, transacted_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'tx_' + Date.now(),
            'debt_lend',
            debt.initial_amount,
            debt.wallet_id,
            debt.id,
            `Cho ${debt.person_name} mượn: ${debt.note || ''}`.trim(),
            now,
            now,
          ]
        );
      } else {
        // Đi vay: cộng tiền vào ví
        await db.runAsync(
          'UPDATE wallets SET balance = balance + ? WHERE id = ?',
          [debt.initial_amount, debt.wallet_id]
        );
        await db.runAsync(
          `INSERT INTO transactions (id, type, amount, wallet_id, debt_id, note, transacted_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'tx_' + Date.now(),
            'debt_borrow',
            debt.initial_amount,
            debt.wallet_id,
            debt.id,
            `Vay tiền từ ${debt.person_name}: ${debt.note || ''}`.trim(),
            now,
            now,
          ]
        );
      }
    }

    // 2. Lưu vào bảng debts
    await db.runAsync(
      `INSERT INTO debts (id, type, person_name, person_phone, initial_amount, remaining_amount, wallet_id, due_date, status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        debt.id,
        debt.type,
        debt.person_name,
        debt.person_phone || null,
        debt.initial_amount,
        debt.initial_amount,
        debt.wallet_id || null,
        debt.due_date || null,
        debt.note || '',
        now,
      ]
    );
  });
}

export async function processDebtPayment(
  db: SQLite.SQLiteDatabase,
  params: {
    debtId: string;
    amount: number;
    walletId: string;
    note?: string;
  }
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const debt = await getDebtById(db, params.debtId);
    if (!debt) throw new Error('Khoản nợ không tồn tại');

    const paymentAmount = Math.min(params.amount, debt.remaining_amount);
    const newRemaining = Math.max(0, debt.remaining_amount - paymentAmount);
    const newStatus = newRemaining <= 0 ? 'settled' : 'partially_paid';
    const now = new Date().toISOString();
    const paymentId = 'dp_' + Date.now();

    // 1. Cập nhật bảng debts
    await db.runAsync(
      'UPDATE debts SET remaining_amount = ?, status = ? WHERE id = ?',
      [newRemaining, newStatus, params.debtId]
    );

    // 2. Thêm vào debt_payments
    await db.runAsync(
      `INSERT INTO debt_payments (id, debt_id, amount, wallet_id, paid_at, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [paymentId, params.debtId, paymentAmount, params.walletId, now, params.note || '']
    );

    // 3. Biến động số dư ví & tạo transaction
    if (debt.type === 'lend') {
      // Người khác trả nợ mình -> Tiền vào ví
      await db.runAsync(
        'UPDATE wallets SET balance = balance + ? WHERE id = ?',
        [paymentAmount, params.walletId]
      );
      await db.runAsync(
        `INSERT INTO transactions (id, type, amount, wallet_id, debt_id, note, transacted_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'tx_' + Date.now(),
          'debt_collect',
          paymentAmount,
          params.walletId,
          debt.id,
          `Thu nợ từ ${debt.person_name}: ${params.note || ''}`.trim(),
          now,
          now,
        ]
      );
    } else {
      // Mình trả nợ người ta -> Trừ tiền ví
      await db.runAsync(
        'UPDATE wallets SET balance = balance - ? WHERE id = ?',
        [paymentAmount, params.walletId]
      );
      await db.runAsync(
        `INSERT INTO transactions (id, type, amount, wallet_id, debt_id, note, transacted_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'tx_' + Date.now(),
          'debt_repay',
          paymentAmount,
          params.walletId,
          debt.id,
          `Trả nợ cho ${debt.person_name}: ${params.note || ''}`.trim(),
          now,
          now,
        ]
      );
    }
  });
}

export async function deleteDebt(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM debts WHERE id = ?', [id]);
}

// ==================== CATEGORY QUERIES ====================

export async function getCategories(
  db: SQLite.SQLiteDatabase,
  type?: 'expense' | 'income'
): Promise<Category[]> {
  if (type) {
    return await db.getAllAsync<Category>(
      'SELECT * FROM categories WHERE type = ? ORDER BY name ASC',
      [type]
    );
  }
  return await db.getAllAsync<Category>(
    'SELECT * FROM categories ORDER BY type ASC, name ASC'
  );
}

export async function createCategory(
  db: SQLite.SQLiteDatabase,
  category: Category
): Promise<void> {
  await db.runAsync(
    `INSERT INTO categories (id, name, type, icon, color)
     VALUES (?, ?, ?, ?, ?)`,
    [category.id, category.name, category.type, category.icon, category.color]
  );
}

export async function updateCategory(
  db: SQLite.SQLiteDatabase,
  category: Partial<Category> & { id: string }
): Promise<void> {
  await db.runAsync(
    `UPDATE categories
     SET name = COALESCE(?, name),
         type = COALESCE(?, type),
         icon = COALESCE(?, icon),
         color = COALESCE(?, color)
     WHERE id = ?`,
    [
      category.name ?? null,
      category.type ?? null,
      category.icon ?? null,
      category.color ?? null,
      category.id,
    ]
  );
}

export async function deleteCategory(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.withTransactionAsync(async () => {
    // Gỡ liên kết trong transactions trước
    await db.runAsync('UPDATE transactions SET category_id = NULL WHERE category_id = ?', [id]);
    await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
  });
}

// ==================== APP SETTINGS QUERIES ====================

export async function getAppSetting(
  db: SQLite.SQLiteDatabase,
  key: string,
  defaultValue = ''
): Promise<string> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key]
  );
  return row ? row.value : defaultValue;
}

export async function setAppSetting(
  db: SQLite.SQLiteDatabase,
  key: string,
  value: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO app_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

export async function getAllAppSettings(
  db: SQLite.SQLiteDatabase
): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM app_settings'
  );
  const result: Record<string, string> = {};
  for (const r of rows) {
    result[r.key] = r.value;
  }
  return result;
}


export async function getFinancialSummary(
  db: SQLite.SQLiteDatabase
): Promise<FinancialSummary> {
  const wallets = await getWallets(db);

  // Tính tổng tài sản từ ví (chỉ ví không excluded)
  let totalWalletPositive = 0;
  let totalCreditDebt = 0;

  for (const w of wallets) {
    if (w.is_excluded) continue;
    if (w.type === 'credit') {
      // Với thẻ tín dụng, số dư âm là dư nợ
      if (w.balance < 0) {
        totalCreditDebt += Math.abs(w.balance);
      } else {
        totalWalletPositive += w.balance;
      }
    } else {
      if (w.balance >= 0) {
        totalWalletPositive += w.balance;
      } else {
        totalCreditDebt += Math.abs(w.balance);
      }
    }
  }

  // Tiền người khác nợ mình (Lend)
  const lentRes = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(remaining_amount) as total FROM debts WHERE type = 'lend' AND status != 'settled'`
  );
  const totalLent = lentRes?.total || 0;

  // Tiền mình nợ người khác (Borrow)
  const borrowRes = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(remaining_amount) as total FROM debts WHERE type = 'borrow' AND status != 'settled'`
  );
  const totalBorrowed = borrowRes?.total || 0;

  // Tổng tài sản = Tiền trong các ví + Tiền cho vay (phải thu)
  const totalAssets = totalWalletPositive + totalLent;

  // Tổng nợ = Dư nợ thẻ + Tiền đi vay (phải trả)
  const totalLiabilities = totalCreditDebt + totalBorrowed;

  // Tài sản ròng
  const netWorth = totalAssets - totalLiabilities;

  // Thu chi trong tháng hiện tại
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startIso = startOfMonth.toISOString();

  const incRes = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(amount) as total FROM transactions WHERE type = 'income' AND transacted_at >= ?`,
    [startIso]
  );
  const monthIncome = incRes?.total || 0;

  const expRes = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(amount) as total FROM transactions WHERE type = 'expense' AND transacted_at >= ?`,
    [startIso]
  );
  const monthExpense = expRes?.total || 0;

  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    monthIncome,
    monthExpense,
    monthNet: monthIncome - monthExpense,
    totalLent,
    totalBorrowed,
    walletCount: wallets.length,
  };
}

export async function getCategorySpending(
  db: SQLite.SQLiteDatabase
): Promise<CategorySpending[]> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startIso = startOfMonth.toISOString();

  const rows = await db.getAllAsync<{
    category_id: string;
    category_name: string;
    category_icon: string;
    category_color: string;
    total_amount: number;
  }>(
    `SELECT 
       c.id as category_id,
       c.name as category_name,
       c.icon as category_icon,
       c.color as category_color,
       SUM(t.amount) as total_amount
     FROM transactions t
     INNER JOIN categories c ON t.category_id = c.id
     WHERE t.type = 'expense' AND t.transacted_at >= ?
     GROUP BY c.id
     ORDER BY total_amount DESC`,
    [startIso]
  );

  const total = rows.reduce((sum, r) => sum + r.total_amount, 0);

  return rows.map(r => ({
    ...r,
    percentage: total > 0 ? Math.round((r.total_amount / total) * 100) : 0,
  }));
}

export interface RangeAnalytics {
  income: number;
  expense: number;
  net: number;
  savingsRate: number; // %
  categorySpendings: CategorySpending[];
}

export async function getAnalyticsByRange(
  db: SQLite.SQLiteDatabase,
  startDateIso?: string | null,
  endDateIso?: string | null
): Promise<RangeAnalytics> {
  let whereIncome = "WHERE type = 'income'";
  let whereExpense = "WHERE type = 'expense'";
  let whereCatExpense = "WHERE t.type = 'expense'";
  const paramsIncome: any[] = [];
  const paramsExpense: any[] = [];

  if (startDateIso) {
    whereIncome += " AND transacted_at >= ?";
    whereExpense += " AND transacted_at >= ?";
    whereCatExpense += " AND t.transacted_at >= ?";
    paramsIncome.push(startDateIso);
    paramsExpense.push(startDateIso);
  }
  if (endDateIso) {
    whereIncome += " AND transacted_at <= ?";
    whereExpense += " AND transacted_at <= ?";
    whereCatExpense += " AND t.transacted_at <= ?";
    paramsIncome.push(endDateIso);
    paramsExpense.push(endDateIso);
  }

  const incRes = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(amount) as total FROM transactions ${whereIncome}`,
    paramsIncome
  );
  const income = incRes?.total || 0;

  const expRes = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(amount) as total FROM transactions ${whereExpense}`,
    paramsExpense
  );
  const expense = expRes?.total || 0;

  const catRows = await db.getAllAsync<{
    category_id: string;
    category_name: string;
    category_icon: string;
    category_color: string;
    total_amount: number;
  }>(
    `SELECT 
       c.id as category_id,
       c.name as category_name,
       c.icon as category_icon,
       c.color as category_color,
       SUM(t.amount) as total_amount
     FROM transactions t
     INNER JOIN categories c ON t.category_id = c.id
     ${whereCatExpense}
     GROUP BY c.id
     ORDER BY total_amount DESC`,
    paramsExpense
  );

  const totalCatExp = catRows.reduce((sum, r) => sum + r.total_amount, 0);
  const categorySpendings: CategorySpending[] = catRows.map(r => ({
    ...r,
    percentage: totalCatExp > 0 ? Math.round((r.total_amount / totalCatExp) * 100) : 0,
  }));

  const net = income - expense;
  const savingsRate = income > 0 ? Math.max(0, Math.round((net / income) * 100)) : 0;

  return {
    income,
    expense,
    net,
    savingsRate,
    categorySpendings,
  };
}

// ==================== PLANNED EXPENSES QUERIES ====================

export async function getPlannedExpenses(
  db: SQLite.SQLiteDatabase,
  status?: PlannedExpenseStatus
): Promise<PlannedExpense[]> {
  let sql = `
    SELECT pe.*,
           w.name as wallet_name, w.color as wallet_color, w.icon as wallet_icon,
           c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM planned_expenses pe
    LEFT JOIN wallets w ON pe.wallet_id = w.id
    LEFT JOIN categories c ON pe.category_id = c.id
  `;
  const params: any[] = [];
  if (status) {
    sql += ' WHERE pe.status = ?';
    params.push(status);
  }
  sql += ` ORDER BY 
    CASE pe.status
      WHEN 'pending' THEN 1
      WHEN 'executed' THEN 2
      ELSE 3
    END,
    pe.target_date ASC`;

  return await db.getAllAsync<PlannedExpense>(sql, params);
}

export async function createPlannedExpense(
  db: SQLite.SQLiteDatabase,
  expense: {
    id: string;
    title: string;
    amount: number;
    target_date: string;
    wallet_id?: string | null;
    category_id?: string | null;
    note?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO planned_expenses (id, title, amount, target_date, wallet_id, category_id, status, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [
      expense.id,
      expense.title,
      expense.amount,
      expense.target_date,
      expense.wallet_id || null,
      expense.category_id || null,
      expense.note || '',
      now,
    ]
  );
}

export async function updatePlannedExpense(
  db: SQLite.SQLiteDatabase,
  expense: Partial<PlannedExpense> & { id: string }
): Promise<void> {
  await db.runAsync(
    `UPDATE planned_expenses
     SET title = COALESCE(?, title),
         amount = COALESCE(?, amount),
         target_date = COALESCE(?, target_date),
         wallet_id = COALESCE(?, wallet_id),
         category_id = COALESCE(?, category_id),
         status = COALESCE(?, status),
         actual_amount = COALESCE(?, actual_amount),
         note = COALESCE(?, note)
     WHERE id = ?`,
    [
      expense.title ?? null,
      expense.amount ?? null,
      expense.target_date ?? null,
      expense.wallet_id ?? null,
      expense.category_id ?? null,
      expense.status ?? null,
      expense.actual_amount ?? null,
      expense.note ?? null,
      expense.id,
    ]
  );
}

export async function executePlannedExpense(
  db: SQLite.SQLiteDatabase,
  params: {
    id: string;
    actualAmount: number;
    walletId: string;
    transactedAt?: string;
    note?: string;
  }
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const planned = await db.getFirstAsync<PlannedExpense>(
      'SELECT * FROM planned_expenses WHERE id = ?',
      [params.id]
    );
    if (!planned) throw new Error('Khoản dự chi không tồn tại');

    const now = new Date().toISOString();
    const transactedAt = params.transactedAt || now;
    const txId = 'tx_' + Date.now();

    // 1. Cập nhật trạng thái khoản dự chi thành 'executed'
    await db.runAsync(
      `UPDATE planned_expenses
       SET status = 'executed',
           actual_amount = ?,
           wallet_id = ?
       WHERE id = ?`,
      [params.actualAmount, params.walletId, params.id]
    );

    // 2. Trừ số dư ví
    await db.runAsync(
      'UPDATE wallets SET balance = balance - ? WHERE id = ?',
      [params.actualAmount, params.walletId]
    );

    // 3. Thêm giao dịch chi tiêu thực tế
    await db.runAsync(
      `INSERT INTO transactions (id, type, amount, wallet_id, to_wallet_id, category_id, note, transacted_at, created_at)
       VALUES (?, 'expense', ?, ?, NULL, ?, ?, ?, ?)`,
      [
        txId,
        params.actualAmount,
        params.walletId,
        planned.category_id || null,
        `[Dự chi] ${planned.title}${params.note ? ` - ${params.note}` : ''}`.trim(),
        transactedAt,
        now,
      ]
    );
  });
}

export async function deletePlannedExpense(
  db: SQLite.SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM planned_expenses WHERE id = ?', [id]);
}


