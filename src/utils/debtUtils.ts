import { Debt, Wallet } from '../types';

/**
 * Kiểm tra xem ví có cấu hình mã QR không (VietQR động qua tài khoản ngân hàng hoặc ảnh QR tải lên)
 */
export function hasWalletQR(wallet: Wallet | null | undefined): boolean {
  if (!wallet) return false;
  const hasVietQR = Boolean(wallet.bank_bin && wallet.bank_account);
  const hasCustomQR = Boolean(wallet.qr_image_uri);
  return hasVietQR || hasCustomQR;
}

/**
 * Lấy ví để hiển thị mã QR thu nợ / nhận tiền cho khoản nợ:
 * - Ưu tiên ví đã chi / gắn với khoản nợ nếu ví đó đã có mã QR.
 * - Nếu ví hiện đã chi không có QR, lấy QR từ ví đầu tiên có mã QR.
 * - Fallback nếu toàn bộ ví đều chưa có QR: trả về ví đã chi hoặc ví đầu tiên.
 */
export function getDebtQRWallet(
  debt: Debt | null | undefined,
  allWallets: Wallet[]
): Wallet | null {
  if (!debt || !allWallets || allWallets.length === 0) return null;

  // 1. Kiểm tra ví đã chi tiền cho khoản nợ
  const spentWallet = allWallets.find(w => w.id === debt.wallet_id);
  if (spentWallet && hasWalletQR(spentWallet)) {
    return spentWallet;
  }

  // 2. Nếu ví hiện đã chi không có QR, lấy từ ví đầu tiên có QR
  const firstWalletWithQR = allWallets.find(w => hasWalletQR(w));
  if (firstWalletWithQR) {
    return firstWalletWithQR;
  }

  // 3. Fallback: trả về ví đã chi hoặc ví đầu tiên
  return spentWallet || allWallets[0] || null;
}
