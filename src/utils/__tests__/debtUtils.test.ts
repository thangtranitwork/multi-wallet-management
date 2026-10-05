import { describe, it, expect } from '@jest/globals';
import { hasWalletQR, getDebtQRWallet } from '../debtUtils';
import { Debt, Wallet } from '../../types';

describe('debtUtils', () => {
  const cashWallet: Wallet = {
    id: 'w_cash',
    name: 'Tiền mặt',
    type: 'cash',
    balance: 500000,
    credit_limit: 0,
    currency: 'VND',
    color: '#10B981',
    icon: 'cash-outline',
    is_excluded: 0,
    bank_bin: null,
    bank_account: null,
    qr_image_uri: null,
    created_at: new Date().toISOString(),
  };

  const vcbWallet: Wallet = {
    id: 'w_vcb',
    name: 'Vietcombank',
    type: 'bank',
    balance: 2000000,
    credit_limit: 0,
    currency: 'VND',
    color: '#059669',
    icon: 'business-outline',
    is_excluded: 0,
    bank_bin: '970436',
    bank_account: '123456789',
    qr_image_uri: null,
    created_at: new Date().toISOString(),
  };

  const mbWallet: Wallet = {
    id: 'w_mb',
    name: 'MB Bank',
    type: 'bank',
    balance: 1500000,
    credit_limit: 0,
    currency: 'VND',
    color: '#2563EB',
    icon: 'business-outline',
    is_excluded: 0,
    bank_bin: '970422',
    bank_account: '987654321',
    qr_image_uri: null,
    created_at: new Date().toISOString(),
  };

  const customQrWallet: Wallet = {
    id: 'w_momo',
    name: 'MoMo',
    type: 'e_wallet',
    balance: 300000,
    credit_limit: 0,
    currency: 'VND',
    color: '#EC4899',
    icon: 'wallet-outline',
    is_excluded: 0,
    bank_bin: null,
    bank_account: null,
    qr_image_uri: 'file:///data/user/0/com.app/files/wallet_qrs/momo.jpg',
    created_at: new Date().toISOString(),
  };

  const baseDebt: Debt = {
    id: 'debt_1',
    type: 'lend',
    person_name: 'Nguyễn Văn A',
    person_phone: '0901234567',
    initial_amount: 200000,
    remaining_amount: 200000,
    wallet_id: 'w_cash',
    status: 'active',
    created_at: new Date().toISOString(),
  };

  describe('hasWalletQR', () => {
    it('returns true if wallet has bank_bin and bank_account', () => {
      expect(hasWalletQR(vcbWallet)).toBe(true);
    });

    it('returns true if wallet has custom qr_image_uri', () => {
      expect(hasWalletQR(customQrWallet)).toBe(true);
    });

    it('returns false if wallet has neither bank info nor QR image', () => {
      expect(hasWalletQR(cashWallet)).toBe(false);
    });

    it('returns false for null or undefined', () => {
      expect(hasWalletQR(null)).toBe(false);
      expect(hasWalletQR(undefined)).toBe(false);
    });
  });

  describe('getDebtQRWallet', () => {
    it('returns spent wallet if spent wallet has QR', () => {
      const debtFromVcb: Debt = { ...baseDebt, wallet_id: 'w_vcb' };
      const result = getDebtQRWallet(debtFromVcb, [cashWallet, vcbWallet, mbWallet]);
      expect(result?.id).toBe('w_vcb');
    });

    it('falls back to the first wallet with QR if spent wallet does NOT have QR', () => {
      // Ví đã chi là Tiền mặt (không có QR), danh sách gồm: Tiền mặt, VCB (có QR), MB (có QR)
      const debtFromCash: Debt = { ...baseDebt, wallet_id: 'w_cash' };
      const result = getDebtQRWallet(debtFromCash, [cashWallet, vcbWallet, mbWallet]);
      // Phải tự động lấy ví đầu tiên có QR (VCB)
      expect(result?.id).toBe('w_vcb');
    });

    it('falls back to first wallet with custom QR image if spent wallet has no QR', () => {
      const debtFromCash: Debt = { ...baseDebt, wallet_id: 'w_cash' };
      const result = getDebtQRWallet(debtFromCash, [cashWallet, customQrWallet]);
      expect(result?.id).toBe('w_momo');
    });

    it('returns first wallet with QR if debt has no wallet_id', () => {
      const debtWithoutWallet: Debt = { ...baseDebt, wallet_id: undefined };
      const result = getDebtQRWallet(debtWithoutWallet, [cashWallet, mbWallet, vcbWallet]);
      expect(result?.id).toBe('w_mb');
    });

    it('falls back safely to spent wallet or first wallet when NO wallet has QR', () => {
      const cash2: Wallet = { ...cashWallet, id: 'w_cash_2', name: 'Ống heo' };
      const result = getDebtQRWallet(baseDebt, [cashWallet, cash2]);
      expect(result?.id).toBe('w_cash');
    });

    it('returns null safely for empty wallets array or null debt', () => {
      expect(getDebtQRWallet(null, [vcbWallet])).toBeNull();
      expect(getDebtQRWallet(baseDebt, [])).toBeNull();
    });
  });
});
