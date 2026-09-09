import * as SQLite from 'expo-sqlite';
import { Wallet, Category, Debt, Transaction, DebtPayment } from '../types';

export interface BackupData {
  app: 'multi-wallet-management';
  version: 1;
  exported_at: string;
  stats: {
    wallets_count: number;
    categories_count: number;
    debts_count: number;
    transactions_count: number;
    debt_payments_count: number;
  };
  data: {
    wallets: Wallet[];
    categories: Category[];
    debts: Debt[];
    transactions: Transaction[];
    debt_payments: DebtPayment[];
  };
}

export const DEFAULT_CATEGORIES: Category[] = [
  // Chi tiêu (Expenses)
  { id: 'cat_food', name: 'Ăn uống', type: 'expense', icon: 'restaurant-outline', color: '#F97316' },
  { id: 'cat_coffee', name: 'Cà phê & Đồ uống', type: 'expense', icon: 'cafe-outline', color: '#B45309' },
  { id: 'cat_transport', name: 'Đi lại & Xăng xe', type: 'expense', icon: 'car-outline', color: '#3B82F6' },
  { id: 'cat_shopping', name: 'Mua sắm', type: 'expense', icon: 'cart-outline', color: '#EC4899' },
  { id: 'cat_bill', name: 'Hóa đơn & Tiện ích', type: 'expense', icon: 'flash-outline', color: '#EAB308' },
  { id: 'cat_home', name: 'Nhà cửa', type: 'expense', icon: 'home-outline', color: '#14B8A6' },
  { id: 'cat_entertainment', name: 'Giải trí', type: 'expense', icon: 'game-controller-outline', color: '#8B5CF6' },
  { id: 'cat_health', name: 'Sức khỏe & Y tế', type: 'expense', icon: 'medkit-outline', color: '#EF4444' },
  { id: 'cat_education', name: 'Học tập & Sách', type: 'expense', icon: 'book-outline', color: '#6366F1' },
  { id: 'cat_other_exp', name: 'Chi tiêu khác', type: 'expense', icon: 'ellipsis-horizontal-outline', color: '#64748B' },
  // Thu nhập (Income)
  { id: 'cat_salary', name: 'Tiền lương', type: 'income', icon: 'cash-outline', color: '#10B981' },
  { id: 'cat_bonus', name: 'Thưởng & Tip', type: 'income', icon: 'gift-outline', color: '#06B6D4' },
  { id: 'cat_investment', name: 'Đầu tư & Cổ tức', type: 'income', icon: 'trending-up-outline', color: '#8B5CF6' },
  { id: 'cat_other_inc', name: 'Thu nhập khác', type: 'income', icon: 'wallet-outline', color: '#22C55E' },
];

/**
 * Trích xuất toàn bộ dữ liệu SQLite hiện tại thành BackupData
 */
export async function exportAllData(db: SQLite.SQLiteDatabase): Promise<BackupData> {
  const [wallets, categories, debts, transactions, debt_payments] = await Promise.all([
    db.getAllAsync<Wallet>('SELECT * FROM wallets ORDER BY created_at ASC'),
    db.getAllAsync<Category>('SELECT * FROM categories ORDER BY type ASC, name ASC'),
    db.getAllAsync<Debt>('SELECT * FROM debts ORDER BY created_at DESC'),
    db.getAllAsync<Transaction>('SELECT id, type, amount, wallet_id, to_wallet_id, category_id, debt_id, note, transacted_at, created_at FROM transactions ORDER BY transacted_at DESC'),
    db.getAllAsync<DebtPayment>('SELECT * FROM debt_payments ORDER BY paid_at DESC'),
  ]);

  return {
    app: 'multi-wallet-management',
    version: 1,
    exported_at: new Date().toISOString(),
    stats: {
      wallets_count: wallets.length,
      categories_count: categories.length,
      debts_count: debts.length,
      transactions_count: transactions.length,
      debt_payments_count: debt_payments.length,
    },
    data: {
      wallets,
      categories,
      debts,
      transactions,
      debt_payments,
    },
  };
}

/**
 * Xác thực cấu trúc dữ liệu sao lưu trước khi nhập
 */
export function validateBackupData(data: any): { valid: boolean; message?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, message: 'Dữ liệu không phải là đối tượng JSON hợp lệ.' };
  }

  // Chấp nhận cả định dạng chuẩn BackupData hoặc định dạng đơn giản có { wallets, transactions, debts }
  const targetData = data.data || data;

  if (!Array.isArray(targetData.wallets) && !Array.isArray(targetData.transactions)) {
    return { valid: false, message: 'Dữ liệu sao lưu thiếu danh sách ví hoặc giao dịch.' };
  }

  return { valid: true };
}

