export interface BankInfo {
  bin: string;
  shortName: string;
  name: string;
  code: string;
  aliases?: string[];
  isEWallet?: boolean;
}

export const VIETNAMESE_BANKS: BankInfo[] = [
  {
    bin: '970422',
    shortName: 'MBBank',
    name: 'Ngân hàng Quân đội (MB)',
    code: 'MB',
    aliases: ['mbbank', 'mb bank', 'mb', 'quân đội', 'quan doi'],
  },
  {
    bin: '970436',
    shortName: 'Vietcombank',
    name: 'Ngân hàng Ngoại thương (VCB)',
    code: 'VCB',
    aliases: ['vietcombank', 'vietcom', 'vcb', 'ngoại thương', 'ngoai thuong'],
  },
  {
    bin: '970407',
    shortName: 'Techcombank',
    name: 'Ngân hàng Kỹ thương (TCB)',
    code: 'TCB',
    aliases: ['techcombank', 'techcom', 'tcb', 'kỹ thương', 'ky thuong'],
  },
  {
    bin: '970416',
    shortName: 'ACB',
    name: 'Ngân hàng Á Châu (ACB)',
    code: 'ACB',
    aliases: ['acb', 'á châu', 'a chau'],
  },
  {
    bin: '970432',
    shortName: 'VPBank',
    name: 'Ngân hàng Việt Nam Thịnh Vượng (VPB)',
    code: 'VPB',
    aliases: ['vpbank', 'vp bank', 'vpb', 'việt nam thịnh vượng', 'viet nam thinh vuong'],
  },
  {
    bin: '970418',
    shortName: 'BIDV',
    name: 'Ngân hàng Đầu tư và Phát triển (BIDV)',
    code: 'BIDV',
    aliases: ['bidv', 'đầu tư và phát triển', 'dau tu va phat trien'],
  },
  {
    bin: '970415',
    shortName: 'VietinBank',
    name: 'Ngân hàng Công thương (CTG)',
    code: 'CTG',
    aliases: ['vietinbank', 'vietin', 'ctg', 'công thương', 'cong thuong', 'icb'],
  },
  {
    bin: '970423',
    shortName: 'TPBank',
    name: 'Ngân hàng Tiên Phong (TPB)',
    code: 'TPB',
    aliases: ['tpbank', 'tp bank', 'tpb', 'tiên phong', 'tien phong'],
  },
  {
    bin: '970441',
    shortName: 'VIB',
    name: 'Ngân hàng Quốc tế (VIB)',
    code: 'VIB',
    aliases: ['vib', 'quốc tế', 'quoc te'],
  },
  {
    bin: '970403',
    shortName: 'Sacombank',
    name: 'Ngân hàng Sài Gòn Thương Tín (STB)',
    code: 'STB',
    aliases: ['sacombank', 'sacom', 'stb', 'sài gòn thương tín', 'sai gon thuong tin'],
  },
  {
    bin: '970437',
    shortName: 'HDBank',
    name: 'Ngân hàng Phát triển TP.HCM (HDB)',
    code: 'HDB',
    aliases: ['hdbank', 'hd bank', 'hdb'],
  },
  {
    bin: '970443',
    shortName: 'SHB',
    name: 'Ngân hàng Sài Gòn - Hà Nội (SHB)',
    code: 'SHB',
    aliases: ['shb', 'sài gòn hà nội', 'sai gon ha noi'],
  },
  {
    bin: '970426',
    shortName: 'MSB',
    name: 'Ngân hàng Hàng Hải (MSB)',
    code: 'MSB',
    aliases: ['msb', 'hàng hải', 'hang hai', 'maritime bank'],
  },
  {
    bin: '970440',
    shortName: 'SeABank',
    name: 'Ngân hàng Đông Nam Á (SeABank)',
    code: 'SEA',
    aliases: ['seabank', 'sea bank', 'seab', 'đông nam á', 'dong nam a'],
  },
  {
    bin: '970448',
    shortName: 'OCB',
    name: 'Ngân hàng Phương Đông (OCB)',
    code: 'OCB',
    aliases: ['ocb', 'phương đông', 'phuong dong'],
  },
  {
    bin: '970449',
    shortName: 'LPBank',
    name: 'Ngân hàng Lộc Phát (LPB)',
    code: 'LPB',
    aliases: ['lpbank', 'lp bank', 'lpb', 'lộc phát', 'loc phat', 'lienvietpostbank', 'bưu điện liên việt', 'buu dien lien viet'],
  },
  {
    bin: '970431',
    shortName: 'Eximbank',
    name: 'Ngân hàng Xuất Nhập khẩu (EIB)',
    code: 'EIB',
    aliases: ['eximbank', 'exim', 'eib', 'xuất nhập khẩu', 'xuat nhap khau'],
  },
  {
    bin: '970452',
    shortName: 'Kienlongbank',
    name: 'Ngân hàng Kiên Long (KLB)',
    code: 'KLB',
    aliases: ['kienlongbank', 'kienlong', 'kiên long', 'kien long', 'klb'],
  },
  {
    bin: '970409',
    shortName: 'Bac A Bank',
    name: 'Ngân hàng Bắc Á (BAB)',
    code: 'BAB',
    aliases: ['bac a bank', 'bac a', 'bắc á', 'bab', 'baca'],
  },
  {
    bin: '970428',
    shortName: 'Nam A Bank',
    name: 'Ngân hàng Nam Á (NAB)',
    code: 'NAB',
    aliases: ['nam a bank', 'nam a', 'nam á', 'nab', 'nama'],
  },
  {
    bin: '970412',
    shortName: 'PVcomBank',
    name: 'Ngân hàng Đại chúng (PVC)',
    code: 'PVC',
    aliases: ['pvcombank', 'pvcom', 'pvcom bank', 'pvc'],
  },
  {
    bin: '970438',
    shortName: 'BaoViet Bank',
    name: 'Ngân hàng Bảo Việt (BVB)',
    code: 'BVB',
    aliases: ['baoviet', 'bảo việt', 'bao viet', 'baovietbank', 'bvb'],
  },
  {
    bin: '970454',
    shortName: 'BVBank',
    name: 'Ngân hàng Bản Việt (BVBANK)',
    code: 'BVBANK',
    aliases: ['bvbank', 'bản việt', 'ban viet', 'vietcapitalbank'],
  },
  {
    bin: '970400',
    shortName: 'Saigonbank',
    name: 'Ngân hàng Sài Gòn Công Thương (SGB)',
    code: 'SGB',
    aliases: ['saigonbank', 'sgb', 'sài gòn công thương', 'sai gon cong thuong'],
  },
  {
    bin: '970405',
    shortName: 'Agribank',
    name: 'Ngân hàng Nông nghiệp (Agribank)',
    code: 'VBA',
    aliases: ['agribank', 'agri', 'nông nghiệp', 'nong nghiep', 'vba'],
  },
  {
    bin: '970424',
    shortName: 'Shinhan Bank',
    name: 'Ngân hàng Shinhan Việt Nam',
    code: 'SHBVN',
    aliases: ['shinhan', 'shinhanbank', 'shbvn'],
  },
  {
    bin: '970457',
    shortName: 'Woori Bank',
    name: 'Ngân hàng Woori Việt Nam',
    code: 'WRB',
    aliases: ['woori', 'wooribank', 'wrb'],
  },
  {
    bin: '970439',
    shortName: 'Public Bank',
    name: 'Ngân hàng Public Bank Việt Nam',
    code: 'PBVN',
    aliases: ['public bank', 'publicbank', 'pbvn'],
  },
  {
    bin: '970442',
    shortName: 'Hong Leong',
    name: 'Ngân hàng Hong Leong Việt Nam',
    code: 'HLBVN',
    aliases: ['hong leong', 'hongleong', 'hlbvn'],
  },
  {
    bin: '963388',
    shortName: 'Timo',
    name: 'Ngân hàng số Timo by BVBank',
    code: 'TIMO',
    aliases: ['timo', 'timo bank'],
  },
  {
    bin: '546034',
    shortName: 'Cake by VPBank',
    name: 'Ngân hàng số Cake by VPBank',
    code: 'CAKE',
    aliases: ['cake', 'cake by vpbank'],
  },
  {
    bin: '971025',
    shortName: 'MoMo',
    name: 'Ví MoMo (CTCP Dịch vụ Di động Trực tuyến)',
    code: 'MOMO',
    aliases: ['momo', 'ví momo', 'vi momo'],
    isEWallet: true,
  },
  {
    bin: '971005',
    shortName: 'Viettel Money',
    name: 'Viettel Money',
    code: 'VTLMONEY',
    aliases: ['viettel', 'viettel money', 'viettelpay', 'viettel pay', 'vtlmoney'],
    isEWallet: true,
  },
  {
    bin: '971011',
    shortName: 'VNPT Money',
    name: 'VNPT Money',
    code: 'VNPTMONEY',
    aliases: ['vnpt', 'vnpt money', 'vnptpay', 'vnpt pay'],
    isEWallet: true,
  },
];

