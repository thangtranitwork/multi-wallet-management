/**
 * Tiện ích xử lý mã VietQR và định dạng số tiền cho mã QR.
 */

export interface VietQRParams {
  bankBin?: string | null;
  bankAccount?: string | null;
  template?: 'compact2' | 'compact' | 'qr_only' | 'print';
  amount?: number | null;
  purpose?: string | null;
}

/**
 * Xây dựng URL hình ảnh VietQR chuẩn NAPAS 24/7 từ vietqr.io
 * - Tự động bỏ qua `amount` nếu số tiền <= 0 (cho phép mã QR linh hoạt người quét tự nhập)
 * - Tự động cắt `addInfo` tối đa 25 ký tự chuẩn VietQR
 */
export function buildVietQRUrl({
  bankBin,
  bankAccount,
  template = 'compact2',
  amount = 0,
  purpose = '',
}: VietQRParams): string | null {
  if (!bankBin || !bankAccount) return null;
  const cleanBin = bankBin.trim();
  const cleanAccount = bankAccount.trim();
  if (!cleanBin || !cleanAccount) return null;

  const queryParts: string[] = [];
  const roundedAmount = Math.round(amount || 0);
  if (roundedAmount > 0) {
    queryParts.push(`amount=${roundedAmount}`);
  }

  const cleanPurpose = (purpose || '').trim();
  if (cleanPurpose) {
    queryParts.push(`addInfo=${encodeURIComponent(cleanPurpose.slice(0, 25))}`);
  }

  const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  return `https://img.vietqr.io/image/${cleanBin}-${cleanAccount}-${template}.png${qs}`;
}

/**
 * Trích xuất giá trị số từ chuỗi nhập liệu tiền tệ (loại bỏ dấu phân cách)
 */
export function parseAmountInput(text: string | null | undefined): number {
  if (!text) return 0;
  const digits = text.replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

/**
 * Định dạng số thành chuỗi hiển thị có dấu phân cách nghìn (vi-VN)
 */
export function formatAmountInput(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'number' ? value : parseAmountInput(value);
  if (num <= 0) return '';
  return num.toLocaleString('vi-VN');
}
