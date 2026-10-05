import { describe, it, expect } from '@jest/globals';
import {
  getInvoiceOptions,
  getAvailableQrOptions,
  buildInvoiceData,
  generateInvoiceHTML,
  generateInvoiceText,
} from '../invoiceGenerator';
import { Transaction, Wallet, BillMember, BillItem, BillAdjustment } from '../../types';

describe('invoiceGenerator', () => {
  const mockWallet: Wallet = {
    id: 'w_momo',
    name: 'Ví MoMo',
    type: 'e_wallet',
    balance: 500000,
    currency: 'VND',
    color: '#D82D8B',
    icon: 'wallet-outline',
    bank_bin: '970422',
    bank_account: '0987654321',
    credit_limit: 0,
    is_excluded: 0,
    created_at: '2026-01-01T00:00:00Z',
  };

  const mockTransaction: Transaction = {
    id: 'tx_123',
    wallet_id: 'w_momo',
    category_id: 'cat_food',
    amount: 119000,
    type: 'expense',
    note: 'MioMio - Mua đồ ăn vặt, snack và mì gói [Đã tách cho Hà Thắng]',
    transacted_at: '2026-10-02T21:56:00Z',
    created_at: '2026-10-02T21:56:00Z',
  };

  const mockMembers: BillMember[] = [
    { id: 'me', name: 'Bạn', isPayer: true },
    { id: 'm_thang', name: 'Hà Thắng' },
  ];

  const mockItems: BillItem[] = [
    {
      id: 'i1',
      name: 'Nước Bưởi Smart C',
      quantity: 1,
      price: 11000,
      assignedMemberIds: ['me'],
    },
    {
      id: 'i2',
      name: 'Mì Hảo Hảo Big 100',
      quantity: 4,
      price: 6500, // 26.000 for 4
      assignedMemberIds: ['me', 'm_thang'],
      memberQuantities: { me: 1, m_thang: 3 },
    },
    {
      id: 'i3',
      name: 'Umiki Ô mai cầu vồng',
      quantity: 1,
      price: 39000,
      assignedMemberIds: ['m_thang'],
    },
  ];

  const mockAdjustments: BillAdjustment[] = [
    { id: 'a1', type: 'fee', name: 'Phí ship', amount: 10000 },
  ];

  it('getInvoiceOptions returns total, my share, and member share', () => {
    const options = getInvoiceOptions(mockTransaction, {
      items: mockItems,
      adjustments: mockAdjustments,
      members: mockMembers,
    });

    expect(options.length).toBe(3);
    expect(options[0].type).toBe('total');
    expect(options[0].name).toBe('Hóa đơn tổng');
    expect(options[1].type).toBe('my_share');
    expect(options[1].name).toBe('Của tôi (Bạn)');
    expect(options[2].type).toBe('member_share');
    expect(options[2].name).toBe('Của Hà Thắng');
  });

  it('getAvailableQrOptions lists VietQR, wallet image, and custom QR options', () => {
    const walletWithQr: Wallet = {
      ...mockWallet,
      id: 'w_bank',
      name: 'Vietcombank',
      qr_image_uri: 'file:///data/wallet_qrs/vcb.png',
    };

    const qrOpts = getAvailableQrOptions([mockWallet, walletWithQr], 'file:///data/custom_qr.png');
    expect(qrOpts.some((q) => q.type === 'none')).toBe(true);
    expect(qrOpts.some((q) => q.type === 'vietqr')).toBe(true);
    expect(qrOpts.some((q) => q.type === 'wallet_image')).toBe(true);
    expect(qrOpts.some((q) => q.type === 'custom_image')).toBe(true);
  });

  it('buildInvoiceData builds full invoice correctly', () => {
    const options = getInvoiceOptions(mockTransaction, {
      items: mockItems,
      adjustments: mockAdjustments,
      members: mockMembers,
    });

    const totalData = buildInvoiceData(
      options[0],
      mockTransaction,
      { items: mockItems, adjustments: mockAdjustments, members: mockMembers },
      null,
      mockWallet
    );

    expect(totalData.title).toBe('HÓA ĐƠN TỔNG HỢP');
    expect(totalData.items.length).toBe(3);
    // items subtotal: 11000 + 26000 + 39000 = 76000
    expect(totalData.itemsSubtotal).toBe(76000);
    // plus 10000 fee = 86000
    expect(totalData.totalAmount).toBe(86000);
    expect(totalData.memberAllocations?.length).toBe(2);
  });

  it('buildInvoiceData builds member invoice correctly with custom quantities', () => {
    const options = getInvoiceOptions(mockTransaction, {
      items: mockItems,
      adjustments: mockAdjustments,
      members: mockMembers,
    });

    const thangOption = options.find((o) => o.id === 'm_thang')!;
    const thangData = buildInvoiceData(
      thangOption,
      mockTransaction,
      { items: mockItems, adjustments: mockAdjustments, members: mockMembers },
      null,
      mockWallet
    );

    expect(thangData.title).toContain('HÀ THẮNG');
    // Hà Thắng ordered: 3x mì Hảo Hảo (19.500) + 1x Umiki (39.000) = 58.500
    // plus half fee (5.000) = 63.500
    expect(thangData.items.length).toBe(2);
    expect(thangData.items.find((i) => i.name === 'Mì Hảo Hảo Big 100')?.quantity).toBe(3);
    expect(thangData.totalAmount).toBe(63500);
    expect(thangData.paymentInfo?.bankName).toBe('Ví MoMo');
  });

  it('generateInvoiceHTML produces valid HTML with QR and styling', () => {
    const options = getInvoiceOptions(mockTransaction, {
      items: mockItems,
      adjustments: mockAdjustments,
      members: mockMembers,
    });

    const thangOption = options.find((o) => o.id === 'm_thang')!;
    const thangData = buildInvoiceData(
      thangOption,
      mockTransaction,
      { items: mockItems, adjustments: mockAdjustments, members: mockMembers },
      null,
      mockWallet
    );

    const html = generateInvoiceHTML(thangData);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('VÍ CỦA TÔI');
    expect(html).toContain('HÀ THẮNG');
    expect(html).toContain('img.vietqr.io');
  });

  it('generateInvoiceText creates formatted text', () => {
    const options = getInvoiceOptions(mockTransaction, {
      items: mockItems,
      adjustments: mockAdjustments,
      members: mockMembers,
    });

    const thangOption = options.find((o) => o.id === 'm_thang')!;
    const thangData = buildInvoiceData(
      thangOption,
      mockTransaction,
      { items: mockItems, adjustments: mockAdjustments, members: mockMembers },
      null,
      mockWallet
    );

    const text = generateInvoiceText(thangData);
    expect(text).toContain('HÀ THẮNG');
    expect(text).toContain('SỐ TIỀN CẦN CHUYỂN');
    expect(text).toContain('Ví Của Tôi');
  });
});
