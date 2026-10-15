import * as SQLite from 'expo-sqlite';
import { Wallet, Category, Debt, Transaction, DebtPayment, PlannedExpense, ContactPerson } from '../types';
import { normalizeToIsoString } from '../utils/dateUtils';

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
    planned_expenses_count?: number;
    contacts_count?: number;
    payee_mappings_count?: number;
  };
  data: {
    wallets: Wallet[];
    categories: Category[];
    debts: Debt[];
    transactions: Transaction[];
    debt_payments: DebtPayment[];
    planned_expenses?: PlannedExpense[];
    contacts?: ContactPerson[];
    payee_mappings?: any[];
    app_settings?: Array<{ key: string; value: string }>;
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

const SENSITIVE_SETTING_KEYS = new Set([
  'gdrive_access_token',
  'gdrive_refresh_token',
  'pin_code',
  'pin_hash',
  'gemini_api_key', // API key không được xuất ra file backup
]);

/**
 * Trích xuất toàn bộ dữ liệu SQLite hiện tại thành BackupData
 */
export async function exportAllData(db: SQLite.SQLiteDatabase): Promise<BackupData> {
  const wallets = await db.getAllAsync<Wallet>('SELECT * FROM wallets ORDER BY created_at ASC');
  const categories = await db.getAllAsync<Category>('SELECT * FROM categories ORDER BY type ASC, name ASC');
  const debts = await db.getAllAsync<Debt>('SELECT * FROM debts ORDER BY created_at DESC');
  const transactions = await db.getAllAsync<Transaction>('SELECT * FROM transactions ORDER BY transacted_at DESC');
  const debt_payments = await db.getAllAsync<DebtPayment>('SELECT * FROM debt_payments ORDER BY paid_at DESC');
  const planned_expenses = await db.getAllAsync<PlannedExpense>('SELECT * FROM planned_expenses ORDER BY target_date ASC');
  const contacts = await db.getAllAsync<ContactPerson>('SELECT * FROM contacts ORDER BY name ASC');
  const payee_mappings = await db.getAllAsync<any>('SELECT * FROM payee_mappings ORDER BY use_count DESC');

  const allSettings = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM app_settings');
  const app_settings = allSettings.filter(s => !SENSITIVE_SETTING_KEYS.has(s.key));

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
      planned_expenses_count: planned_expenses.length,
      contacts_count: contacts.length,
      payee_mappings_count: payee_mappings.length,
    },
    data: {
      wallets,
      categories,
      debts,
      transactions,
      debt_payments,
      planned_expenses,
      contacts,
      payee_mappings,
      app_settings,
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

  const targetData = data.data || data;

  if (!targetData || typeof targetData !== 'object') {
    return { valid: false, message: 'Dữ liệu sao lưu không có cấu trúc hợp lệ.' };
  }

  if (!Array.isArray(targetData.wallets) || !Array.isArray(targetData.transactions)) {
    return { valid: false, message: 'Dữ liệu sao lưu bắt buộc phải chứa cả danh sách ví (wallets) và giao dịch (transactions).' };
  }

  for (const w of targetData.wallets) {
    if (!w || typeof w !== 'object' || !w.id || typeof w.name !== 'string') {
      return { valid: false, message: 'Dữ liệu danh sách ví bị lỗi hoặc không đúng định dạng.' };
    }
  }

  for (const t of targetData.transactions) {
    if (!t || typeof t !== 'object' || !t.id || !t.wallet_id || typeof t.amount !== 'number') {
      return { valid: false, message: 'Dữ liệu giao dịch bị lỗi hoặc không đúng định dạng.' };
    }
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
  contactsCount?: number;
  payeeMappingsCount?: number;
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
  const plannedExpenses: PlannedExpense[] = raw.planned_expenses || [];
  const contacts: ContactPerson[] = raw.contacts || [];
  const payeeMappings: any[] = raw.payee_mappings || [];
  const appSettings: Array<{ key: string; value: string }> = raw.app_settings || [];

  // Tắt kiểm tra khóa ngoại trước khi bắt đầu transaction để tránh lỗi FOREIGN KEY constraint failed
  await db.execAsync('PRAGMA foreign_keys = OFF;');

  try {
    await db.withTransactionAsync(async () => {
      if (mode === 'replace') {
        // Dọn dẹp toàn bộ dữ liệu cũ
        await db.runAsync('DELETE FROM debt_payments;');
        await db.runAsync('DELETE FROM transactions;');
        await db.runAsync('DELETE FROM debts;');
        await db.runAsync('DELETE FROM planned_expenses;');
        await db.runAsync('DELETE FROM wallets;');
        await db.runAsync('DELETE FROM categories;');
        await db.runAsync('DELETE FROM contacts;');
        await db.runAsync('DELETE FROM payee_mappings;');
      }

      // 1. Chèn danh mục
      for (const c of categories) {
        await db.runAsync(
          `INSERT OR REPLACE INTO categories (id, name, type, icon, color)
           VALUES (?, ?, ?, ?, ?)`,
          [c.id, c.name, c.type, c.icon, c.color]
        );
      }

      // 2. Chèn ví tiền
      for (const w of wallets) {
        await db.runAsync(
          `INSERT OR REPLACE INTO wallets (
             id, name, type, balance, credit_limit, currency, color, icon, 
             is_excluded, statement_day, due_day, bank_bin, bank_account, qr_image_uri, note, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            w.id,
            w.name,
            w.type,
            Math.round(w.balance || 0),
            Math.round(w.credit_limit || 0),
            w.currency || 'VND',
            w.color,
            w.icon,
            w.is_excluded ? 1 : 0,
            w.statement_day ?? null,
            w.due_day ?? null,
            w.bank_bin ?? null,
            w.bank_account ?? null,
            w.qr_image_uri ?? null,
            w.note ?? null,
            w.created_at || new Date().toISOString(),
          ]
        );
      }

      // 3. Chèn các khoản nợ (debts)
      for (const d of debts) {
        await db.runAsync(
          `INSERT OR REPLACE INTO debts (
             id, type, person_name, person_phone, initial_amount, remaining_amount, 
             wallet_id, due_date, status, note, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            d.id,
            d.type,
            d.person_name,
            d.person_phone ?? null,
            Math.round(d.initial_amount || 0),
            Math.round(d.remaining_amount || 0),
            d.wallet_id ?? null,
            d.due_date ?? null,
            d.status || 'active',
            d.note ?? null,
            d.created_at || new Date().toISOString(),
          ]
        );
      }

      // 4. Chèn giao dịch (transactions)
      for (const t of transactions) {
        let serializedUris: string | null = null;
        if (Array.isArray(t.image_uris)) {
          serializedUris = t.image_uris.length > 0 ? JSON.stringify(t.image_uris) : null;
        } else if (typeof t.image_uris === 'string' && (t.image_uris as string).trim()) {
          serializedUris = (t.image_uris as string).trim();
        }

        await db.runAsync(
          `INSERT OR REPLACE INTO transactions (
             id, type, amount, wallet_id, to_wallet_id, category_id, debt_id, 
             note, transacted_at, created_at, is_amortized, image_uris, items
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            t.id,
            t.type,
            Math.round(t.amount || 0),
            t.wallet_id,
            t.to_wallet_id ?? null,
            t.category_id ?? null,
            t.debt_id ?? null,
            t.note ?? null,
            normalizeToIsoString(t.transacted_at),
            t.created_at || new Date().toISOString(),
            t.is_amortized ? 1 : 0,
            serializedUris,
            t.items ?? null,
          ]
        );
      }

      // 5. Chèn lịch sử thanh toán nợ (debt_payments)
      for (const dp of debtPayments) {
        await db.runAsync(
          `INSERT OR REPLACE INTO debt_payments (id, debt_id, amount, wallet_id, paid_at, note)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            dp.id,
            dp.debt_id,
            Math.round(dp.amount || 0),
            dp.wallet_id,
            dp.paid_at || new Date().toISOString(),
            dp.note ?? null,
          ]
        );
      }

      // 6. Chèn dự chi (planned_expenses)
      for (const pe of plannedExpenses) {
        await db.runAsync(
          `INSERT OR REPLACE INTO planned_expenses (
             id, title, amount, target_date, wallet_id, to_wallet_id, category_id, 
             planned_type, installment_current, installment_total, fee, parent_tx_id, 
             status, actual_amount, note, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pe.id,
            pe.title,
            Math.round(pe.amount || 0),
            pe.target_date,
            pe.wallet_id || null,
            pe.to_wallet_id || null,
            pe.category_id || null,
            pe.planned_type || 'expense',
            pe.installment_current ?? null,
            pe.installment_total ?? null,
            Math.round(pe.fee || 0),
            pe.parent_tx_id || null,
            pe.status || 'pending',
            pe.actual_amount ? Math.round(pe.actual_amount) : null,
            pe.note || '',
            pe.created_at || new Date().toISOString(),
          ]
        );
      }

      // 7. Chèn danh bạ người liên hệ (contacts)
      for (const ct of contacts) {
        await db.runAsync(
          `INSERT OR REPLACE INTO contacts (id, name, phone, note, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            ct.id,
            ct.name,
            ct.phone ?? null,
            ct.note ?? null,
            ct.created_at || new Date().toISOString(),
          ]
        );
      }

      // 8. Chèn payee_mappings đã học được
      for (const pm of payeeMappings) {
        if (!pm.id || !pm.payee_name) continue;
        await db.runAsync(
          `INSERT OR REPLACE INTO payee_mappings (
             id, payee_name, payee_display_name, account_number, bank_name,
             suggested_note, suggested_category_id, suggested_wallet_id,
             use_count, recent_notes, last_used_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pm.id,
            pm.payee_name,
            pm.payee_display_name || null,
            pm.account_number || null,
            pm.bank_name || null,
            pm.suggested_note || '',
            pm.suggested_category_id || null,
            pm.suggested_wallet_id || null,
            pm.use_count || 1,
            pm.recent_notes || null,
            pm.last_used_at || new Date().toISOString(),
            pm.created_at || new Date().toISOString(),
          ]
        );
      }

      // 9. Chèn cấu hình ứng dụng (loại trừ các token nhạy cảm)
      for (const setting of appSettings) {
        if (!setting.key || SENSITIVE_SETTING_KEYS.has(setting.key)) continue;
        await db.runAsync(
          'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
          [setting.key, setting.value]
        );
      }
    });
  } finally {
    // Bật lại kiểm tra khóa ngoại sau khi hoàn tất nhập dữ liệu
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }

  return {
    success: true,
    walletsCount: wallets.length,
    transactionsCount: transactions.length,
    debtsCount: debts.length,
    contactsCount: contacts.length,
    payeeMappingsCount: payeeMappings.length,
  };
}

/**
 * Xóa sạch toàn bộ dữ liệu người dùng và thiết lập lại ứng dụng ban đầu
 */
export async function resetDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM debt_payments;');
      await db.runAsync('DELETE FROM transactions;');
      await db.runAsync('DELETE FROM debts;');
      await db.runAsync('DELETE FROM planned_expenses;');
      await db.runAsync('DELETE FROM wallets;');
      await db.runAsync('DELETE FROM categories;');
      await db.runAsync('DELETE FROM contacts;');
      await db.runAsync('DELETE FROM payee_mappings;');

      for (const c of DEFAULT_CATEGORIES) {
        await db.runAsync(
          `INSERT INTO categories (id, name, type, icon, color)
           VALUES (?, ?, ?, ?, ?)`,
          [c.id, c.name, c.type, c.icon, c.color]
        );
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}
