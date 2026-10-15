import * as SQLite from 'expo-sqlite';
import { normalizeToIsoString } from '../utils/dateUtils';

export const DB_NAME = 'multi_wallet_emerald_v3.db';

export async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  if (!db) {
    console.warn('[initDatabase] Database instance is null or undefined!');
    return;
  }

  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS wallets (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        balance REAL NOT NULL DEFAULT 0,
        credit_limit REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'VND',
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        is_excluded INTEGER NOT NULL DEFAULT 0,
        statement_day INTEGER DEFAULT NULL,
        due_day INTEGER DEFAULT NULL,
        bank_bin TEXT DEFAULT NULL,
        bank_account TEXT DEFAULT NULL,
        qr_image_uri TEXT DEFAULT NULL,
        note TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS debts (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL, -- 'lend' (người khác nợ mình), 'borrow' (mình nợ người khác)
        person_name TEXT NOT NULL,
        person_phone TEXT,
        initial_amount REAL NOT NULL,
        remaining_amount REAL NOT NULL,
        wallet_id TEXT,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'active', -- 'active', 'partially_paid', 'settled'
        note TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL, -- 'expense', 'income', 'transfer', 'adjustment', 'debt_lend', 'debt_borrow', 'debt_repay', 'debt_collect'
        amount REAL NOT NULL,
        wallet_id TEXT NOT NULL,
        to_wallet_id TEXT,
        category_id TEXT,
        debt_id TEXT,
        note TEXT,
        transacted_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        is_amortized INTEGER DEFAULT 0,
        image_uris TEXT DEFAULT NULL,
        items TEXT DEFAULT NULL,
        FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
        FOREIGN KEY (to_wallet_id) REFERENCES wallets(id) ON DELETE SET NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        note TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS debt_payments (
        id TEXT PRIMARY KEY NOT NULL,
        debt_id TEXT NOT NULL,
        amount REAL NOT NULL,
        wallet_id TEXT NOT NULL,
        paid_at TEXT NOT NULL,
        note TEXT,
        FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE,
        FOREIGN KEY (wallet_id) REFERENCES wallets(id)
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS planned_expenses (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        target_date TEXT NOT NULL,
        wallet_id TEXT,
        to_wallet_id TEXT,
        category_id TEXT,
        planned_type TEXT NOT NULL DEFAULT 'expense',
        installment_current INTEGER DEFAULT NULL,
        installment_total INTEGER DEFAULT NULL,
        fee REAL DEFAULT 0,
        parent_tx_id TEXT DEFAULT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        actual_amount REAL,
        note TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL,
        FOREIGN KEY (to_wallet_id) REFERENCES wallets(id) ON DELETE SET NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS payee_mappings (
        id TEXT PRIMARY KEY NOT NULL,
        payee_name TEXT NOT NULL,
        payee_display_name TEXT,
        account_number TEXT,
        bank_name TEXT,
        suggested_note TEXT NOT NULL,
        suggested_category_id TEXT,
        suggested_wallet_id TEXT,
        use_count INTEGER DEFAULT 1,
        recent_notes TEXT,
        last_used_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_transacted_at ON transactions(transacted_at DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet ON transactions(to_wallet_id);
      CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
      CREATE INDEX IF NOT EXISTS idx_planned_target_date ON planned_expenses(target_date ASC);
      CREATE INDEX IF NOT EXISTS idx_planned_status ON planned_expenses(status);
      CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
      CREATE INDEX IF NOT EXISTS idx_payee_mappings_name ON payee_mappings(payee_name);
    `);

    // Migration quản lý theo phiên bản PRAGMA user_version, tránh chạy lại migration mỗi lần khởi động app
    const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    const currentVersion = versionRow?.user_version || 0;

    if (currentVersion < 1) {
      const safeAlter = async (sql: string) => {
        try {
          await db.execAsync(sql);
        } catch {
          // Column already exists
        }
      };
      await safeAlter('ALTER TABLE wallets ADD COLUMN statement_day INTEGER DEFAULT NULL;');
      await safeAlter('ALTER TABLE wallets ADD COLUMN due_day INTEGER DEFAULT NULL;');
      await safeAlter('ALTER TABLE wallets ADD COLUMN bank_bin TEXT DEFAULT NULL;');
      await safeAlter('ALTER TABLE wallets ADD COLUMN bank_account TEXT DEFAULT NULL;');
      await safeAlter('ALTER TABLE wallets ADD COLUMN qr_image_uri TEXT DEFAULT NULL;');
      await safeAlter('ALTER TABLE planned_expenses ADD COLUMN to_wallet_id TEXT DEFAULT NULL;');
      await safeAlter("ALTER TABLE planned_expenses ADD COLUMN planned_type TEXT NOT NULL DEFAULT 'expense';");
      await safeAlter('ALTER TABLE planned_expenses ADD COLUMN installment_current INTEGER DEFAULT NULL;');
      await safeAlter('ALTER TABLE planned_expenses ADD COLUMN installment_total INTEGER DEFAULT NULL;');
      await safeAlter('ALTER TABLE planned_expenses ADD COLUMN fee REAL DEFAULT 0;');
      await safeAlter('ALTER TABLE planned_expenses ADD COLUMN parent_tx_id TEXT DEFAULT NULL;');
      await safeAlter('ALTER TABLE transactions ADD COLUMN is_amortized INTEGER DEFAULT 0;');
      await safeAlter('ALTER TABLE transactions ADD COLUMN image_uris TEXT DEFAULT NULL;');
      await safeAlter('ALTER TABLE transactions ADD COLUMN items TEXT DEFAULT NULL;');

      await db.execAsync('PRAGMA user_version = 1;');
    }

    if (currentVersion < 2) {
      // Chuẩn hóa một lần duy nhất transacted_at cũ chưa đúng chuẩn ISO UTC
      try {
        const nonIsoTxs = await db.getAllAsync<{ id: string; transacted_at: string }>(
          "SELECT id, transacted_at FROM transactions WHERE transacted_at NOT LIKE '%Z' AND transacted_at NOT LIKE '%z'"
        );
        if (nonIsoTxs && nonIsoTxs.length > 0) {
          for (const row of nonIsoTxs) {
            const normalized = normalizeToIsoString(row.transacted_at);
            if (normalized && normalized !== row.transacted_at) {
              await db.runAsync('UPDATE transactions SET transacted_at = ? WHERE id = ?', [
                normalized,
                row.id,
              ]);
            }
          }
        }
      } catch (err) {
        console.warn('Lỗi migration chuẩn hóa transacted_at:', err);
      }
      await db.execAsync('PRAGMA user_version = 2;');
    }

    if (currentVersion < 3) {
      // Dọn dẹp tiêu đề và ghi chú dự chi thẻ tín dụng thừa
      try {
        const creditPlans = await db.getAllAsync<{ id: string; title: string; note: string | null }>(
          "SELECT id, title, note FROM planned_expenses WHERE planned_type = 'credit_payment' AND (title LIKE 'Trả nợ %' OR note LIKE 'Gốc:%+ Phí: 0%')"
        );
        if (creditPlans && creditPlans.length > 0) {
          for (const plan of creditPlans) {
            let newTitle = plan.title;
            if (newTitle.startsWith('Trả nợ ')) {
              newTitle = newTitle
                .replace(/^Trả nợ\s+[^:]+:\s*/i, '')
                .replace(/\s*\(Kỳ\s+\d+\/\d+\)$/i, '')
                .trim() || plan.title;
            }

            let newNote = plan.note;
            if (newNote && /^Gốc:\s*[\d\.\,]+\s*₫?\s*\+\s*Phí:\s*0\s*₫?$/i.test(newNote.trim())) {
              newNote = null;
            }

            if (newTitle !== plan.title || newNote !== plan.note) {
              await db.runAsync('UPDATE planned_expenses SET title = ?, note = ? WHERE id = ?', [
                newTitle,
                newNote,
                plan.id,
              ]);
            }
          }
        }
      } catch (err) {
        console.warn('Lỗi migration dọn dẹp tiêu đề dự chi thẻ tín dụng:', err);
      }
      await db.execAsync('PRAGMA user_version = 3;');
    }

    if (currentVersion < 4) {
      // Dọn dẹp các to_wallet_id mồ côi (không tồn tại trong bảng wallets)
      try {
        await db.runAsync(`
          UPDATE transactions
          SET to_wallet_id = NULL
          WHERE to_wallet_id IS NOT NULL AND to_wallet_id NOT IN (SELECT id FROM wallets)
        `);
        await db.runAsync(`
          UPDATE planned_expenses
          SET to_wallet_id = NULL
          WHERE to_wallet_id IS NOT NULL AND to_wallet_id NOT IN (SELECT id FROM wallets)
        `);
      } catch (err) {
        console.warn('Lỗi migration dọn dẹp to_wallet_id mồ côi:', err);
      }
      await db.execAsync('PRAGMA user_version = 4;');
    }

    // Khởi tạo danh mục mặc định nếu chưa có
    const catCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
    if (!catCount || catCount.count === 0) {
      await seedDefaultCategories(db);
    }
  } catch (error) {
    console.error('[initDatabase] Lỗi khởi tạo SQLite:', error);
    throw error;
  }
}

async function seedDefaultCategories(db: SQLite.SQLiteDatabase): Promise<void> {
  const categories = [
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

  for (const c of categories) {
    await db.runAsync(
      'INSERT INTO categories (id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)',
      [c.id, c.name, c.type, c.icon, c.color]
    );
  }
}
