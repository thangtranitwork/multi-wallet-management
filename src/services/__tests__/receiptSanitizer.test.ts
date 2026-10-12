import { describe, it, expect, jest } from '@jest/globals';

// Mock Expo native modules before importing geminiService
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-sqlite', () => ({}));
jest.mock('../../database/queries', () => ({
  getAppSetting: jest.fn(),
  setAppSetting: jest.fn(),
}));
jest.mock('../cloudinaryService', () => ({
  getCloudinaryConfig: jest.fn(),
  uploadToCloudinary: jest.fn(),
}));
jest.mock('../../utils/imageUtils', () => ({
  parseImageUris: jest.fn(),
}));

import { sanitizeReceiptItems } from '../geminiService';

describe('sanitizeReceiptItems', () => {
  it('corrects items when line total was placed in unit price for multi-quantity items', () => {
    // Simulating user receipt:
    // Total bill = 287,500 VND. Total items sum on bill = 292,000 VND (with -4,500 discount).
    // Hảo Hảo Big 100: quantity 4, unit price 6,500, line total 26,000.
    // Mì Ly Modern: quantity 2, unit price 9,500, line total 19,000.
    // Mì 3 Miền Gold: quantity 2, unit price 6,000, line total 12,000.
    // Single items totaling: 235,000.
    // If AI extracts line total (26k, 19k, 12k) as unit price:
    // item sum assuming unit price would be: 235k + 26k*4 + 19k*2 + 12k*2 = 235k + 104k + 38k + 24k = 401,000!
    // But sumAssumingLineTotal is: 235k + 26k + 19k + 12k = 292,000 (very close to 287,500).

    const rawItems = [
      { name: 'Nước Bưởi Smart C', quantity: 1, price: 11000 },
      { name: 'Bắp Rang Vị Caramel', quantity: 1, price: 12000 },
      { name: 'Umiki Ô mai', quantity: 1, price: 39000 },
      { name: 'Pillows Snack', quantity: 1, price: 12000 },
      { name: 'Bánh Mì Sandwich', quantity: 1, price: 11000 },
      { name: 'Ponnie Xxtt', quantity: 1, price: 20500 },
      { name: 'Snack Khoai Tây', quantity: 1, price: 10000 },
      { name: 'Đệ Nhất Phở Bò', quantity: 1, price: 9000 },
      { name: 'Phở Bò Vifon', quantity: 1, price: 10500 },
      { name: 'Bánh Mì Tươi Cắt Lát', quantity: 1, price: 15500 },
      { name: 'Bánh Mì Honbear', quantity: 1, price: 17000 },
      { name: 'Mì Hoành Thánh', quantity: 1, price: 10000 },
      { name: 'Mì 3 Miền Cay Thái', quantity: 1, price: 6000 },
      { name: 'Mì Vị Bò Cay', quantity: 1, price: 13000 },
      { name: 'Chân Gà Rút Xương', quantity: 1, price: 12000 },
      { name: 'Mì Ly Lẩu Thái Tom Yum', quantity: 1, price: 11000 },
      { name: 'Mì Ly Lẩu Thái Tôm', quantity: 1, price: 11000 },
      // Multi-quantity items mistakenly parsed with line total as price:
      { name: 'Hảo Hảo Big 100 Tôm Chua Cay', quantity: 4, price: 26000 },
      { name: 'Mì Ly Modern Lẩu Thái Tôm', quantity: 2, price: 19000 },
      { name: 'Mì 3 Miền Gold Tôm Chua Cay', quantity: 2, price: 12000 },
    ];

    const result = sanitizeReceiptItems(rawItems, 287500);

    const haoHao = result.find(i => i.name.includes('Hảo Hảo'));
    expect(haoHao).toBeDefined();
    expect(haoHao?.quantity).toBe(4);
    expect(haoHao?.price).toBe(6500); // 26,000 / 4

    const modern = result.find(i => i.name.includes('Modern'));
    expect(modern).toBeDefined();
    expect(modern?.quantity).toBe(2);
    expect(modern?.price).toBe(9500); // 19,000 / 2

    const mi3Mien = result.find(i => i.name.includes('Mì 3 Miền Gold Tôm Chua Cay'));
    expect(mi3Mien).toBeDefined();
    expect(mi3Mien?.quantity).toBe(2);
    expect(mi3Mien?.price).toBe(6000); // 12,000 / 2
  });

  it('keeps price unchanged when price is already unit price', () => {
    const rawItems = [
      { name: 'Bánh Mì', quantity: 1, price: 10000 },
      { name: 'Nước suối', quantity: 2, price: 5000 }, // Total = 10k + 10k = 20k
    ];

    const result = sanitizeReceiptItems(rawItems, 20000);
    expect(result[1].price).toBe(5000);
    expect(result[1].quantity).toBe(2);
  });

  it('merges zero-price promo items into paid items with averaged price (Buy 2 Get 1 Free)', () => {
    const rawItems = [
      { name: 'Món A', quantity: 2, price: 1000 },
      { name: 'Món A (KM)', quantity: 1, price: 0 },
    ];

    const result = sanitizeReceiptItems(rawItems, 2000);
    expect(result).toHaveLength(1);
    expect(result[0].name).toContain('Món A');
    expect(result[0].name).toContain('Mua 2 tặng 1');
    expect(result[0].quantity).toBe(3); // 2 + 1
    expect(result[0].price).toBe(667); // Math.round(2000 / 3) = 667
  });

  it('merges promo items with prefix KM or Tặng and calculates average unit price', () => {
    const rawItems = [
      { name: 'Trà Xanh C2', quantity: 3, price: 10000 }, // 30,000đ
      { name: 'KM Trà Xanh C2', quantity: 1, price: 0 },
      { name: 'Bánh snack', quantity: 1, price: 15000 },
    ];

    const result = sanitizeReceiptItems(rawItems, 45000);
    expect(result).toHaveLength(2);
    const c2 = result.find(i => i.name.includes('Trà Xanh C2'));
    expect(c2).toBeDefined();
    expect(c2?.quantity).toBe(4); // 3 + 1
    expect(c2?.price).toBe(7500); // 30,000 / 4 = 7500

    const snack = result.find(i => i.name === 'Bánh snack');
    expect(snack?.price).toBe(15000);
  });

  it('handles line-item discount lines by adjusting preceding item unit price', () => {
    const rawItems = [
      // 2 * 8,500 = 17,000 with -8,500 line discount
      { name: 'Bánh Mì Thinmax Vị Socola', quantity: 2, price: 8500 },
      { name: 'Chiết khấu Bánh Mì', quantity: 1, price: -8500 },
      // 2 * 23,000 = 46,000 with -5,000 line discount
      { name: 'Xúc Xích Ponnie Vị Heo', quantity: 2, price: 23000 },
      { name: 'Chiết khấu: -5,000', quantity: 1, price: -5000 },
      { name: 'Mì Ly Lẩu Thái', quantity: 1, price: 11000 },
    ];

    const result = sanitizeReceiptItems(rawItems, 60500);
    expect(result).toHaveLength(3);

    const banhMi = result.find(i => i.name.includes('Bánh Mì Thinmax'));
    expect(banhMi).toBeDefined();
    expect(banhMi?.quantity).toBe(2);
    expect(banhMi?.price).toBe(4250); // (17,000 - 8,500) / 2 = 4,250

    const ponnie = result.find(i => i.name.includes('Ponnie'));
    expect(ponnie).toBeDefined();
    expect(ponnie?.quantity).toBe(2);
    expect(ponnie?.price).toBe(20500); // (46,000 - 5,000) / 2 = 20,500

    const miLy = result.find(i => i.name.includes('Mì Ly Lẩu Thái'));
    expect(miLy?.price).toBe(11000);
  });
});

