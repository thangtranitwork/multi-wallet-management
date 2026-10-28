import { describe, it, expect } from '@jest/globals';
import {
  getInvoiceOptions,
  getAvailableQrOptions,
  buildInvoiceData,
  buildDebtInvoiceData,
  getDebtInvoiceItems,
  generateInvoiceHTML,
  generateInvoiceText,
} from '../invoiceGenerator';
import { Transaction, Wallet, BillMember, BillItem, BillAdjustment, Debt } from '../../types';

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

    // Kiểm tra chi tiết phân bổ món cho từng thành viên kể cả Tôi
    const meAlloc = totalData.memberAllocations?.find((m) => m.isPayer || m.memberId === 'me');
    expect(meAlloc).toBeDefined();
    expect(meAlloc?.items?.length).toBeGreaterThan(0);

    const thangAlloc = totalData.memberAllocations?.find((m) => m.name === 'Hà Thắng');
    expect(thangAlloc).toBeDefined();
    expect(thangAlloc?.items?.length).toBe(2);
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
    expect(html).not.toContain('VÍ CỦA TÔI');
    expect(html).toContain('HÀ THẮNG');
    expect(html).toContain('img.vietqr.io');
    expect(html).toContain('aspect-ratio: 1');
    expect(html).toContain('63.500');
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
  });

  it('buildInvoiceData in total mode generates memberPaymentQrs with individual QRs', () => {
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

    expect(totalData.memberPaymentQrs).toBeDefined();
    expect(totalData.memberPaymentQrs?.length).toBe(1);
    expect(totalData.memberPaymentQrs?.[0].name).toBe('Hà Thắng');
    // Đảm bảo không tạo mã QR cho 'Bạn' / 'Tôi'
    expect(totalData.memberPaymentQrs?.some((q) => q.name === 'Bạn' || q.memberId === 'me')).toBe(false);
    expect(totalData.memberPaymentQrs?.[0].amount).toBe(63500);
    expect(totalData.memberPaymentQrs?.[0].qrUrl).toContain('img.vietqr.io');
    expect(totalData.memberPaymentQrs?.[0].qrUrl).toContain('amount=63500');

    // Test HTML generation displays member QR section
    const html = generateInvoiceHTML(totalData, undefined, 'members');
    expect(html).toContain('MÃ QR THANH TOÁN THEO TỪNG NGƯỜI');
    expect(html).toContain('Hà Thắng');
    expect(html).toContain('img.vietqr.io');
    expect(html).toContain('aspect-ratio: 1');
    expect(html).toContain('PHÂN BỔ THEO THÀNH VIÊN');
  });

  it('correctly handles 100% covered split bill with [Trả hộ 100% - Đã tách cho ...]', () => {
    const tx100 = {
      ...mockTransaction,
      amount: 0,
      note: 'Trà sữa KOI Thé [Trả hộ 100% - Đã tách cho Lan, Nam]',
    };

    // Khi không có mảng members trong parsedBill nhưng có items
    const options = getInvoiceOptions(tx100, {
      items: mockItems,
      adjustments: mockAdjustments,
    });

    expect(options.length).toBe(4); // total + me + Lan + Nam
    const lanOpt = options.find((o) => o.targetPersonName === 'Lan')!;
    expect(lanOpt).toBeDefined();

    const totalData = buildInvoiceData(
      options[0],
      tx100,
      { items: mockItems, adjustments: mockAdjustments },
      null,
      mockWallet
    );

    expect(totalData.subtitle).toBe('Trà sữa KOI Thé');
    expect(totalData.memberPaymentQrs?.length).toBe(2);
    expect(totalData.memberPaymentQrs?.[0].name).toBe('Lan');
    expect(totalData.memberPaymentQrs?.[1].name).toBe('Nam');
  });

  describe('Debt invoice generation & merging', () => {
    const mockDebt1: Debt = {
      id: 'd_1',
      type: 'lend',
      person_name: 'Anh Nam',
      initial_amount: 45000,
      remaining_amount: 45000,
      wallet_id: 'w_momo',
      status: 'active',
      note: 'Cơm chiên bò',
      items: JSON.stringify([
        { name: 'Cơm chiên bò', quantity: 1, price: 45000, totalPrice: 45000 },
      ]),
      created_at: '2026-10-22T10:00:00Z',
    };

    const mockDebt2: Debt = {
      id: 'd_2',
      type: 'lend',
      person_name: 'Anh Nam',
      initial_amount: 30000,
      remaining_amount: 30000,
      wallet_id: 'w_momo',
      status: 'active',
      note: 'Cà phê sáng',
      // Không có items -> fallback note x 1
      items: null,
      created_at: '2026-10-23T08:00:00Z',
    };

    it('getDebtInvoiceItems parses items when present and falls back to note x 1 when empty', () => {
      const items1 = getDebtInvoiceItems(mockDebt1);
      expect(items1.length).toBe(1);
      expect(items1[0].name).toBe('Cơm chiên bò');
      expect(items1[0].totalPrice).toBe(45000);

      const items2 = getDebtInvoiceItems(mockDebt2);
      expect(items2.length).toBe(1);
      expect(items2[0].name).toBe('Cà phê sáng');
      expect(items2[0].quantity).toBe(1);
      expect(items2[0].totalPrice).toBe(30000);
    });

    it('buildDebtInvoiceData creates a single debt bill with qr_only format', () => {
      const qrOpts = getAvailableQrOptions([mockWallet]);
      const data = buildDebtInvoiceData([mockDebt1], qrOpts[1], mockWallet);

      expect(data.title).toContain('PHIẾU BÁO NỢ: ANH NAM');
      expect(data.targetName).toBe('Anh Nam');
      expect(data.totalAmount).toBe(45000);
      expect(data.items.length).toBe(1);
      expect(data.paymentInfo?.qrUrl).toContain('qr_only.png');
      expect(data.paymentInfo?.qrUrl).not.toContain('compact2.png');
      expect(data.paymentInfo?.transferNote).toContain('Anh Nam tra no');
    });

    it('buildDebtInvoiceData merges multiple debts for the same person into 1 combined bill', () => {
      const qrOpts = getAvailableQrOptions([mockWallet]);
      const data = buildDebtInvoiceData([mockDebt1, mockDebt2], qrOpts[1], mockWallet);

      expect(data.title).toContain('PHIẾU TỔNG HỢP NỢ: ANH NAM');
      expect(data.targetName).toBe('Anh Nam');
      // 45000 + 30000 = 75000
      expect(data.totalAmount).toBe(75000);
      expect(data.items.length).toBe(2);
      expect(data.items[0].name).toBe('Cơm chiên bò');
      expect(data.items[1].name).toBe('Cà phê sáng');
      expect(data.paymentInfo?.qrUrl).toContain('qr_only.png');
      expect(data.paymentInfo?.qrUrl).toContain('amount=75000');
    });
  });
});

