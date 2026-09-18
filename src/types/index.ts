export type WalletType = 'cash' | 'bank' | 'e_wallet' | 'credit' | 'savings';

export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  balance: number;
  credit_limit: number;
  currency: string;
  color: string;
  icon: string;
  is_excluded: number; // 0 = false, 1 = true
  statement_day?: number | null; // Ngày chốt sao kê hàng tháng (1-31)
  due_day?: number | null;       // Ngày đến hạn thanh toán hàng tháng (1-31)
  bank_bin?: string | null;      // Mã BIN ngân hàng (6 chữ số chuẩn NAPAS)
  bank_account?: string | null;  // Số tài khoản ngân hàng thụ hưởng
  qr_image_uri?: string | null;  // Đường dẫn ảnh mã QR cục bộ của ví
  note?: string;
  created_at: string;
}

export type CategoryType = 'expense' | 'income';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
}

export type TransactionType = 
  | 'expense' 
  | 'income' 
  | 'transfer' 
  | 'adjustment'
  | 'debt_lend' 
  | 'debt_borrow' 
  | 'debt_repay' 
  | 'debt_collect';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  wallet_id: string;
  to_wallet_id?: string | null;
  category_id?: string | null;
  debt_id?: string | null;
  note?: string;
  transacted_at: string;
  created_at: string;
  is_amortized?: number; // 0 = false, 1 = true (trải đều cho các ngày trong tháng khi thống kê)
  // Joined fields for display
  wallet_name?: string;
  to_wallet_name?: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  person_name?: string;
}

export interface CategoryComparisonItem {
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  p1_amount: number;
  p2_amount: number;
  diff_amount: number;      // p1_amount - p2_amount
  diff_percent: number;     // % thay đổi (+ hoặc -)
  is_spike: boolean;        // Tăng đột biến: diff_percent >= 20 và diff_amount >= 200.000đ
}

export interface PeriodComparisonResult {
  period1: {
    label: string;
    start: string;
    end: string;
    income: number;
    expense: number;
    net: number;
  };
  period2: {
    label: string;
    start: string;
    end: string;
    income: number;
    expense: number;
    net: number;
  };
  diff: {
    expense_diff: number;
    expense_diff_percent: number;
    income_diff: number;
    income_diff_percent: number;
    net_diff: number;
  };
  categories: CategoryComparisonItem[];
  spiked_categories: CategoryComparisonItem[];
}

export type DebtType = 'lend' | 'borrow'; // lend = người khác nợ mình, borrow = mình nợ người khác
export type DebtStatus = 'active' | 'partially_paid' | 'settled';

export interface Debt {
  id: string;
  type: DebtType;
  person_name: string;
  person_phone?: string | null;
  initial_amount: number;
  remaining_amount: number;
  wallet_id?: string | null;
  due_date?: string | null;
  status: DebtStatus;
  note?: string;
  created_at: string;
  // Joined fields
  wallet_name?: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  wallet_id: string;
  paid_at: string;
  note?: string;
  wallet_name?: string;
}

export interface FinancialSummary {
  totalAssets: number;       // Tổng số dư ví khả dụng + tiền người khác nợ mình
  totalLiabilities: number;  // Dư nợ thẻ tín dụng + tiền mình nợ người khác
  netWorth: number;          // totalAssets - totalLiabilities
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  totalLent: number;         // Người khác nợ mình
  totalBorrowed: number;     // Mình nợ người khác
  walletCount: number;
}

export interface CategorySpending {
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  total_amount: number;
  percentage: number;
}

export type PlannedExpenseStatus = 'pending' | 'executed' | 'cancelled';
export type PlannedType = 'expense' | 'credit_payment';

export interface PlannedExpense {
  id: string;
  title: string;
  amount: number;
  target_date: string; // YYYY-MM-DD or ISO string
  wallet_id?: string | null;        // Ví nguồn thanh toán (VD: ngân hàng)
  to_wallet_id?: string | null;     // Ví đích cần trả nợ (VD: thẻ tín dụng / SPayLater)
  category_id?: string | null;
  planned_type?: PlannedType;       // 'expense' hoặc 'credit_payment'
  installment_current?: number | null; // Kỳ hiện tại (VD: 1)
  installment_total?: number | null;   // Tổng số kỳ (VD: 3)
  fee?: number;                     // Phí chuyển đổi / phí mỗi kỳ
  parent_tx_id?: string | null;     // ID giao dịch gốc
  status: PlannedExpenseStatus;
  actual_amount?: number | null;
  note?: string;
  created_at: string;
  // Joined fields
  wallet_name?: string;
  wallet_color?: string;
  wallet_icon?: string;
  to_wallet_name?: string;
  to_wallet_color?: string;
  to_wallet_icon?: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}


