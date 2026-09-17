/**
 * VietQR (EMVCo Merchant-Presented QR Code) Engine
 * 100% Offline, Pure TypeScript, NAPAS 247 Compliant
 */

export interface VietQRParams {
  bankBin: string;       // 6-digit Bank BIN (e.g. 970436)
  accountNumber: string; // Beneficiary Account Number
  amount?: number;       // Amount in VND
  purpose?: string;      // Payment message (auto converted to unaccented uppercase)
}

/**
 * Remove Vietnamese diacritics and convert to alphanumeric uppercase
 */
export function removeVietnameseTones(str: string): string {
  let result = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  result = result.replace(/[đĐ]/g, (match) => (match === 'đ' ? 'd' : 'D'));
  // Keep only uppercase A-Z, 0-9 and single space
  result = result.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

/**
 * Calculate CRC16-CCITT (polynomial 0x1021, init 0xFFFF, false)
 */
export function crc16Ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Format Tag-Length-Value (TLV)
 */
export function formatTLV(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

/**
 * Build VietQR string conforming to NAPAS 247 specification
 */
export function generateVietQRPayload({
  bankBin,
  accountNumber,
  amount,
  purpose,
}: VietQRParams): string {
  // Clean bankBin and accountNumber
  const cleanBin = bankBin.trim();
  const cleanAccount = accountNumber.trim().replace(/\s+/g, '');

  if (!cleanBin || !cleanAccount) {
    return '';
  }

  // Tag 00: Payload Format Indicator
  let payload = formatTLV('00', '01');

  // Tag 01: Point of Initiation Method (11: Static QR, 12: Dynamic QR with specific amount)
  const isDynamic = !!(amount && amount > 0);
  payload += formatTLV('01', isDynamic ? '12' : '11');

  // Tag 38: Merchant Account Information - NAPAS 247
  // Sub-tag 00: GUID
  const sub00 = formatTLV('00', 'A000000727');
  // Sub-tag 01: Beneficiary Info (sub-sub 00: BIN, sub-sub 01: Account Number)
  const benInfo = formatTLV('00', cleanBin) + formatTLV('01', cleanAccount);
  const sub01 = formatTLV('01', benInfo);
  // Sub-tag 02: Service Code (QRIBFTTA: Transfer to Account)
  const sub02 = formatTLV('02', 'QRIBFTTA');

  const tag38Value = sub00 + sub01 + sub02;
  payload += formatTLV('38', tag38Value);

  // Tag 53: Transaction Currency (704 = VND)
  payload += formatTLV('53', '704');

  // Tag 54: Transaction Amount
  if (isDynamic) {
    const cleanAmount = Math.round(amount!).toString();
    payload += formatTLV('54', cleanAmount);
  }

  // Tag 58: Country Code
  payload += formatTLV('58', 'VN');

  // Tag 62: Additional Data Field Template
  if (purpose && purpose.trim()) {
    const cleanPurpose = removeVietnameseTones(purpose).slice(0, 25);
    if (cleanPurpose) {
      const sub08 = formatTLV('08', cleanPurpose);
      payload += formatTLV('62', sub08);
    }
  }

  // Tag 63: CRC16 Checksum
  const preCrc = payload + '6304';
  const checksum = crc16Ccitt(preCrc);

  return preCrc + checksum;
}
