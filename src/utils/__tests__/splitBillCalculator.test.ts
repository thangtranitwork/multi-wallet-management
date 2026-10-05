import { describe, it, expect } from '@jest/globals';
import { calculateItemizedBillShares } from '../splitBillCalculator';
import { BillMember, BillItem, BillAdjustment } from '../../types';

describe('splitBillCalculator', () => {
  const members: BillMember[] = [
    { id: 'me', name: 'Tôi (Chủ chi)', isPayer: true },
    { id: 'user_1', name: 'Nguyễn Văn A', phone: '0901234567' },
    { id: 'user_2', name: 'Trần Thị B', phone: '0912345678' },
  ];

  it('calculates equal share correctly without adjustments', () => {
    const items: BillItem[] = [
      { id: 'i1', name: 'Lẩu hải sản', price: 300000, quantity: 1, assignedMemberIds: ['me', 'user_1', 'user_2'] },
    ];
    const adjustments: BillAdjustment[] = [];

    const result = calculateItemizedBillShares(300000, members, items, adjustments);
    expect(result.calculatedTotal).toBe(300000);
    expect(result.diffWithTransaction).toBe(0);

    const shareMe = result.shares.find(s => s.memberId === 'me');
    const shareA = result.shares.find(s => s.memberId === 'user_1');
    const shareB = result.shares.find(s => s.memberId === 'user_2');

    expect(shareA?.finalAmount).toBe(100000);
    expect(shareB?.finalAmount).toBe(100000);
    expect(shareMe?.finalAmount).toBe(100000);
  });

  it('handles items with undefined or empty assignedMemberIds without throwing', () => {
    const items: any[] = [
      { id: 'i1', name: 'Món A', price: 100000, quantity: 1 }, // no assignedMemberIds
      { id: 'i2', name: 'Món B', price: 50000, quantity: 1, assignedMemberIds: [] },
    ];
    const adjustments: BillAdjustment[] = [];

    const result = calculateItemizedBillShares(150000, members, items, adjustments);
    expect(result.unassignedItemsCount).toBe(2);
    expect(result.shares.length).toBe(3);
  });

  it('safely handles empty members array', () => {
    const result = calculateItemizedBillShares(100000, [], [], []);
    expect(result.shares).toEqual([]);
    expect(result.calculatedTotal).toBe(0);
  });

  it('handles fee and discount adjustments across members', () => {
    const items: BillItem[] = [
      { id: 'i1', name: 'Món A', price: 300000, quantity: 1, assignedMemberIds: ['me', 'user_1', 'user_2'] },
    ];
    const adjustments: BillAdjustment[] = [
      { id: 'adj1', type: 'fee', name: 'Phí ship', amount: 30000 },
      { id: 'adj2', type: 'discount', name: 'Mã giảm giá', amount: 60000 },
    ]; // Net adjustment = -30,000 => -10,000 per person

    const result = calculateItemizedBillShares(270000, members, items, adjustments);
    expect(result.calculatedTotal).toBe(270000);
    const shareA = result.shares.find(s => s.memberId === 'user_1');
    expect(shareA?.finalAmount).toBe(90000);
  });

  it('calculates custom quantity shares correctly (e.g. 4 beers: me 1, user_1 3)', () => {
    const items: BillItem[] = [
      {
        id: 'i_beer',
        name: 'Bia Tiger',
        price: 25000,
        quantity: 4,
        assignedMemberIds: ['me', 'user_1'],
        memberQuantities: {
          me: 1,
          user_1: 3,
        },
      },
    ];
    const adjustments: BillAdjustment[] = [];

    const result = calculateItemizedBillShares(100000, members, items, adjustments);
    expect(result.calculatedTotal).toBe(100000);

    const shareMe = result.shares.find(s => s.memberId === 'me');
    const shareA = result.shares.find(s => s.memberId === 'user_1');
    const shareB = result.shares.find(s => s.memberId === 'user_2');

    expect(shareMe?.finalAmount).toBe(25000); // 1 * 25k
    expect(shareA?.finalAmount).toBe(75000);  // 3 * 25k
    expect(shareB?.finalAmount).toBe(0);      // not assigned
  });
});
