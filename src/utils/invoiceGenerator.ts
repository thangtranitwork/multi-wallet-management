import { Transaction, Wallet, BillItem, BillAdjustment, BillMember } from '../types';
import { calculateItemizedBillShares } from './splitBillCalculator';
import dayjs from 'dayjs';

export type InvoiceType = 'total' | 'my_share' | 'member_share';

export interface InvoiceItemDisplay {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  note?: string;
}

export interface InvoiceMemberOption {
  id: string; // 'total' | 'me' | memberId
  type: InvoiceType;
  name: string;
  targetPersonName: string;
  totalAmount: number;
  itemsCount: number;
  memberId?: string;
}

export interface InvoiceQrOption {
  id: string; // 'none' | `vietqr_${w.id}` | `wallet_qr_${w.id}` | 'custom'
  type: 'none' | 'vietqr' | 'wallet_image' | 'custom_image';
  label: string;
  sublabel?: string;
  bankName?: string;
  accountNumber?: string;
  bankBin?: string;
  qrUrl?: string; // remote or local uri
}

export interface InvoiceReportData {
  title: string;
  subtitle: string;
  targetName: string;
  targetType: InvoiceType;
  dateStr: string;
  note: string;
  walletName?: string;
  items: InvoiceItemDisplay[];
  itemsSubtotal: number;
  adjustments: { name: string; type: 'fee' | 'discount'; amount: number }[];
  netAdjustments: number;
  totalAmount: number;
  memberAllocations?: { name: string; amount: number; isPayer?: boolean }[];
  paymentInfo?: {
    payerName?: string;
    bankName?: string;
    accountNumber?: string;
    qrUrl?: string;
  };
}

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(val || 0);
};

/**
 * Lấy danh sách các tùy chọn xuất hóa đơn:
 * 1. Hóa đơn tổng (Toàn bộ)
 * 2. Hóa đơn của tôi (Bạn)
 * 3. Hóa đơn của từng người khác được tách
 */
export function getInvoiceOptions(
  transaction: Transaction,
  parsedBill: { items?: BillItem[]; adjustments?: BillAdjustment[]; members?: BillMember[]; includeMeInSplit?: boolean } | null
): InvoiceMemberOption[] {
  if (!parsedBill || !Array.isArray(parsedBill.items) || parsedBill.items.length === 0) {
    return [
      {
        id: 'total',
        type: 'total',
        name: 'Hóa đơn tổng',
        targetPersonName: 'Toàn bộ giao dịch',
        totalAmount: transaction.amount,
        itemsCount: 0,
      },
    ];
  }

  const rawSum = parsedBill.items.reduce(
    (s, it) => s + (it.price || 0) * (it.quantity || 1),
    0
  );
  const netAdj = Array.isArray(parsedBill.adjustments)
    ? parsedBill.adjustments.reduce(
        (s, adj) => s + (adj.type === 'fee' ? adj.amount || 0 : -(adj.amount || 0)),
        0
      )
    : 0;
  const fullSum = rawSum + netAdj;

  const splitMatch = transaction.note?.match(/\[Đã tách cho ([^\]]+)\]/i);
  const hasMembers = Array.isArray(parsedBill.members) && parsedBill.members.length > 1;

  const options: InvoiceMemberOption[] = [
    {
      id: 'total',
      type: 'total',
      name: 'Hóa đơn tổng',
      targetPersonName: 'Toàn bộ hóa đơn',
      totalAmount: fullSum,
      itemsCount: parsedBill.items.length,
    },
  ];

  if (hasMembers) {
    const calcResult = calculateItemizedBillShares(
      transaction.amount,
      parsedBill.members!,
      parsedBill.items,
      parsedBill.adjustments || [],
      parsedBill.includeMeInSplit !== false
    );

    calcResult.shares.forEach((share) => {
      const isMe = share.memberId === 'me' || share.isPayer;
      const count = parsedBill.items!.filter((it) => {
        if (it.memberQuantities && Number(it.memberQuantities[share.memberId]) > 0) return true;
        if (Array.isArray(it.assignedMemberIds) && it.assignedMemberIds.includes(share.memberId))
          return true;
        return false;
      }).length;

      options.push({
        id: share.memberId,
        type: isMe ? 'my_share' : 'member_share',
        name: isMe ? 'Của tôi (Bạn)' : `Của ${share.memberName}`,
        targetPersonName: share.memberName,
        totalAmount: share.finalAmount,
        itemsCount: count,
        memberId: share.memberId,
      });
    });
  } else if (splitMatch) {
    const names = splitMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    const othersTotal = Math.max(0, fullSum - transaction.amount);
    const splitPerPerson = names.length > 0 ? othersTotal / names.length : othersTotal;

    options.push({
      id: 'me',
      type: 'my_share',
      name: 'Của tôi (Bạn)',
      targetPersonName: 'Bạn (Phần thực chi)',
      totalAmount: transaction.amount,
      itemsCount: parsedBill.items.length,
    });

    names.forEach((name, idx) => {
      options.push({
        id: `split_${idx}`,
        type: 'member_share',
        name: `Của ${name}`,
        targetPersonName: name,
        totalAmount: splitPerPerson,
        itemsCount: parsedBill.items!.length,
      });
    });
  } else {
    options.push({
      id: 'me',
      type: 'my_share',
      name: 'Của tôi (Bạn)',
      targetPersonName: 'Bạn (Người chi trả)',
      totalAmount: transaction.amount,
      itemsCount: parsedBill.items.length,
    });
  }

  return options;
}

