export const THEME = {
  // Neo-Brutalism Canvas & Core
  bg: '#FAF8F5',             // Warm retro cream background
  surface: '#FFFFFF',        // Pure white card surfaces
  surfaceLight: '#F3F4F6',   // Neutral light surface
  border: '#000000',         // Pitch black outlines
  borderWidth: 2.5,          // Signature 2.5px borders
  shadow: '#000000',         // Hard solid black offset shadow (no blur)
  shadowOffset: 4,           // 4px offset

  // High-Contrast Pop Colors (đúng bảng màu trong ảnh của Ngài)
  primary: '#22C55E',        // Pop Green (Must watch / Cho vay)
  primaryDark: '#15803D',
  primaryLight: '#DCFCE7',

  popYellow: '#FACC15',      // Sunny Amber / Mustard (Nút + / Learning card)
  popYellowLight: '#FEF9C3',

  popPink: '#FB7185',        // Coral / Strawberry Pink (Travel card / Đi vay)
  popPinkLight: '#FFE4E6',

  popPurple: '#A855F7',      // Electric Lilac (Weekend Recipes card)
  popPurpleLight: '#F3E8FF',

  popBlue: '#38BDF8',        // Sky Cyan
  popBlueLight: '#E0F2FE',

  popLime: '#84CC16',        // Lime Green (Coffee & Chill card)
  popLimeLight: '#ECFCCB',

  popOrange: '#FB923C',      // Tangerine Orange
  popOrangeLight: '#FFEDD5',

  popSlate: '#94A3B8',       // Slate Grey (Unsorted card)
  popSlateLight: '#F1F5F9',

  // Status & Actions
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Typography (Chữ đen tuyền tương phản tuyệt đối)
  text: '#000000',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  textLight: '#FFFFFF',

  // Predefined Folder Tab Colors
  folderColors: [
    { bg: '#E2E8F0', tab: '#94A3B8', name: 'Xám Tối Giản' },
    { bg: '#DCFCE7', tab: '#22C55E', name: 'Xanh Lá Tươi' },
    { bg: '#FEF9C3', tab: '#FACC15', name: 'Vàng Nắng' },
    { bg: '#ECFCCB', tab: '#84CC16', name: 'Xanh Chanh' },
    { bg: '#FFE4E6', tab: '#FB7185', name: 'Hồng San Hô' },
    { bg: '#F3E8FF', tab: '#A855F7', name: 'Tím Lavender' },
    { bg: '#E0F2FE', tab: '#38BDF8', name: 'Xanh Da Trời' },
    { bg: '#FFEDD5', tab: '#FB923C', name: 'Cam Năng Động' },
  ],
};

export const WALLET_TYPES = [
  { id: 'cash', name: 'Tiền mặt', icon: 'cash-outline', defaultColor: '#10B981' },
  { id: 'bank', name: 'Tài khoản Ngân hàng', icon: 'business-outline', defaultColor: '#00E599' },
  { id: 'e_wallet', name: 'Ví điện tử', icon: 'phone-portrait-outline', defaultColor: '#14B8A6' },
  { id: 'credit', name: 'Thẻ tín dụng', icon: 'card-outline', defaultColor: '#F59E0B' },
  { id: 'savings', name: 'Tiết kiệm / Đầu tư', icon: 'trending-up-outline', defaultColor: '#6366F1' },
];

export const WALLET_ICONS = [
  'cash-outline',
  'business-outline',
  'card-outline',
  'phone-portrait-outline',
  'trending-up-outline',
  'wallet-outline',
  'diamond-outline',
  'gift-outline',
  'cart-outline',
  'shield-checkmark-outline',
];

export const WALLET_COLORS = [
  '#10B981', // Emerald
  '#00E599', // Bright Mint
  '#14B8A6', // Teal
  '#38BDF8', // Cyan
  '#FF6B8B', // Clay Pink
  '#F59E0B', // Amber
  '#A78BFA', // Purple
  '#6366F1', // Indigo
];

export const CATEGORY_ICONS = [
  'restaurant-outline',
  'cafe-outline',
  'car-outline',
  'cart-outline',
  'flash-outline',
  'home-outline',
  'game-controller-outline',
  'medkit-outline',
  'book-outline',
  'gift-outline',
  'cash-outline',
  'trending-up-outline',
  'wallet-outline',
  'ellipsis-horizontal-outline',
];

export function formatVND(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('vi-VN');
  return `${isNegative ? '-' : ''}${formatted} ₫`;
}

export function formatCompactVND(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  if (absAmount >= 1_000_000_000) {
    return `${isNegative ? '-' : ''}${(absAmount / 1_000_000_000).toFixed(2)} Tỷ`;
  }
  if (absAmount >= 1_000_000) {
    return `${isNegative ? '-' : ''}${(absAmount / 1_000_000).toFixed(1)} Tr`;
  }
  if (absAmount >= 1_000) {
    return `${isNegative ? '-' : ''}${(absAmount / 1_000).toFixed(0)} K`;
  }
  return `${isNegative ? '-' : ''}${absAmount.toLocaleString('vi-VN')} ₫`;
}
