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
});
