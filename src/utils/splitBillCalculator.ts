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
      // Kiểm tra xem món này có chia theo số lượng riêng cho từng người (memberQuantities) không
      const customQtyMap = item.memberQuantities;
      const hasCustomQuantities =
        customQtyMap &&
        assignedIds.some(id => typeof customQtyMap[id] === 'number' && customQtyMap[id] > 0);

      if (hasCustomQuantities) {
        const totalAssignedQty = assignedIds.reduce(
          (sum, id) => sum + Math.max(0, customQtyMap[id] || 0),
          0
        );

        if (totalAssignedQty > 0) {
          // Chia tiền món theo tỷ lệ số lượng từng người sử dụng
          assignedIds.forEach(id => {
            const memberQty = Math.max(0, customQtyMap[id] || 0);
            const memberShare = (memberQty / totalAssignedQty) * itemTotal;
            if (memberItemTotals[id] !== undefined) {
              memberItemTotals[id] += memberShare;
            }
          });
        } else {
          // Dự phòng chia đều nếu các số lượng nhập đều là 0
          const sharePerAssignedMember = itemTotal / assignedIds.length;
          assignedIds.forEach(id => {
            if (memberItemTotals[id] !== undefined) {
              memberItemTotals[id] += sharePerAssignedMember;
            }
          });
        }
      } else {
        // Mặc định chia đều theo số người dùng
        const sharePerAssignedMember = itemTotal / assignedIds.length;
        assignedIds.forEach(id => {
          if (memberItemTotals[id] !== undefined) {
            memberItemTotals[id] += sharePerAssignedMember;
          }
        });
      }
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
    const found = otherShares.find(s => s.memberId === m.id);
    if (found) return found;
    return {
      memberId: m.id,
      memberName: m.name || 'Người tham gia',
      memberPhone: m.phone || null,
      isPayer: false,
      itemsSubtotal: 0,
      adjustmentShare: 0,
      finalAmount: 0,
    };
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

export interface MemberItemizedPayload {
  items: BillItem[];
  adjustments: BillAdjustment[];
  members: BillMember[];
  itemsSummary: string;
}

/**
 * Trích xuất danh sách món và phụ phí / giảm giá cho riêng một thành viên khi tách đơn
 */
export function buildMemberItemizedPayload(
  share: BillMemberShare,
  billItems: BillItem[],
  billAdjustments: BillAdjustment[],
  totalMembersCount: number
): MemberItemizedPayload {
  const userItems: BillItem[] = [];

  billItems.forEach(it => {
    const assignedIds = it.assignedMemberIds || [];
    if (!assignedIds.includes(share.memberId)) return;

    const hasCustomQuantities =
      it.memberQuantities &&
      typeof it.memberQuantities[share.memberId] === 'number' &&
      it.memberQuantities[share.memberId] > 0;

    if (hasCustomQuantities) {
      const qty = it.memberQuantities![share.memberId];
      const totalAssignedQty = assignedIds.reduce(
        (sum, id) => sum + Math.max(0, it.memberQuantities?.[id] || 0),
        0
      );
      const totalItemCost = Math.max(0, it.price || 0) * Math.max(1, it.quantity || 1);
      const memberCost = totalAssignedQty > 0
        ? Math.round((qty / totalAssignedQty) * totalItemCost)
        : Math.round(totalItemCost / assignedIds.length);
      const unitPrice = qty > 0 ? Math.round(memberCost / qty) : memberCost;

      userItems.push({
        id: `split_${it.id}_${share.memberId}`,
        name: it.name,
        quantity: Math.max(1, qty),
        price: unitPrice,
        assignedMemberIds: [share.memberId],
      });
    } else {
      const count = assignedIds.length;
      const totalItemCost = Math.max(0, it.price || 0) * Math.max(1, it.quantity || 1);
      const sharePerPerson = count > 0 ? Math.round(totalItemCost / count) : totalItemCost;

      if (count > 1 && it.quantity > 1 && it.quantity % count === 0) {
        const userQty = it.quantity / count;
        userItems.push({
          id: `split_${it.id}_${share.memberId}`,
          name: it.name,
          quantity: userQty,
          price: it.price,
          assignedMemberIds: [share.memberId],
        });
      } else if (count > 1) {
        userItems.push({
          id: `split_${it.id}_${share.memberId}`,
          name: `${it.name} (Chia ${count})`,
          quantity: 1,
          price: sharePerPerson,
          assignedMemberIds: [share.memberId],
        });
      } else {
        userItems.push({
          id: `split_${it.id}_${share.memberId}`,
          name: it.name,
          quantity: Math.max(1, it.quantity || 1),
          price: it.price,
          assignedMemberIds: [share.memberId],
        });
      }
    }
  });

  const userAdjustments: BillAdjustment[] = [];
  if (billAdjustments && billAdjustments.length > 0 && totalMembersCount > 0) {
    billAdjustments.forEach(adj => {
      const adjAmount = Math.max(0, adj.amount || 0);
      const shareAdj = Math.round(adjAmount / totalMembersCount);
      if (shareAdj > 0) {
        userAdjustments.push({
          id: `split_${adj.id}_${share.memberId}`,
          name: totalMembersCount > 1 ? `${adj.name} (Chia ${totalMembersCount})` : adj.name,
          type: adj.type,
          amount: shareAdj,
        });
      }
    });
  }

  // Khớp chính xác với share.finalAmount để không bị lệch 1 đồng do làm tròn
  const itemsSum = userItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const adjNet = userAdjustments.reduce(
    (sum, adj) => sum + (adj.type === 'fee' ? adj.amount : -adj.amount),
    0
  );
  const currentTotal = itemsSum + adjNet;
  const roundingDiff = share.finalAmount - currentTotal;

  if (roundingDiff !== 0) {
    const singleQtyItem = userItems.find(it => it.quantity === 1);
    if (singleQtyItem) {
      singleQtyItem.price += roundingDiff;
    } else if (userItems.length > 0) {
      if (userItems[0].quantity > 1) {
        userItems[0].quantity -= 1;
        userItems.push({
          id: `${userItems[0].id}_adj`,
          name: userItems[0].name,
          quantity: 1,
          price: userItems[0].price + roundingDiff,
          assignedMemberIds: [share.memberId],
        });
      } else {
        userItems[0].price += roundingDiff;
      }
    }
  }

  if (userItems.length === 0 && share.finalAmount > 0) {
    userItems.push({
      id: `split_item_${Date.now()}_${share.memberId}`,
      name: 'Phần chia hóa đơn',
      quantity: 1,
      price: share.finalAmount,
      assignedMemberIds: [share.memberId],
    });
  }

  const itemsSummary = userItems.length > 0
    ? userItems.map(it => `${it.name}${it.quantity > 1 ? ` (x${it.quantity})` : ''}`).join(', ')
    : 'Chia đều hóa đơn';

  return {
    items: userItems,
    adjustments: userAdjustments,
    members: [
      {
        id: share.memberId,
        name: share.memberName,
        phone: share.memberPhone || null,
        isPayer: false,
      },
    ],
    itemsSummary,
  };
}
