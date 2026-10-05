import { describe, it, expect } from '@jest/globals';
import {
  VIETNAMESE_BANKS,
  findBankByBin,
  findBankByName,
  getBankDeeplinkUrl,
} from '../banks';

describe('banks constant', () => {
  it('includes MoMo with BIN 971025 and correct logo and appId', () => {
    const momo = findBankByBin('971025');
    expect(momo).toBeDefined();
    expect(momo?.bin).toBe('971025');
    expect(momo?.shortName).toBe('MoMo');
    expect(momo?.code).toBe('MOMO');
    expect(momo?.logo).toBe('https://cdn.vietqr.io/img/momo.png');
    expect(momo?.appId).toBe('momo');
    expect(momo?.name).toContain('MoMo');
  });

  it('provides logo URLs and appIds for major banks', () => {
    const mb = findBankByBin('970422');
    expect(mb?.logo).toBe('https://cdn.vietqr.io/img/MB.png');
    expect(mb?.appId).toBe('mb');

    const vcb = findBankByBin('970436');
    expect(vcb?.logo).toBe('https://cdn.vietqr.io/img/VCB.png');
    expect(vcb?.appId).toBe('vcb');

    const tcb = findBankByBin('970407');
    expect(tcb?.logo).toBe('https://cdn.vietqr.io/img/TCB.png');
    expect(tcb?.appId).toBe('tcb');

    const bidv = findBankByBin('970418');
    expect(bidv?.logo).toBe('https://cdn.vietqr.io/img/BIDV.png');
    expect(bidv?.appId).toBe('bidv');

    const icb = findBankByBin('970415');
    expect(icb?.logo).toBe('https://cdn.vietqr.io/img/ICB.png');
    expect(icb?.appId).toBe('icb');
  });

  it('finds bank by BIN correctly', () => {
    const vcb = findBankByBin('970436');
    expect(vcb?.shortName).toBe('Vietcombank');

    const mb = findBankByBin('970422');
    expect(mb?.shortName).toBe('MBBank');

    const notFound = findBankByBin('000000');
    expect(notFound).toBeUndefined();

    const empty = findBankByBin(null);
    expect(empty).toBeUndefined();
  });

  it('supports searching MoMo in the banks list', () => {
    const query = 'momo';
    const matches = VIETNAMESE_BANKS.filter(b =>
      b.shortName.toLowerCase().includes(query) ||
      b.name.toLowerCase().includes(query) ||
      b.code.toLowerCase().includes(query) ||
      b.bin.includes(query)
    );
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some(b => b.bin === '971025')).toBe(true);
  });

  describe('getBankDeeplinkUrl', () => {
    it('generates base deeplink url for standard bank', () => {
      const mb = findBankByBin('970422');
      expect(getBankDeeplinkUrl(mb)).toBe('https://dl.vietqr.io/pay?app=mb');
    });

    it('generates custom scheme for MoMo', () => {
      const momo = findBankByBin('971025');
      expect(getBankDeeplinkUrl(momo)).toBe('momo://');
    });

    it('generates parameterized deeplink url with account, bankCode, amount, and note', () => {
      const mb = findBankByBin('970422');
      const url = getBankDeeplinkUrl(mb, {
        account: '1234567890',
        bankCode: 'VCB',
        amount: 500000,
        note: 'Tra no anh Nam',
      });
      expect(url).toBe(
        'https://dl.vietqr.io/pay?app=mb&ba=1234567890@vcb&am=500000&tn=Tra%20no%20anh%20Nam'
      );
    });

    it('returns undefined if bank has no appId or is null', () => {
      expect(getBankDeeplinkUrl(null)).toBeUndefined();
      const sacombank = findBankByBin('970403');
      expect(getBankDeeplinkUrl(sacombank)).toBeUndefined();
    });
  });

  describe('findBankByName - auto detect BIN from wallet name', () => {
    it('detects MoMo from various wallet name variations', () => {
      expect(findBankByName('MoMo')?.bin).toBe('971025');
      expect(findBankByName('Ví MoMo')?.bin).toBe('971025');
      expect(findBankByName('momo của Thắng')?.bin).toBe('971025');
      expect(findBankByName('Vi MoMo')?.bin).toBe('971025');
    });

    it('detects Vietcombank from short name, code, or aliases', () => {
      expect(findBankByName('Vietcombank')?.bin).toBe('970436');
      expect(findBankByName('VCB')?.bin).toBe('970436');
      expect(findBankByName('Tài khoản VCB cá nhân')?.bin).toBe('970436');
      expect(findBankByName('vietcom')?.bin).toBe('970436');
    });

    it('detects MB Bank correctly without false positives', () => {
      expect(findBankByName('MB')?.bin).toBe('970422');
      expect(findBankByName('MBBank')?.bin).toBe('970422');
      expect(findBankByName('Thẻ MB')?.bin).toBe('970422');
      expect(findBankByName('Ngân hàng quân đội')?.bin).toBe('970422');
      // Must not falsely match 'mb' substring in ordinary words
      expect(findBankByName('Hộp bim bim')).toBeUndefined();
    });

    it('detects other popular banks and digital wallets', () => {
      expect(findBankByName('Techcombank')?.bin).toBe('970407');
      expect(findBankByName('TCB')?.bin).toBe('970407');
      expect(findBankByName('ACB')?.bin).toBe('970416');
      expect(findBankByName('Ngân hàng Á Châu')?.bin).toBe('970416');
      expect(findBankByName('BIDV')?.bin).toBe('970418');
      expect(findBankByName('TPBank')?.bin).toBe('970423');
      expect(findBankByName('Tiên Phong')?.bin).toBe('970423');
      expect(findBankByName('Cake')?.bin).toBe('546034');
      expect(findBankByName('Timo')?.bin).toBe('963388');
      expect(findBankByName('Viettel Money')?.bin).toBe('971005');
      expect(findBankByName('ViettelPay')?.bin).toBe('971005');
      expect(findBankByName('VNPT Money')?.bin).toBe('971011');
      expect(findBankByName('Agribank')?.bin).toBe('970405');
      expect(findBankByName('Sacombank')?.bin).toBe('970403');
    });

    it('returns undefined for non-bank names', () => {
      expect(findBankByName('Tiền mặt')).toBeUndefined();
      expect(findBankByName('Ví tiêu dùng')).toBeUndefined();
      expect(findBankByName('Heo đất')).toBeUndefined();
      expect(findBankByName('')).toBeUndefined();
      expect(findBankByName(null)).toBeUndefined();
    });
  });
});