export function findBankByBin(bin?: string | null): BankInfo | undefined {
  if (!bin) return undefined;
  return VIETNAMESE_BANKS.find(b => b.bin === bin);
}

export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Tự động tìm thông tin ngân hàng/ví dựa theo tên ví (name / keyword).
 * Ví dụ: "Vietcombank", "VCB", "Ví MoMo", "MB Bank", "Techcombank", "Cake", "Tiết kiệm BIDV"...
 */
export function findBankByName(name?: string | null): BankInfo | undefined {
  if (!name || typeof name !== 'string') return undefined;
  const raw = name.trim().toLowerCase();
  if (!raw) return undefined;
  const unaccented = removeVietnameseTones(raw);

  // Danh sách từ riêng biệt
  const words = unaccented.split(/[^a-z0-9]+/).filter(Boolean);

  // 1. So khớp trực tiếp shortName hoặc code
  for (const bank of VIETNAMESE_BANKS) {
    const sName = bank.shortName.toLowerCase();
    const code = bank.code.toLowerCase();
    if (raw === sName || raw === code || unaccented === removeVietnameseTones(sName)) {
      return bank;
    }
  }

  // 2. So khớp theo danh sách aliases
  let bestMatch: { bank: BankInfo; score: number } | undefined;

  for (const bank of VIETNAMESE_BANKS) {
    const aliases = bank.aliases || [bank.shortName.toLowerCase(), bank.code.toLowerCase()];
    for (const alias of aliases) {
      const cleanAlias = removeVietnameseTones(alias.toLowerCase());

      // Với alias ngắn (<= 3 ký tự: mb, vcb, tcb, acb, vib, lpb, stb...):
      // Bắt buộc phải là 1 từ độc lập để tránh match ký tự ngẫu nhiên trong từ khác
      if (cleanAlias.length <= 3) {
        if (words.includes(cleanAlias)) {
          const score = cleanAlias.length * 10;
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { bank, score };
          }
        }
      } else {
        // Với alias dài (> 3 ký tự): kiểm tra chuỗi có chứa alias
        if (unaccented.includes(cleanAlias) || raw.includes(alias.toLowerCase())) {
          const score = cleanAlias.length * 10;
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { bank, score };
          }
        }
      }
    }
  }

  return bestMatch?.bank;
}
