export interface BankInfo {
  bin: string;
  shortName: string;
  name: string;
  code: string;
}

export const VIETNAMESE_BANKS: BankInfo[] = [
  { bin: '970436', shortName: 'Vietcombank', name: 'Ngân hàng Ngoại thương Việt Nam (VCB)', code: 'VCB' },
  { bin: '970407', shortName: 'Techcombank', name: 'Ngân hàng Kỹ thương Việt Nam (TCB)', code: 'TCB' },
  { bin: '970422', shortName: 'MBBank', name: 'Ngân hàng Quân đội (MB)', code: 'MB' },
  { bin: '970416', shortName: 'ACB', name: 'Ngân hàng Á Châu (ACB)', code: 'ACB' },
  { bin: '970432', shortName: 'VPBank', name: 'Ngân hàng Việt Nam Thịnh Vượng (VPB)', code: 'VPB' },
  { bin: '970418', shortName: 'BIDV', name: 'Ngân hàng Đầu tư và Phát triển Việt Nam', code: 'BIDV' },
  { bin: '970415', shortName: 'VietinBank', name: 'Ngân hàng Công thương Việt Nam (CTG)', code: 'CTG' },
  { bin: '970423', shortName: 'TPBank', name: 'Ngân hàng Tiên Phong (TPB)', code: 'TPB' },
  { bin: '970441', shortName: 'VIB', name: 'Ngân hàng Quốc tế Việt Nam (VIB)', code: 'VIB' },
  { bin: '970403', shortName: 'Sacombank', name: 'Ngân hàng Sài Gòn Thương Tín (STB)', code: 'STB' },
  { bin: '970437', shortName: 'HDBank', name: 'Ngân hàng Phát triển TP.HCM (HDB)', code: 'HDB' },
  { bin: '970443', shortName: 'SHB', name: 'Ngân hàng Sài Gòn - Hà Nội (SHB)', code: 'SHB' },
  { bin: '970426', shortName: 'MSB', name: 'Ngân hàng Hàng Hải Việt Nam (MSB)', code: 'MSB' },
  { bin: '970440', shortName: 'SeABank', name: 'Ngân hàng Đông Nam Á (SeABank)', code: 'SEA' },
  { bin: '970448', shortName: 'OCB', name: 'Ngân hàng Phương Đông (OCB)', code: 'OCB' },
  { bin: '970449', shortName: 'LPBank', name: 'Ngân hàng Lộc Phát Việt Nam (LPB)', code: 'LPB' },
  { bin: '970431', shortName: 'Eximbank', name: 'Ngân hàng Xuất Nhập khẩu Việt Nam (EIB)', code: 'EIB' },
  { bin: '970452', shortName: 'Kienlongbank', name: 'Ngân hàng Kiên Long (KLB)', code: 'KLB' },
  { bin: '970409', shortName: 'Bac A Bank', name: 'Ngân hàng Bắc Á (BAB)', code: 'BAB' },
  { bin: '970428', shortName: 'Nam A Bank', name: 'Ngân hàng Nam Á (NAB)', code: 'NAB' },
  { bin: '970412', shortName: 'PVcomBank', name: 'Ngân hàng Đại chúng Việt Nam (PVC)', code: 'PVC' },
  { bin: '970438', shortName: 'BaoViet Bank', name: 'Ngân hàng Bảo Việt (BVB)', code: 'BVB' },
  { bin: '970454', shortName: 'BVBank', name: 'Ngân hàng Bản Việt (BVBANK)', code: 'BVBANK' },
  { bin: '970400', shortName: 'Saigonbank', name: 'Ngân hàng Sài Gòn Công Thương (SGB)', code: 'SGB' },
  { bin: '970405', shortName: 'Agribank', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn', code: 'VBA' },
  { bin: '970424', shortName: 'Shinhan Bank', name: 'Ngân hàng Shinhan Việt Nam', code: 'SHBVN' },
  { bin: '970457', shortName: 'Woori Bank', name: 'Ngân hàng Woori Việt Nam', code: 'WRB' },
  { bin: '970439', shortName: 'Public Bank', name: 'Ngân hàng Public Bank Việt Nam', code: 'PBVN' },
  { bin: '970442', shortName: 'Hong Leong', name: 'Ngân hàng Hong Leong Việt Nam', code: 'HLBVN' },
  { bin: '963388', shortName: 'Timo', name: 'Ngân hàng số Timo by BVBank', code: 'TIMO' },
  { bin: '546034', shortName: 'Cake by VPBank', name: 'Ngân hàng số Cake by VPBank', code: 'CAKE' },
  { bin: '971005', shortName: 'Viettel Money', name: 'Viettel Money', code: 'VTLMONEY' },
  { bin: '971011', shortName: 'VNPT Money', name: 'VNPT Money', code: 'VNPTMONEY' },
];

export function findBankByBin(bin?: string | null): BankInfo | undefined {
  if (!bin) return undefined;
  return VIETNAMESE_BANKS.find(b => b.bin === bin);
}
