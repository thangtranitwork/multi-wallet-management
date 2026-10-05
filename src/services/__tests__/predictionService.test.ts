import { describe, it, expect } from '@jest/globals';
import {
  detectRecurringBills,
  detectWeeklyHabits,
  cleanRecurringNote,
} from '../predictionService';
import { Transaction, Category } from '../../types';

const makeTx = (
  t: Partial<Transaction> & {
    id: string;
    amount: number;
    type: 'expense' | 'income';
    category_id: string;
    transacted_at: string;
  }
): Transaction => ({
  created_at: t.transacted_at || new Date().toISOString(),
  wallet_id: 'w1',
  ...t,
});

describe('cleanRecurringNote', () => {
  it('strips month, cycle, and period indicators', () => {
    expect(cleanRecurringNote('Tiền phòng tháng 8')).toBe('tien phong');
    expect(cleanRecurringNote('Tiền nhà T9')).toBe('tien nha');
    expect(cleanRecurringNote('Internet T10/2026')).toBe('internet');
    expect(cleanRecurringNote('Netflix kỳ 1')).toBe('netflix');
    expect(cleanRecurringNote('Tập gym')).toBe('tap gym'); // unaffected
  });
});

describe('detectRecurringBills', () => {
  const categories: Category[] = [
    { id: 'cat_food', name: 'Ăn uống', type: 'expense', icon: 'fast-food', color: '#EF4444' },
    { id: 'cat_rent', name: 'Nhà cửa & Hóa đơn', type: 'expense', icon: 'home', color: '#3B82F6' },
  ];

  it('does NOT detect recurring bill if user only did a transaction once', () => {
    const txs: Transaction[] = [
      makeTx({
        id: 'tx1',
        amount: 3500000,
        type: 'expense',
        category_id: 'cat_rent',
        note: 'Tiền phòng trọ T8',
        transacted_at: '2026-08-10T10:00:00Z',
      }),
    ];

    const result = detectRecurringBills(txs, categories);
    expect(result.length).toBe(0);
  });

  it('does NOT group unrelated single transactions with different notes/amounts', () => {
    // Exactly user reported scenario:
    // 1 transaction of 40k "Ăn bún chả" and 1 transaction of 1.5m "Đi bar" in month 8 and month 9
    const txs: Transaction[] = [
      makeTx({
        id: 'tx1',
        amount: 40000,
        type: 'expense',
        category_id: 'cat_food',
        note: 'Ăn bún chả',
        transacted_at: '2026-08-04T12:00:00Z',
      }),
      makeTx({
        id: 'tx2',
        amount: 1500000,
        type: 'expense',
        category_id: 'cat_food',
        note: 'Đi bar với bạn',
        transacted_at: '2026-09-05T21:00:00Z',
      }),
    ];

    const result = detectRecurringBills(txs, categories);
    expect(result.length).toBe(0);
  });

  it('correctly detects genuine recurring bill across months with consistent amount', () => {
    const txs: Transaction[] = [
      makeTx({
        id: 'tx1',
        amount: 3500000,
        type: 'expense',
        category_id: 'cat_rent',
        note: 'Tiền phòng trọ tháng 8',
        transacted_at: '2026-08-10T10:00:00Z',
      }),
      makeTx({
        id: 'tx2',
        amount: 3500000,
        type: 'expense',
        category_id: 'cat_rent',
        note: 'Tiền phòng trọ tháng 9',
        transacted_at: '2026-09-11T09:30:00Z',
      }),
    ];

    const result = detectRecurringBills(txs, categories);
    expect(result.length).toBe(1);
    expect([10, 11]).toContain(result[0].approxDayOfMonth);
    expect(result[0].averageAmount).toBe(3500000);
    expect(result[0].mostCommonNote).toContain('Tiền phòng trọ');
  });
});

describe('detectWeeklyHabits', () => {
  const categories: Category[] = [
    { id: 'cat_food', name: 'Ăn uống', type: 'expense', icon: 'fast-food', color: '#EF4444' },
  ];

  it('does NOT attribute a one-off note to a weekly habit if notes are all different', () => {
    // 3 Saturdays in a row, but 3 different activities
    // 2026-08-01 = Saturday, 2026-08-08 = Saturday, 2026-08-15 = Saturday
    const txs: Transaction[] = [
      makeTx({
        id: 'tx1',
        amount: 50000,
        type: 'expense',
        category_id: 'cat_food',
        note: 'Bún bò',
        transacted_at: '2026-08-01T12:00:00Z',
      }),
      makeTx({
        id: 'tx2',
        amount: 30000,
        type: 'expense',
        category_id: 'cat_food',
        note: 'Cà phê',
        transacted_at: '2026-08-08T09:00:00Z',
      }),
      makeTx({
        id: 'tx3',
        amount: 600000,
        type: 'expense',
        category_id: 'cat_food',
        note: 'Ăn lẩu',
        transacted_at: '2026-08-15T19:00:00Z',
      }),
    ];

    const result = detectWeeklyHabits(txs, categories);
    // Should NOT create a weekly habit when activities on that day are all random/different!
    expect(result.length).toBe(0);
  });

  it('correctly recognizes a specific weekly habit when note repeats on that day', () => {
    const txs: Transaction[] = [
      makeTx({
        id: 'tx1',
        amount: 500000,
        type: 'expense',
        category_id: 'cat_food',
        note: 'Siêu thị cuối tuần',
        transacted_at: '2026-08-01T10:00:00Z',
      }),
      makeTx({
        id: 'tx2',
        amount: 550000,
        type: 'expense',
        category_id: 'cat_food',
        note: 'Siêu thị cuối tuần',
        transacted_at: '2026-08-08T10:00:00Z',
      }),
      makeTx({
        id: 'tx3',
        amount: 480000,
        type: 'expense',
        category_id: 'cat_food',
        note: 'Siêu thị cuối tuần',
        transacted_at: '2026-08-15T10:00:00Z',
      }),
    ];

    const result = detectWeeklyHabits(txs, categories);
    expect(result.length).toBe(1);
    expect(result[0].mostCommonNote).toBe('Siêu thị cuối tuần');
    expect(result[0].averageAmount).toBe(510000);
  });
});
