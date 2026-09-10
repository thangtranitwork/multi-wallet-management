import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import dayjs from 'dayjs';
import {
  Wallet,
  Transaction,
  Debt,
  Category,
  FinancialSummary,
  CategorySpending,
  PlannedExpense,
} from '../types';
import * as queries from '../database/queries';
import * as backup from '../database/backup';
import * as LocalAuthentication from 'expo-local-authentication';
import { hapticLight, hapticSuccess, hapticError } from '../utils/haptics';
import { loadCloudBackupConfig, saveCloudBackupConfig } from '../services/cloudBackupStorage';
import { uploadBackupToDrive } from '../services/googleDriveService';

interface WalletContextType {
  wallets: Wallet[];
  transactions: Transaction[];
  debts: Debt[];
  categories: Category[];
  plannedExpenses: PlannedExpense[];
  summary: FinancialSummary | null;
  categorySpendings: CategorySpending[];
  totalPendingPlanned: number;
  safeToSpendBalance: number;
  isLoading: boolean;
  isBalanceHidden: boolean;
  toggleHideBalance: () => Promise<void> | void;
  activeWalletFilter: string | null;
  setActiveWalletFilter: (id: string | null) => void;
  refreshData: () => Promise<void>;
  addTransaction: (tx: {
    type: 'expense' | 'income' | 'transfer';
    amount: number;
    wallet_id: string;
    to_wallet_id?: string | null;
    category_id?: string | null;
    note?: string;
    transacted_at?: string;
  }) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  updateTransactionCategory: (transactionId: string, categoryId: string | null) => Promise<void>;
  splitTransaction: (transactionId: string, splits: queries.SplitItem[]) => Promise<void>;
  addWallet: (wallet: Omit<Wallet, 'id' | 'created_at'>) => Promise<void>;
  editWallet: (wallet: Partial<Wallet> & { id: string }) => Promise<void>;
  adjustBalance: (walletId: string, newBalance: number, note?: string) => Promise<void>;
  removeWallet: (id: string) => Promise<void>;
  addDebt: (debt: {
    type: 'lend' | 'borrow';
    person_name: string;
    person_phone?: string | null;
    initial_amount: number;
    wallet_id?: string | null;
    due_date?: string | null;
    note?: string;
  }) => Promise<void>;
  payOrCollectDebt: (params: {
    debtId: string;
    amount: number;
    walletId: string;
    note?: string;
  }) => Promise<void>;
  removeDebt: (id: string, refundToWallet?: boolean) => Promise<void>;
  addCategory: (category: Omit<Category, 'id'> & { id?: string }) => Promise<void>;
  editCategory: (category: Partial<Category> & { id: string }) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  addPlannedExpense: (
    planned: Omit<PlannedExpense, 'id' | 'created_at' | 'status'>
  ) => Promise<void>;
  editPlannedExpense: (
    planned: Partial<PlannedExpense> & { id: string }
  ) => Promise<void>;
  executePlannedExpense: (params: {
    id: string;
    walletId: string;
    actualAmount?: number;
    note?: string;
  }) => Promise<void>;
  removePlannedExpense: (id: string) => Promise<void>;
  exportDataToJsonString: () => Promise<string>;
  importDataFromJsonString: (
    jsonStr: string,
    mode?: 'replace' | 'merge'
  ) => Promise<{
    success: boolean;
    walletsCount: number;
    transactionsCount: number;
    debtsCount: number;
  }>;
  resetAllData: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const db = useSQLiteContext();

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [plannedExpenses, setPlannedExpenses] = useState<PlannedExpense[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [categorySpendings, setCategorySpendings] = useState<CategorySpending[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(false);
  const [activeWalletFilter, setActiveWalletFilter] = useState<string | null>(null);

  const toggleHideBalance = useCallback(async () => {
    if (!isBalanceHidden) {
      // Đang hiển thị -> Muốn che: che ngay lập tức
      hapticLight();
      setIsBalanceHidden(true);
      return;
    }

    // Đang che -> Muốn hiển thị: BẮT BUỘC quét vân tay / sinh trắc học
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Quét vân tay để hiển thị số tiền',
          fallbackLabel: 'Sử dụng mật khẩu thiết bị',
          cancelLabel: 'Hủy',
          disableDeviceFallback: false,
        });

        if (result.success) {
          hapticSuccess();
          setIsBalanceHidden(false);
        } else {
          hapticError();
        }
      } else {
        // Thiết bị không có vân tay / chưa cài vân tay -> mở trực tiếp
        hapticLight();
        setIsBalanceHidden(false);
      }
    } catch {
      setIsBalanceHidden(false);
    }
  }, [isBalanceHidden]);

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [
        fetchedWallets,
        fetchedTxs,
        fetchedDebts,
        fetchedCategories,
        fetchedPlanned,
        fetchedSummary,
        fetchedSpendings,
      ] = await Promise.all([
        queries.getWallets(db),
        queries.getTransactions(db, { limit: 100 }),
        queries.getDebts(db),
        queries.getCategories(db),
        queries.getPlannedExpenses(db),
        queries.getFinancialSummary(db),
        queries.getCategorySpending(db),
      ]);

      setWallets(fetchedWallets);
      setTransactions(fetchedTxs);
      setDebts(fetchedDebts);
      setCategories(fetchedCategories);
      setPlannedExpenses(fetchedPlanned);
      setSummary(fetchedSummary);
      setCategorySpendings(fetchedSpendings);
    } catch (error) {
      console.error('Lỗi tải dữ liệu SQLite:', error);
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  const totalPendingPlanned = useMemo(() => {
    return plannedExpenses
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [plannedExpenses]);

  const safeToSpendBalance = useMemo(() => {
    const totalWalletBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
    return Math.max(0, totalWalletBalance - totalPendingPlanned);
  }, [wallets, totalPendingPlanned]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const autoBackupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerAutoBackup = useCallback(() => {
    if (autoBackupTimerRef.current) {
      clearTimeout(autoBackupTimerRef.current);
    }
    // Debounce 8 giây sau lần thao tác cuối để upload nền
    autoBackupTimerRef.current = setTimeout(async () => {
      try {
        const conf = await loadCloudBackupConfig(db);
        if (conf.isLinked && conf.autoBackupEnabled && conf.accessToken) {
          const rawData = await backup.exportAllData(db);
          const jsonStr = JSON.stringify(rawData, null, 2);
          const uploadRes = await uploadBackupToDrive(conf.accessToken, jsonStr);
          if (uploadRes.success) {
            await saveCloudBackupConfig(db, {
              lastBackupTime: dayjs().format('HH:mm DD/MM/YYYY'),
              lastBackupFileName: uploadRes.fileName,
            });
          }
        }
      } catch (err) {
        console.warn('Auto-backup skipped or error:', err);
      }
    }, 8000);
  }, [db]);

  const addTransaction = async (tx: {
    type: 'expense' | 'income' | 'transfer';
    amount: number;
    wallet_id: string;
    to_wallet_id?: string | null;
    category_id?: string | null;
    note?: string;
    transacted_at?: string;
  }) => {
    const id = 'tx_' + Date.now();
    await queries.createTransaction(db, {
      id,
      ...tx,
      transacted_at: tx.transacted_at || new Date().toISOString(),
    });
    await refreshData();
    triggerAutoBackup();
  };

  const removeTransaction = async (id: string) => {
    await queries.deleteTransaction(db, id);
    await refreshData();
    triggerAutoBackup();
  };

  const updateTransactionCategory = async (transactionId: string, categoryId: string | null) => {
    await queries.updateTransactionCategory(db, transactionId, categoryId);
    await refreshData();
    triggerAutoBackup();
  };

  const splitTransaction = async (transactionId: string, splits: queries.SplitItem[]) => {
    await queries.splitTransactionIntoDebts(db, transactionId, splits);
    await refreshData();
    triggerAutoBackup();
  };

  const addWallet = async (wallet: Omit<Wallet, 'id' | 'created_at'>) => {
    const id = 'w_' + Date.now();
    await queries.createWallet(db, {
      id,
      ...wallet,
    });
    await refreshData();
    triggerAutoBackup();
  };

  const editWallet = async (wallet: Partial<Wallet> & { id: string }) => {
    await queries.updateWallet(db, wallet);
    await refreshData();
    triggerAutoBackup();
  };

  const adjustBalance = async (walletId: string, newBalance: number, note?: string) => {
    await queries.adjustWalletBalance(db, walletId, newBalance, note);
    await refreshData();
    triggerAutoBackup();
  };

  const removeWallet = async (id: string) => {
    await queries.deleteWallet(db, id);
    await refreshData();
    triggerAutoBackup();
  };

  const addDebt = async (debt: {
    type: 'lend' | 'borrow';
    person_name: string;
    person_phone?: string | null;
    initial_amount: number;
    wallet_id?: string | null;
    due_date?: string | null;
    note?: string;
  }) => {
    const id = 'debt_' + Date.now();
    await queries.createDebt(db, {
      id,
      ...debt,
    });
    await refreshData();
    triggerAutoBackup();
  };

  const payOrCollectDebt = async (params: {
    debtId: string;
    amount: number;
    walletId: string;
    note?: string;
  }) => {
    await queries.processDebtPayment(db, params);
    await refreshData();
    triggerAutoBackup();
  };

  const removeDebt = async (id: string, refundToWallet: boolean = false) => {
    await queries.deleteDebt(db, id, refundToWallet);
    await refreshData();
    triggerAutoBackup();
  };

  const addCategory = async (category: Omit<Category, 'id'> & { id?: string }) => {
    const newCat: Category = {
      id: category.id || `cat_${Date.now()}`,
      name: category.name,
      type: category.type,
      icon: category.icon,
      color: category.color,
    };
    await queries.createCategory(db, newCat);
    await refreshData();
  };

  const editCategory = async (category: Partial<Category> & { id: string }) => {
    await queries.updateCategory(db, category);
    await refreshData();
  };

  const removeCategory = async (id: string) => {
    await queries.deleteCategory(db, id);
    await refreshData();
  };

  const addPlannedExpense = async (
    planned: Omit<PlannedExpense, 'id' | 'created_at' | 'status'>
  ) => {
    const id = 'pe_' + Date.now();
    await queries.createPlannedExpense(db, {
      id,
      ...planned,
    });
    await refreshData();
  };

  const editPlannedExpense = async (
    planned: Partial<PlannedExpense> & { id: string }
  ) => {
    await queries.updatePlannedExpense(db, planned);
    await refreshData();
  };

  const executePlannedExpense = async (params: {
    id: string;
    walletId: string;
    actualAmount?: number;
    transactedAt?: string;
    note?: string;
  }) => {
    const planned = plannedExpenses.find(p => p.id === params.id);
    const actualAmount = params.actualAmount ?? (planned ? planned.amount : 0);
    await queries.executePlannedExpense(db, {
      id: params.id,
      walletId: params.walletId,
      actualAmount,
      transactedAt: params.transactedAt,
      note: params.note,
    });
    await refreshData();
    triggerAutoBackup();
  };

  const removePlannedExpense = async (id: string) => {
    await queries.deletePlannedExpense(db, id);
    await refreshData();
  };

  const exportDataToJsonString = async (): Promise<string> => {
    const data = await backup.exportAllData(db);
    return JSON.stringify(data, null, 2);
  };

  const importDataFromJsonString = async (
    jsonStr: string,
    mode: 'replace' | 'merge' = 'replace'
  ) => {
    const parsed = JSON.parse(jsonStr);
    const result = await backup.importAllData(db, parsed, mode);
    await refreshData();
    return result;
  };

  const resetAllData = async () => {
    await backup.resetDatabase(db);
    await refreshData();
  };

  return (
    <WalletContext.Provider
      value={{
        wallets,
        transactions,
        debts,
        categories,
        plannedExpenses,
        summary,
        categorySpendings,
        totalPendingPlanned,
        safeToSpendBalance,
        isLoading,
        isBalanceHidden,
        toggleHideBalance,
        activeWalletFilter,
        setActiveWalletFilter,
        refreshData,
        addTransaction,
        removeTransaction,
        updateTransactionCategory,
        splitTransaction,
        addWallet,
        editWallet,
        adjustBalance,
        removeWallet,
        addDebt,
        payOrCollectDebt,
        removeDebt,
        addCategory,
        editCategory,
        removeCategory,
        addPlannedExpense,
        editPlannedExpense,
        executePlannedExpense,
        removePlannedExpense,
        exportDataToJsonString,
        importDataFromJsonString,
        resetAllData,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet phải được sử dụng bên trong WalletProvider');
  }
  return context;
};
