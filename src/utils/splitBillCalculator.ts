import { BillMember, BillItem, BillAdjustment, BillMemberShare } from '../types';

export interface SplitCalculationResult {
  shares: BillMemberShare[];
  itemsSum: number;
  adjustmentsSum: number; // fee(+) - discount(-)
  calculatedTotal: number; // itemsSum + adjustmentsSum
  diffWithTransaction: number; // calculatedTotal - transactionAmount
  unassignedItemsCount: number;
}

/**
 * Tính toán số tiền mỗi thành viên phải trả khi chia theo từng món
 * @param transactionAmount Tổng tiền của giao dịch gốc
 * @param members Danh sách thành viên (phải có ít nhất 1 người)
 * @param items Danh sách các món ăn / dịch vụ
 * @param adjustments Phụ phí / giảm giá
 */
export function calculateItemizedBillShares(
  transactionAmount: number,
  members: BillMember[],
  items: BillItem[],
  adjustments: BillAdjustment[]
): SplitCalculationResult {
  if (members.length === 0) {
    return {
      shares: [],
      itemsSum: 0,
      adjustmentsSum: 0,
      calculatedTotal: 0,
      diffWithTransaction: -transactionAmount,
      unassignedItemsCount: items.length,
    };
  }

  // 1. Tính tổng phụ phí và giảm giá
  let totalFees = 0;
  let totalDiscounts = 0;
  adjustments.forEach(adj => {
    if (adj.type === 'fee') {
      totalFees += Math.max(0, adj.amount || 0);
    } else {
      totalDiscounts += Math.max(0, adj.amount || 0);
    }
  });
  const netAdjustment = totalFees - totalDiscounts;

  // Chia đều điều chỉnh theo đầu người
  const memberCount = members.length;
  const adjustmentPerPerson = memberCount > 0 ? netAdjustment / memberCount : 0;

  // 2. Tính tiền món của từng người
  const memberItemTotals: Record<string, number> = {};
  members.forEach(m => {
    memberItemTotals[m.id] = 0;
  });

  let totalItemsSum = 0;
  let unassignedCount = 0;

  items.forEach(item => {
    const itemTotal = Math.max(0, item.price || 0) * Math.max(1, item.quantity || 1);
    totalItemsSum += itemTotal;

    const assignedIds = (item.assignedMemberIds || []).filter(id =>
      members.some(m => m.id === id)
    );

    if (assignedIds.length === 0) {
      unassignedCount++;
    } else {
      const sharePerAssignedMember = itemTotal / assignedIds.length;
      assignedIds.forEach(id => {
        if (memberItemTotals[id] !== undefined) {
          memberItemTotals[id] += sharePerAssignedMember;
        }
      });
    }
  });

  const calculatedTotal = totalItemsSum + netAdjustment;

  // 3. Tính số tiền cho từng người
  // Phân chia: làm tròn số tiền của các thành viên khác trước, phần còn lại của hóa đơn thuộc về người chi trả (Payer)
  // để đảm bảo không bị sai lệch dù chỉ 1 đồng.
  const payerMember = members.find(m => m.isPayer) || members[0];
  const otherMembers = members.filter(m => m.id !== payerMember.id);

  let totalOthersRounded = 0;
  const otherShares: BillMemberShare[] = otherMembers.map(m => {
    const subtotal = memberItemTotals[m.id] || 0;
    const rawFinal = Math.max(0, subtotal + adjustmentPerPerson);
    const finalAmount = Math.round(rawFinal);
    totalOthersRounded += finalAmount;

    return {
      memberId: m.id,
      memberName: m.name,
      memberPhone: m.phone,
      isPayer: false,
      itemsSubtotal: Math.round(subtotal),
      adjustmentShare: Math.round(adjustmentPerPerson),
      finalAmount,
    };
  });

  // Số tiền của chủ xị:
  // Nếu calculatedTotal đã khớp tương đối hoặc lớn hơn 0, chủ xị nhận phần còn lại của transactionAmount
  const payerSubtotal = memberItemTotals[payerMember.id] || 0;
  const payerRawFinal = Math.max(0, payerSubtotal + adjustmentPerPerson);

  // Nếu tổng giao dịch lớn hơn 0, tiền chủ chi = transactionAmount - totalOthersRounded
  // Nếu transactionAmount = 0 (tự nhập), tiền chủ chi = làm tròn raw
  const payerFinalAmount =
    transactionAmount > 0
      ? Math.max(0, transactionAmount - totalOthersRounded)
      : Math.round(payerRawFinal);

  const payerShare: BillMemberShare = {
    memberId: payerMember.id,
    memberName: payerMember.name,
    memberPhone: payerMember.phone,
    isPayer: true,
    itemsSubtotal: Math.round(payerSubtotal),
    adjustmentShare: Math.round(adjustmentPerPerson),
    finalAmount: payerFinalAmount,
  };

  // Thứ tự shares giữ nguyên theo thứ tự members
  const shares: BillMemberShare[] = members.map(m => {
    if (m.id === payerMember.id) return payerShare;
    return otherShares.find(s => s.memberId === m.id)!;
  });

  return {
    shares,
    itemsSum: totalItemsSum,
    adjustmentsSum: netAdjustment,
    calculatedTotal,
    diffWithTransaction: calculatedTotal - transactionAmount,
    unassignedItemsCount: unassignedCount,
  };
}