/**
 * Lấy danh sách các mã QR khả dụng:
 * 1. Không kèm QR
 * 2. VietQR động từ các ví ngân hàng có NAPAS
 * 3. Ảnh QR tĩnh đã lưu trong các ví
 * 4. Ảnh QR tự chọn từ thư viện ảnh máy
 */
export function getAvailableQrOptions(
  wallets: Wallet[],
  customQrUri?: string | null
): InvoiceQrOption[] {
  const options: InvoiceQrOption[] = [
    {
      id: 'none',
      type: 'none',
      label: 'Không kèm QR',
      sublabel: 'Ẩn mã QR thanh toán',
    },
  ];

  (wallets || []).forEach((w) => {
    // 1. VietQR động nếu có bank_bin và bank_account
    if (w.bank_bin && w.bank_account) {
      options.push({
        id: `vietqr_${w.id}`,
        type: 'vietqr',
        label: `VietQR: ${w.name}`,
        sublabel: `STK: ${w.bank_account}`,
        bankName: w.name,
        accountNumber: w.bank_account,
        bankBin: w.bank_bin,
      });
    }

    // 2. Ảnh mã QR đã lưu trong ví (MoMo, ZaloPay, Vietcombank...)
    if (w.qr_image_uri) {
      options.push({
        id: `wallet_qr_${w.id}`,
        type: 'wallet_image',
        label: `Ảnh QR: ${w.name}`,
        sublabel: w.bank_account ? `STK: ${w.bank_account}` : 'Ảnh QR đã lưu',
        bankName: w.name,
        accountNumber: w.bank_account || undefined,
        qrUrl: w.qr_image_uri,
      });
    }
  });

  // 3. Ảnh tùy chọn từ thư viện máy
  if (customQrUri) {
    options.push({
      id: 'custom',
      type: 'custom_image',
      label: 'Ảnh QR từ thiết bị',
      sublabel: 'Đã tải từ thư viện ảnh',
      qrUrl: customQrUri,
    });
  }

  return options;
}

/**
 * Xây dựng dữ liệu chi tiết cho hóa đơn được chọn
 */
