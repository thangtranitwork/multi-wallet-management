import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
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
      CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
      CREATE INDEX IF NOT EXISTS idx_planned_target_date ON planned_expenses(target_date ASC);
      CREATE INDEX IF NOT EXISTS idx_planned_status ON planned_expenses(status);
      CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
      CREATE INDEX IF NOT EXISTS idx_payee_mappings_name ON payee_mappings(payee_name);
    `);

    // Safe ALTER TABLE migrations for existing installations
    const safeAlter = async (sql: string) => {
      try {
        await db.execAsync(sql);
      } catch {
        // Column already exists or already migrated
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
  } catch (error) {
    console.error('[initDatabase] Lỗi tạo bảng SQLite:', error);
    throw error;
  }

  // Migration: Chuẩn hóa tất cả transacted_at cũ chưa đúng chuẩn ISO UTC (ví dụ dạng "YYYY-MM-DD HH:mm:ss" do AI tạo)
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

  // Migration: Dọn dẹp các đường dẫn ảnh cục bộ không còn tồn tại trên máy (file rác tạm từ cache đã bị OS xóa)
  try {
    const txsWithImages = await db.getAllAsync<{ id: string; image_uris: string }>(
      "SELECT id, image_uris FROM transactions WHERE image_uris IS NOT NULL AND image_uris != '' AND image_uris NOT LIKE '%res.cloudinary.com%'"
    );
    if (txsWithImages && txsWithImages.length > 0) {
      for (const row of txsWithImages) {
        let uris: string[] = [];
        try {
          const parsed = JSON.parse(row.image_uris);
          uris = Array.isArray(parsed) ? parsed : [row.image_uris];
        } catch {
          uris = [row.image_uris];
        }

        const validUris: string[] = [];
        let hasDeadImage = false;

        for (const uri of uris) {
          if (uri.startsWith('http://') || uri.startsWith('https://')) {
            validUris.push(uri);
            continue;
          }
          try {
            const info = await FileSystem.getInfoAsync(uri);
            if (info.exists) {
              validUris.push(uri);
            } else {
              hasDeadImage = true;
            }
          } catch {
            hasDeadImage = true;
          }
        }

        if (hasDeadImage) {
          await db.runAsync('UPDATE transactions SET image_uris = ? WHERE id = ?', [
            validUris.length > 0 ? JSON.stringify(validUris) : null,
            row.id,
          ]);
        }
      }
    }
  } catch (err) {
    console.warn('Lỗi migration dọn dẹp ảnh hóa đơn không tồn tại:', err);
  }

  // Migration: Tự động phục hồi các liên kết ảnh Cloudinary bị mất do tính năng dọn dẹp ảnh trước đây
  try {
    const knownCloudinaryBackups: Record<string, string[]> = {
      tx_1790818595719: ['https://res.cloudinary.com/dw7hrsbba/image/upload/v1790818595/multi_wallet_receipts/tgvs1vyfmknxsh86vddi.jpg'],
      tx_1790785247835: ['https://res.cloudinary.com/dw7hrsbba/image/upload/v1790785247/multi_wallet_receipts/t0mjk7q91unzw37mrrpf.jpg'],
      tx_1790746786560: [
        'https://res.cloudinary.com/dw7hrsbba/image/upload/v1790746784/multi_wallet_receipts/bdzyxy6ria2t9zk8pxbn.jpg',
        'https://res.cloudinary.com/dw7hrsbba/image/upload/v1790746786/multi_wallet_receipts/ee1hv2nxdpqjpabyoxkv.jpg',
      ],
      tx_1790815511568: ['https://res.cloudinary.com/dw7hrsbba/image/upload/v1790815511/multi_wallet_receipts/p9z6ljk9a4q5hkehlm9o.jpg'],
      tx_1790731375165: ['https://res.cloudinary.com/dw7hrsbba/image/upload/v1790731374/multi_wallet_receipts/tmhtba0mgt5yameqsnjn.jpg'],
      tx_1790684214848: ['https://res.cloudinary.com/dw7hrsbba/image/upload/v1790684214/multi_wallet_receipts/lplreeqc89xmgdm3lujp.jpg'],
      tx_1790663926946: ['https://res.cloudinary.com/dw7hrsbba/image/upload/v1790677037/multi_wallet_receipts/yk9m13vakbfrkknzpacz.jpg'],
      tx_1790658747901: ['https://res.cloudinary.com/dw7hrsbba/image/upload/v1790660252/multi_wallet_receipts/qxbkdtojtpfgo0bhslmv.jpg'],
      tx_1790595520471: ['https://res.cloudinary.com/dw7hrsbba/image/upload/v1790660251/multi_wallet_receipts/awhwtvnaan9yl6dz0yny.jpg'],
      tx_1790515794206: ['https://res.cloudinary.com/dw7hrsbba/image/upload/v1790697093/multi_wallet_receipts/nvjm7zo2zough8sgbr3u.jpg'],
    };

    for (const [txId, uris] of Object.entries(knownCloudinaryBackups)) {
      const existing = await db.getFirstAsync<{ image_uris: string | null }>(
        'SELECT image_uris FROM transactions WHERE id = ?',
        [txId]
      );
      if (existing && (!existing.image_uris || existing.image_uris.trim() === '' || existing.image_uris === '[]')) {
        await db.runAsync('UPDATE transactions SET image_uris = ? WHERE id = ?', [
          JSON.stringify(uris),
          txId,
        ]);
      }
    }
  } catch (err) {
    console.warn('Lỗi migration phục hồi ảnh Cloudinary:', err);
  }

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
