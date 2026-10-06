import { describe, it, expect } from '@jest/globals';
import {
  buildVietQRUrl,
  parseAmountInput,
  formatAmountInput,
} from '../qrUtils';

describe('qrUtils', () => {
  describe('buildVietQRUrl', () => {
    it('returns null if bankBin or bankAccount is missing or empty', () => {
      expect(buildVietQRUrl({ bankBin: '', bankAccount: '123' })).toBeNull();
      expect(buildVietQRUrl({ bankBin: '970422', bankAccount: '' })).toBeNull();
      expect(buildVietQRUrl({ bankBin: null, bankAccount: '123' })).toBeNull();
      expect(buildVietQRUrl({ bankBin: '970422', bankAccount: null })).toBeNull();
    });

    it('generates basic VietQR URL without amount or note when amount is 0', () => {
      const url = buildVietQRUrl({
        bankBin: '970422',
        bankAccount: '123456789',
      });
      expect(url).toBe('https://img.vietqr.io/image/970422-123456789-compact2.png');
    });

    it('generates VietQR URL with amount when amount > 0', () => {
      const url = buildVietQRUrl({
        bankBin: '970422',
        bankAccount: '123456789',
        amount: 250000,
      });
      expect(url).toBe('https://img.vietqr.io/image/970422-123456789-compact2.png?amount=250000');
    });

    it('generates VietQR URL with both amount and purpose', () => {
      const url = buildVietQRUrl({
        bankBin: '970436',
        bankAccount: '999888777',
        amount: 500000,
        purpose: 'Tien an trua',
      });
      expect(url).toBe(
        'https://img.vietqr.io/image/970436-999888777-compact2.png?amount=500000&addInfo=Tien%20an%20trua'
      );
    });

    it('limits addInfo to maximum 25 characters', () => {
      const longNote = 'Day la noi dung chuyen khoan rat dai qua 25 ky tu';
      const url = buildVietQRUrl({
        bankBin: '970422',
        bankAccount: '123456789',
        amount: 100000,
        purpose: longNote,
      });
      const expectedEncoded = encodeURIComponent(longNote.slice(0, 25));
      expect(url).toBe(
        `https://img.vietqr.io/image/970422-123456789-compact2.png?amount=100000&addInfo=${expectedEncoded}`
      );
    });

    it('supports custom template', () => {
      const url = buildVietQRUrl({
        bankBin: '970422',
        bankAccount: '123456789',
        template: 'qr_only',
        amount: 50000,
      });
      expect(url).toBe('https://img.vietqr.io/image/970422-123456789-qr_only.png?amount=50000');
    });
  });

  describe('parseAmountInput', () => {
    it('extracts number from plain string', () => {
      expect(parseAmountInput('50000')).toBe(50000);
    });

    it('extracts number from formatted string with dots or commas', () => {
      expect(parseAmountInput('1.500.000')).toBe(1500000);
      expect(parseAmountInput('1,500,000')).toBe(1500000);
    });

    it('returns 0 for empty or invalid string', () => {
      expect(parseAmountInput('')).toBe(0);
      expect(parseAmountInput(null)).toBe(0);
      expect(parseAmountInput(undefined)).toBe(0);
      expect(parseAmountInput('abc')).toBe(0);
    });
  });

  describe('formatAmountInput', () => {
    it('formats number into vietnamese locale string', () => {
      expect(formatAmountInput(50000)).toBe((50000).toLocaleString('vi-VN'));
      expect(formatAmountInput(1250000)).toBe((1250000).toLocaleString('vi-VN'));
    });

    it('formats string numbers', () => {
      expect(formatAmountInput('500000')).toBe((500000).toLocaleString('vi-VN'));
    });

    it('returns empty string for 0 or negative', () => {
      expect(formatAmountInput(0)).toBe('');
      expect(formatAmountInput(-500)).toBe('');
      expect(formatAmountInput('')).toBe('');
      expect(formatAmountInput(null)).toBe('');
    });
  });
});
