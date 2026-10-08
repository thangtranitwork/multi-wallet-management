import { describe, it, expect } from '@jest/globals';
import { calculateItemizedBillShares, buildMemberItemizedPayload } from '../splitBillCalculator';
import { BillMember, BillItem, BillAdjustment } from '../../types';

describe('splitBillCalculator', () => {
  const members: BillMember[] = [
    { id: 'me', name: 'Tôi', isPayer: true },
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

  it('supports paying on behalf of friends (includeMeInSplit = false)', () => {
    const items: BillItem[] = [
      { id: 'i1', name: 'Pizza', price: 200000, quantity: 1, assignedMemberIds: ['user_1', 'user_2'] },
    ];
    const adjustments: BillAdjustment[] = [
      { id: 'a1', name: 'Phí ship', type: 'fee', amount: 20000 },
    ];

    const result = calculateItemizedBillShares(220000, members, items, adjustments, false);

    const shareMe = result.shares.find(s => s.memberId === 'me');
    const shareA = result.shares.find(s => s.memberId === 'user_1');
    const shareB = result.shares.find(s => s.memberId === 'user_2');

    // Payer pays 0đ because includeMeInSplit is false
    expect(shareMe?.finalAmount).toBe(0);
    // 2 friends share 200k items (100k each) + 20k fee (10k each) = 110k each
    expect(shareA?.finalAmount).toBe(110000);
    expect(shareB?.finalAmount).toBe(110000);
    expect((shareA?.finalAmount || 0) + (shareB?.finalAmount || 0)).toBe(220000);
  });

  describe('buildMemberItemizedPayload', () => {
    it('creates dedicated itemized bill payload for split member with shared items', () => {
      const items: BillItem[] = [
        { id: 'i1', name: 'Lẩu hải sản', price: 300000, quantity: 1, assignedMemberIds: ['me', 'user_1', 'user_2'] },
      ];
      const adjustments: BillAdjustment[] = [];
      const calc = calculateItemizedBillShares(300000, members, items, adjustments);
      const shareA = calc.shares.find(s => s.memberId === 'user_1')!;

      const payload = buildMemberItemizedPayload(shareA, items, adjustments, members.length);

      expect(payload.items.length).toBe(1);
      expect(payload.items[0].name).toBe('Lẩu hải sản (Chia 3)');
      expect(payload.items[0].price).toBe(100000);
      expect(payload.items[0].quantity).toBe(1);
      expect(payload.members.length).toBe(1);
      expect(payload.members[0].name).toBe('Nguyễn Văn A');
      expect(payload.adjustments).toEqual([]);

      const itemsTotal = payload.items.reduce((s, it) => s + it.price * it.quantity, 0);
      expect(itemsTotal).toBe(shareA.finalAmount);
    });

    it('creates accurate individual items for custom quantities and adjustments', () => {
      const items: BillItem[] = [
        {
          id: 'i_beer',
          name: 'Bia Tiger',
          price: 25000,
          quantity: 4,
          assignedMemberIds: ['me', 'user_1'],
          memberQuantities: { me: 1, user_1: 3 },
        },
      ];
      const adjustments: BillAdjustment[] = [
        { id: 'adj_fee', name: 'Phí dịch vụ', type: 'fee', amount: 30000 },
      ];

      const calc = calculateItemizedBillShares(130000, members, items, adjustments);
      const shareA = calc.shares.find(s => s.memberId === 'user_1')!;
      // user_1: 3 beers = 75,000 + (30,000 / 3) fee = 10,000 => 85,000

      const payload = buildMemberItemizedPayload(shareA, items, adjustments, members.length);

      expect(payload.items.length).toBe(1);
      expect(payload.items[0].name).toBe('Bia Tiger');
      expect(payload.items[0].quantity).toBe(3);
      expect(payload.items[0].price).toBe(25000);
      expect(payload.adjustments.length).toBe(1);
      expect(payload.adjustments[0].amount).toBe(10000);

      const itemsSum = payload.items.reduce((s, it) => s + it.price * it.quantity, 0);
      const adjNet = payload.adjustments.reduce(
        (s, a) => s + (a.type === 'fee' ? a.amount : -a.amount),
        0
      );
      expect(itemsSum + adjNet).toBe(shareA.finalAmount);
    });

    it('handles rounding difference cleanly to match exact finalAmount', () => {
      const items: BillItem[] = [
        { id: 'i1', name: 'Pizza', price: 100000, quantity: 1, assignedMemberIds: ['me', 'user_1', 'user_2'] },
      ];
      const adjustments: BillAdjustment[] = [];

      const calc = calculateItemizedBillShares(100000, members, items, adjustments);
      const shareA = calc.shares.find(s => s.memberId === 'user_1')!; // 33,333

      const payload = buildMemberItemizedPayload(shareA, items, adjustments, members.length);

      const itemsSum = payload.items.reduce((s, it) => s + it.price * it.quantity, 0);
      expect(itemsSum).toBe(shareA.finalAmount);
    });
  });
});