export function buildInvoiceData(
  option: InvoiceMemberOption,
  transaction: Transaction,
  parsedBill: { items?: BillItem[]; adjustments?: BillAdjustment[]; members?: BillMember[]; includeMeInSplit?: boolean } | null,
  selectedQr?: InvoiceQrOption | null,
  defaultWallet?: Wallet | null
): InvoiceReportData {
  const items = parsedBill?.items || [];
  const adjustments = parsedBill?.adjustments || [];
  const members = parsedBill?.members || [];
  const dateFormatted = dayjs(transaction.transacted_at).format('DD/MM/YYYY • HH:mm');

  // Làm sạch ghi chú (bỏ tag [Đã tách cho...])
  const cleanNote = (transaction.note || 'Chi tiêu')
    .replace(/\[Đã tách cho [^\]]+\]/gi, '')
    .trim();

  let calculatedAmount = option.totalAmount;
  let paymentInfo: InvoiceReportData['paymentInfo'] = undefined;

  if (selectedQr && selectedQr.type !== 'none') {
    if (selectedQr.type === 'vietqr' && selectedQr.bankBin && selectedQr.accountNumber) {
      const transferNote = `Tra tien ${cleanNote.slice(0, 20)}`.trim();
      const qrUrl = `https://img.vietqr.io/image/${selectedQr.bankBin}-${selectedQr.accountNumber}-compact2.png?amount=${Math.round(
        calculatedAmount
      )}&addInfo=${encodeURIComponent(transferNote)}`;

      paymentInfo = {
        payerName: 'Chủ tài khoản',
        bankName: selectedQr.bankName || defaultWallet?.name || 'Ngân hàng',
        accountNumber: selectedQr.accountNumber,
        qrUrl,
      };
    } else if (selectedQr.qrUrl) {
      paymentInfo = {
        payerName: 'Chủ tài khoản',
        bankName: selectedQr.bankName || defaultWallet?.name || 'Chuyển khoản',
        accountNumber: selectedQr.accountNumber,
        qrUrl: selectedQr.qrUrl,
      };
    }
  } else if (!selectedQr && defaultWallet?.bank_bin && defaultWallet?.bank_account && calculatedAmount > 0) {
    const transferNote = `Tra tien ${cleanNote.slice(0, 20)}`.trim();
    const qrUrl = `https://img.vietqr.io/image/${defaultWallet.bank_bin}-${defaultWallet.bank_account}-compact2.png?amount=${Math.round(
      calculatedAmount
    )}&addInfo=${encodeURIComponent(transferNote)}`;

    paymentInfo = {
      payerName: 'Chủ tài khoản',
      bankName: defaultWallet.name,
      accountNumber: defaultWallet.bank_account,
      qrUrl,
    };
  }

  if (option.type === 'total') {
    // 1. HÓA ĐƠN TỔNG HỢP
    const itemDisplays: InvoiceItemDisplay[] = items.map((it) => ({
      name: it.name,
      quantity: it.quantity || 1,
      unitPrice: it.price || 0,
      totalPrice: (it.price || 0) * (it.quantity || 1),
    }));

    const rawSum = itemDisplays.reduce((s, it) => s + it.totalPrice, 0);
    const netAdj = adjustments.reduce(
      (s, adj) => s + (adj.type === 'fee' ? adj.amount || 0 : -(adj.amount || 0)),
      0
    );

    let memberAllocations: { name: string; amount: number; isPayer?: boolean }[] | undefined;
    if (members.length > 1) {
      const calcResult = calculateItemizedBillShares(
        transaction.amount,
        members,
        items,
        adjustments,
        parsedBill?.includeMeInSplit !== false
      );
      memberAllocations = calcResult.shares.map((s) => ({
        name: s.memberName,
        amount: s.finalAmount,
        isPayer: s.isPayer,
      }));
    } else {
      const splitMatch = transaction.note?.match(/\[Đã tách cho ([^\]]+)\]/i);
      if (splitMatch) {
        const othersName = splitMatch[1];
        memberAllocations = [
          { name: 'Bạn (Thực chi)', amount: transaction.amount, isPayer: true },
          { name: othersName, amount: Math.max(0, rawSum + netAdj - transaction.amount) },
        ];
      }
    }

    return {
      title: 'HÓA ĐƠN TỔNG HỢP',
      subtitle: cleanNote,
      targetName: 'Toàn bộ hóa đơn',
      targetType: 'total',
      dateStr: dateFormatted,
      note: cleanNote,
      walletName: defaultWallet?.name,
      items: itemDisplays,
      itemsSubtotal: rawSum,
      adjustments: adjustments.map((a) => ({ name: a.name, type: a.type, amount: a.amount })),
      netAdjustments: netAdj,
      totalAmount: rawSum + netAdj,
      memberAllocations,
      paymentInfo,
    };
  }

  // 2. HÓA ĐƠN CỦA TÔI HOẶC CỦA NGƯỜI KHÁC
  const isMe = option.type === 'my_share';
  const targetMemberId = option.memberId || (isMe ? 'me' : undefined);

  if (members.length > 1 && targetMemberId) {
    const memberObj = members.find((m) => m.id === targetMemberId);
    const memberName = memberObj?.name || option.targetPersonName;

    const calcResult = calculateItemizedBillShares(
      transaction.amount,
      members,
      items,
      adjustments,
      parsedBill?.includeMeInSplit !== false
    );
    const memberShare = calcResult.shares.find((s) => s.memberId === targetMemberId);

    const memberItems: InvoiceItemDisplay[] = [];
    items.forEach((it) => {
      const assignedIds = it.assignedMemberIds || [];
      const customQtyMap = it.memberQuantities;
      const hasCustomQty = customQtyMap && Number(customQtyMap[targetMemberId]) > 0;

      if (hasCustomQty) {
        const myQty = Number(customQtyMap[targetMemberId]);
        const totalAssignedQty = assignedIds.reduce(
          (sum, id) => sum + Math.max(0, Number(customQtyMap[id]) || 0),
          0
        );
        const itemTotal = (it.price || 0) * (it.quantity || 1);
        const mySharePrice = totalAssignedQty > 0 ? (myQty / totalAssignedQty) * itemTotal : 0;

        memberItems.push({
          name: it.name,
          quantity: myQty,
          unitPrice: it.price || 0,
          totalPrice: Math.round(mySharePrice),
          note: totalAssignedQty > myQty ? `Sử dụng: ${myQty}/${it.quantity}` : undefined,
        });
      } else if (assignedIds.includes(targetMemberId)) {
        const itemTotal = (it.price || 0) * (it.quantity || 1);
        const sharePrice = itemTotal / Math.max(1, assignedIds.length);
        const myQty = (it.quantity || 1) / Math.max(1, assignedIds.length);

        memberItems.push({
          name: it.name,
          quantity: Number(myQty.toFixed(1)),
          unitPrice: it.price || 0,
          totalPrice: Math.round(sharePrice),
          note: assignedIds.length > 1 ? `Chia cùng ${assignedIds.length} người` : undefined,
        });
      }
    });

    const itemsSubtotal = memberShare?.itemsSubtotal || memberItems.reduce((s, it) => s + it.totalPrice, 0);
    const adjustmentShare = memberShare?.adjustmentShare || 0;
    const finalAmount = memberShare?.finalAmount || itemsSubtotal + adjustmentShare;

    if (selectedQr?.type === 'vietqr' && selectedQr.bankBin && selectedQr.accountNumber) {
      const transferNote = `Tra tien ${cleanNote.slice(0, 20)}`.trim();
      paymentInfo = {
        payerName: 'Chủ tài khoản',
        bankName: selectedQr.bankName || defaultWallet?.name || 'Ngân hàng',
        accountNumber: selectedQr.accountNumber,
        qrUrl: `https://img.vietqr.io/image/${selectedQr.bankBin}-${selectedQr.accountNumber}-compact2.png?amount=${Math.round(
          finalAmount
        )}&addInfo=${encodeURIComponent(transferNote)}`,
      };
    }

    return {
      title: isMe ? 'PHIẾU CHI TIÊU CÁ NHÂN' : `PHIẾU CHIA TIỀN: ${memberName.toUpperCase()}`,
      subtitle: cleanNote,
      targetName: memberName,
      targetType: option.type,
      dateStr: dateFormatted,
      note: cleanNote,
      walletName: defaultWallet?.name,
      items: memberItems,
      itemsSubtotal,
      adjustments: adjustmentShare !== 0 ? [{ name: 'Phần chia phụ phí/voucher', type: adjustmentShare >= 0 ? 'fee' : 'discount', amount: Math.abs(adjustmentShare) }] : [],
      netAdjustments: adjustmentShare,
      totalAmount: finalAmount,
      paymentInfo,
    };
  }

  // Trường hợp tách đơn bằng chia nhanh
  const itemDisplays: InvoiceItemDisplay[] = items.map((it) => ({
    name: it.name,
    quantity: it.quantity || 1,
    unitPrice: it.price || 0,
    totalPrice: (it.price || 0) * (it.quantity || 1),
  }));

  return {
    title: isMe ? 'PHIẾU CHI TIÊU CÁ NHÂN' : `PHIẾU CHIA TIỀN: ${option.targetPersonName.toUpperCase()}`,
    subtitle: cleanNote,
    targetName: option.targetPersonName,
    targetType: option.type,
    dateStr: dateFormatted,
    note: cleanNote,
    walletName: defaultWallet?.name,
    items: itemDisplays,
    itemsSubtotal: option.totalAmount,
    adjustments: [],
    netAdjustments: 0,
    totalAmount: option.totalAmount,
    paymentInfo,
  };
}

