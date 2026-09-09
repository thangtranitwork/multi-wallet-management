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
  // Joined fields for display
  wallet_name?: string;
  to_wallet_name?: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  person_name?: string;
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

export interface PlannedExpense {
  id: string;
  title: string;
  amount: number;
  target_date: string; // YYYY-MM-DD or ISO string
  wallet_id?: string | null;
  category_id?: string | null;
  status: PlannedExpenseStatus;
  actual_amount?: number | null;
  note?: string;
  created_at: string;
  // Joined fields
  wallet_name?: string;
  wallet_color?: string;
  wallet_icon?: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}