/**
 * Nhập dữ liệu sao lưu vào cơ sở dữ liệu SQLite
 */
export async function importAllData(
  db: SQLite.SQLiteDatabase,
  backupData: any,
  mode: 'replace' | 'merge' = 'replace'
): Promise<{
  success: boolean;
  walletsCount: number;
  transactionsCount: number;
  debtsCount: number;
}> {
  const validation = validateBackupData(backupData);
  if (!validation.valid) {
    throw new Error(validation.message || 'File sao lưu không hợp lệ');
  }

  const raw = backupData.data || backupData;
  const wallets: Wallet[] = raw.wallets || [];
  const categories: Category[] = raw.categories && raw.categories.length > 0 ? raw.categories : DEFAULT_CATEGORIES;
  const debts: Debt[] = raw.debts || [];
  const transactions: Transaction[] = raw.transactions || [];
  const debtPayments: DebtPayment[] = raw.debt_payments || [];

  await db.withTransactionAsync(async () => {
    if (mode === 'replace') {
      // 1. Dọn dẹp các bảng cũ theo thứ tự ràng buộc khóa ngoại
      await db.runAsync('DELETE FROM debt_payments;');
      await db.runAsync('DELETE FROM transactions;');
      await db.runAsync('DELETE FROM debts;');
      await db.runAsync('DELETE FROM wallets;');
      await db.runAsync('DELETE FROM categories;');
    }

    // 2. Chèn danh mục
    for (const c of categories) {
      await db.runAsync(
        `INSERT OR REPLACE INTO categories (id, name, type, icon, color)
         VALUES (?, ?, ?, ?, ?)`,
        [c.id, c.name, c.type, c.icon, c.color]
      );
    }

    // 3. Chèn ví tiền
    for (const w of wallets) {
      await db.runAsync(
        `INSERT OR REPLACE INTO wallets (id, name, type, balance, credit_limit, currency, color, icon, is_excluded, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          w.id,
          w.name,
          w.type,
          w.balance,
          w.credit_limit || 0,
          w.currency || 'VND',
          w.color,
          w.icon,
          w.is_excluded ? 1 : 0,
          w.note || '',
          w.created_at || new Date().toISOString(),
        ]
      );
    }

    // 4. Chèn sổ nợ
    for (const d of debts) {
      await db.runAsync(
        `INSERT OR REPLACE INTO debts (id, type, person_name, person_phone, initial_amount, remaining_amount, wallet_id, due_date, status, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          d.id,
          d.type,
          d.person_name,
          d.person_phone || null,
          d.initial_amount,
          d.remaining_amount,
          d.wallet_id || null,
          d.due_date || null,
          d.status || 'active',
          d.note || '',
          d.created_at || new Date().toISOString(),
        ]
      );
    }

    // 5. Chèn giao dịch
    for (const t of transactions) {
      await db.runAsync(
        `INSERT OR REPLACE INTO transactions (id, type, amount, wallet_id, to_wallet_id, category_id, debt_id, note, transacted_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          t.id,
          t.type,
          t.amount,
          t.wallet_id,
          t.to_wallet_id || null,
          t.category_id || null,
          t.debt_id || null,
          t.note || '',
          t.transacted_at || new Date().toISOString(),
          t.created_at || new Date().toISOString(),
        ]
      );
    }

    // 6. Chèn các đợt trả nợ
    for (const p of debtPayments) {
      await db.runAsync(
        `INSERT OR REPLACE INTO debt_payments (id, debt_id, amount, wallet_id, paid_at, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.debt_id,
          p.amount,
          p.wallet_id,
          p.paid_at || new Date().toISOString(),
          p.note || '',
        ]
      );
    }
  });

  return {
    success: true,
    walletsCount: wallets.length,
    transactionsCount: transactions.length,
    debtsCount: debts.length,
  };
}

/**
 * Xóa sạch toàn bộ dữ liệu người dùng và thiết lập lại ứng dụng ban đầu
 */
export async function resetDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM debt_payments;');
    await db.runAsync('DELETE FROM transactions;');
    await db.runAsync('DELETE FROM debts;');
    await db.runAsync('DELETE FROM wallets;');
    await db.runAsync('DELETE FROM categories;');

    for (const c of DEFAULT_CATEGORIES) {
      await db.runAsync(
        `INSERT INTO categories (id, name, type, icon, color)
         VALUES (?, ?, ?, ?, ?)`,
        [c.id, c.name, c.type, c.icon, c.color]
      );
    }
  });
}
