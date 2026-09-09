import * as SQLite from 'expo-sqlite';

export const DB_NAME = 'multi_wallet_emerald_v3.db';

export async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
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
      type TEXT NOT NULL, -- 'expense', 'income', 'transfer', 'debt_lend', 'debt_borrow', 'debt_repay', 'debt_collect'
      amount REAL NOT NULL,
      wallet_id TEXT NOT NULL,
      to_wallet_id TEXT,
      category_id TEXT,
      debt_id TEXT,
      note TEXT,
      transacted_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE SET NULL
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

    CREATE INDEX IF NOT EXISTS idx_transactions_transacted_at ON transactions(transacted_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_id);
    CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
  `);

  // ONLY seed default standard categories (no wallets, no transactions, no debts)
  const catCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if (!catCount || catCount.count === 0) {
    await seedDefaultCategories(db);
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