/**
 * Tạo mã HTML cho hóa đơn để in hoặc xuất file PDF (Chuyên nghiệp, không emoji)
 */
export function generateInvoiceHTML(data: InvoiceReportData, qrImageDataUri?: string): string {
  const isMember = data.targetType === 'member_share';
  const isMyShare = data.targetType === 'my_share';

  const itemsRowsHtml = data.items
    .map(
      (it, idx) => `
      <tr>
        <td style="text-align: center; color: #4b5563; font-size: 11px;">${idx + 1}</td>
        <td>
          <div style="font-weight: 700; color: #111827;">${it.name}</div>
          ${it.note ? `<div style="font-size: 10px; color: #6b7280;">(${it.note})</div>` : ''}
        </td>
        <td style="text-align: center; font-weight: 600;">${it.quantity}</td>
        <td style="text-align: right; color: #4b5563; font-size: 11px;">${formatCurrency(it.unitPrice)}</td>
        <td style="text-align: right; font-weight: 800; color: #111827;">${formatCurrency(it.totalPrice)}</td>
      </tr>
    `
    )
    .join('');

  const adjustmentsRowsHtml = data.adjustments
    .map(
      (adj) => `
      <tr style="color: ${adj.type === 'discount' ? '#059669' : '#d97706'}; font-style: italic;">
        <td colspan="4" style="text-align: right; padding-top: 5px; padding-bottom: 5px;">
          ${adj.type === 'discount' ? 'Giảm giá / Voucher: ' : 'Phụ phí: '} ${adj.name}
        </td>
        <td style="text-align: right; font-weight: 700; padding-top: 5px; padding-bottom: 5px;">
          ${adj.type === 'discount' ? '-' : '+'}${formatCurrency(adj.amount)}
        </td>
      </tr>
    `
    )
    .join('');

  const memberAllocationsHtml = data.memberAllocations
    ? `
      <div style="margin-top: 18px; padding: 12px; background: #f9fafb; border: 1.5px solid #111827; border-radius: 8px;">
        <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #111827; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; letter-spacing: 0.5px;">
          PHÂN BỔ THEO THÀNH VIÊN
        </div>
        ${data.memberAllocations
          .map(
            (m) => `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 12px;">
              <span style="font-weight: ${m.isPayer ? '800' : '600'}; color: ${m.isPayer ? '#059669' : '#111827'};">
                ${m.name} ${m.isPayer ? '(Đã thanh toán)' : ''}
              </span>
              <span style="font-weight: 800; color: #111827;">${formatCurrency(m.amount)}</span>
            </div>
          `
          )
          .join('')}
      </div>
    `
    : '';

  const activeQrSrc = qrImageDataUri || data.paymentInfo?.qrUrl;

  const paymentQrHtml = activeQrSrc
    ? `
      <div style="margin-top: 18px; padding: 14px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; text-align: center;">
        <div style="font-weight: 800; font-size: 11px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
          MÃ QR THANH TOÁN (VIETQR / VÍ)
        </div>
        ${data.paymentInfo?.bankName ? `
          <div style="font-size: 11px; color: #334155; margin-bottom: 8px;">
            <b>${data.paymentInfo.bankName}</b> ${data.paymentInfo.accountNumber ? `- STK: <b>${data.paymentInfo.accountNumber}</b>` : ''}
          </div>
        ` : ''}
        <img src="${activeQrSrc}" alt="QR Code" style="width: 160px; height: 160px; border-radius: 6px; border: 1px solid #94a3b8; background: #ffffff; object-fit: contain;" />
        <div style="font-size: 10px; color: #475569; margin-top: 6px;">
          Số tiền cần chuyển: <b style="color: #0f172a;">${formatCurrency(data.totalAmount)}</b>
        </div>
      </div>
    `
    : data.paymentInfo?.accountNumber
    ? `
      <div style="margin-top: 18px; padding: 12px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px;">
        <div style="font-weight: 800; font-size: 11px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
          THÔNG TIN THANH TOÁN
        </div>
        <div style="font-size: 12px; color: #1e293b;">
          Ngân hàng / Ví: <b>${data.paymentInfo.bankName}</b><br/>
          Số tài khoản: <b style="font-size: 13px; color: #0f172a;">${data.paymentInfo.accountNumber}</b>
        </div>
      </div>
    `
    : '';

  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${data.title}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background: #ffffff;
          color: #111827;
          padding: 24px;
          line-height: 1.4;
          font-size: 12px;
        }
        .receipt-container {
          max-width: 480px;
          margin: 0 auto;
          background: #ffffff;
          border: 2px solid #000000;
          border-radius: 10px;
          padding: 20px;
          box-shadow: 4px 4px 0px #000000;
        }
        .header {
          text-align: center;
          padding-bottom: 12px;
          border-bottom: 2px dashed #000000;
          margin-bottom: 12px;
        }
        .brand-title {
          font-size: 17px;
          font-weight: 900;
          letter-spacing: 1px;
          color: #000000;
          text-transform: uppercase;
        }
        .invoice-type {
          display: inline-block;
          margin-top: 5px;
          background: ${isMember ? '#f0fdf4' : isMyShare ? '#eff6ff' : '#000000'};
          color: ${isMember ? '#166534' : isMyShare ? '#1e40af' : '#ffffff'};
          border: 1px solid #000000;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 4px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .meta-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #4b5563;
          margin-top: 4px;
        }
        .meta-label { font-weight: 600; }
        .meta-val { font-weight: 700; color: #111827; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
        }
        th {
          border-bottom: 2px solid #000000;
          padding: 6px 4px;
          font-size: 10.5px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        td {
          padding: 7px 4px;
          border-bottom: 1px dashed #e5e7eb;
          vertical-align: middle;
        }
        .total-box {
          margin-top: 14px;
          padding: 12px;
          background: #fefce8;
          border: 2px solid #000000;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .total-label {
          font-size: 12.5px;
          font-weight: 900;
          text-transform: uppercase;
          color: #000000;
        }
        .total-val {
          font-size: 17px;
          font-weight: 900;
          color: #000000;
        }
        .footer {
          margin-top: 18px;
          text-align: center;
          font-size: 10px;
          color: #6b7280;
          border-top: 1px dashed #d1d5db;
          padding-top: 10px;
        }
        @media print {
          body { padding: 0; background: #ffffff; }
          .receipt-container {
            border: 1px solid #000000;
            box-shadow: none;
            max-width: 100%;
            border-radius: 0;
            padding: 14px;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="header">
          <div class="brand-title">VÍ CỦA TÔI</div>
          <div class="invoice-type">${data.title}</div>
          <div style="font-size: 13px; font-weight: 800; color: #111827; margin-top: 6px;">
            ${data.subtitle || data.note || 'Chi tiết giao dịch'}
          </div>
        </div>

        <div class="meta-row">
          <span class="meta-label">Thời gian:</span>
          <span class="meta-val">${data.dateStr}</span>
        </div>
        ${data.walletName ? `
          <div class="meta-row">
            <span class="meta-label">${isMember ? 'Đã chi từ:' : 'Nguồn chi trả:'}</span>
            <span class="meta-val">${data.walletName}</span>
          </div>
        ` : ''}
        <div class="meta-row">
          <span class="meta-label">Người nhận bill:</span>
          <span class="meta-val" style="color: #1e40af;">${data.targetName}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 24px; text-align: center;">STT</th>
              <th style="text-align: left;">Món / Dịch vụ</th>
              <th style="width: 32px; text-align: center;">SL</th>
              <th style="width: 70px; text-align: right;">Đơn giá</th>
              <th style="width: 85px; text-align: right;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
            ${adjustmentsRowsHtml}
          </tbody>
        </table>

        <div style="margin-top: 10px; padding: 0 4px;">
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: #4b5563; margin-bottom: 2px;">
            <span>Tạm tính các món:</span>
            <span style="font-weight: 700;">${formatCurrency(data.itemsSubtotal)}</span>
          </div>
          ${data.netAdjustments !== 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: #4b5563; margin-bottom: 2px;">
              <span>Phụ phí / Giảm giá:</span>
              <span style="font-weight: 700; color: ${data.netAdjustments > 0 ? '#d97706' : '#059669'};">
                ${data.netAdjustments > 0 ? '+' : ''}${formatCurrency(data.netAdjustments)}
              </span>
            </div>
          ` : ''}
        </div>

        <div class="total-box">
          <span class="total-label">
            ${isMember ? 'Cần chuyển khoản:' : isMyShare ? 'Phần bạn thanh toán:' : 'Tổng hóa đơn:'}
          </span>
          <span class="total-val">${formatCurrency(data.totalAmount)}</span>
        </div>

        ${memberAllocationsHtml}
        ${paymentQrHtml}

        <div class="footer">
          <div>Ứng dụng quản lý tài chính Ví Của Tôi</div>
          <div style="margin-top: 2px;">Thời điểm tạo: ${dayjs().format('DD/MM/YYYY HH:mm')}</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Tạo văn bản tóm tắt hóa đơn chuyên nghiệp không emoji để dán vào Zalo/Messenger
 */
export function generateInvoiceText(data: InvoiceReportData): string {
  const isMember = data.targetType === 'member_share';
  const isMyShare = data.targetType === 'my_share';

  let text = `[${data.title}]\n`;
  text += `Nội dung: ${data.subtitle || data.note || 'Chi tiết hóa đơn'}\n`;
  text += `Người nhận: ${data.targetName}\n`;
  text += `Thời gian: ${data.dateStr}\n`;
  text += `----------------------------------------\n`;

  data.items.forEach((it, idx) => {
    text += `${idx + 1}. ${it.name} (x${it.quantity}): ${formatCurrency(it.totalPrice)}\n`;
    if (it.note) text += `   (${it.note})\n`;
  });

  if (data.adjustments.length > 0) {
    text += `----------------------------------------\n`;
    data.adjustments.forEach((adj) => {
      text += `• ${adj.name}: ${adj.type === 'discount' ? '-' : '+'}${formatCurrency(adj.amount)}\n`;
    });
  }

  text += `========================================\n`;
  text += `${isMember ? 'SỐ TIỀN CẦN CHUYỂN' : isMyShare ? 'PHẦN BẠN CHI TRẢ' : 'TỔNG CỘNG'}: ${formatCurrency(data.totalAmount)}\n`;

  if (data.memberAllocations && data.memberAllocations.length > 0) {
    text += `\nPhân bổ thành viên:\n`;
    data.memberAllocations.forEach((m) => {
      text += `• ${m.name}: ${formatCurrency(m.amount)}\n`;
    });
  }

  if (data.paymentInfo?.bankName) {
    text += `\nThông tin chuyển khoản:\n`;
    text += `• Ngân hàng / Ví: ${data.paymentInfo.bankName}\n`;
    if (data.paymentInfo.accountNumber) {
      text += `• Số tài khoản: ${data.paymentInfo.accountNumber}\n`;
    }
  }

  text += `\n(Gửi từ Ví Của Tôi)`;
  return text;
}
