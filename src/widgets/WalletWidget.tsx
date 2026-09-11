import React from 'react';
import {
  OverlapWidget,
  FlexWidget,
  TextWidget,
  SvgWidget,
} from 'react-native-android-widget';

export interface WalletWidgetProps {
  totalAssets?: number;
  monthlyIncome?: number;
  monthlyExpense?: number;
  isHidden?: boolean;
  isAppLockEnabled?: boolean;
  lastUpdated?: string;
}

const EYE_OPEN_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

const EYE_OFF_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

const MINUS_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

const PLUS_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

// Các hình khối hình học màu sắc ngẫu nhiên làm nền phong cách Neo-brutalism
const BACKGROUND_SHAPES_SVG = `<svg width="360" height="140" viewBox="0 0 360 140" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="360" height="140" fill="#FAF8F5"/>
  <rect x="225" y="-15" width="115" height="75" rx="16" transform="rotate(7 282 22)" fill="#FEF08A" stroke="#000000" stroke-width="2"/>
  <rect x="-15" y="68" width="130" height="80" rx="16" transform="rotate(-6 50 108)" fill="#DCFCE7" stroke="#000000" stroke-width="2"/>
  <rect x="235" y="78" width="135" height="75" rx="16" transform="rotate(5 302 115)" fill="#FEE2E2" stroke="#000000" stroke-width="2"/>
  <rect x="110" y="-12" width="60" height="35" rx="8" transform="rotate(12 140 5)" fill="#EDE9FE" stroke="#000000" stroke-width="1.5"/>
  <circle cx="150" cy="50" r="2.5" fill="#000000" opacity="0.35"/>
  <circle cx="164" cy="50" r="2.5" fill="#000000" opacity="0.35"/>
  <circle cx="178" cy="50" r="2.5" fill="#000000" opacity="0.35"/>
  <circle cx="150" cy="62" r="2.5" fill="#000000" opacity="0.35"/>
  <circle cx="164" cy="62" r="2.5" fill="#000000" opacity="0.35"/>
  <circle cx="178" cy="62" r="2.5" fill="#000000" opacity="0.35"/>
  <path d="M 80 32 L 92 32 M 86 26 L 86 38" stroke="#000000" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
  <path d="M 210 45 Q 215 40 220 45 T 230 45" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
</svg>`;

function formatWidgetVND(amount: number): string {
  if (Math.abs(amount) >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2)} tỷ ₫`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)} tr ₫`;
  }
  return `${amount.toLocaleString('vi-VN')} ₫`;
}

export function WalletWidget({
  totalAssets = 0,
  monthlyIncome = 0,
  monthlyExpense = 0,
  isHidden = true,
}: WalletWidgetProps) {
  const formattedAssets = isHidden ? '•••••••• ₫' : formatWidgetVND(totalAssets);
  const formattedIncome = isHidden ? '••••••' : `+ ${formatWidgetVND(monthlyIncome)}`;
  const formattedExpense = isHidden ? '••••••' : `- ${formatWidgetVND(monthlyExpense)}`;

  // Khi số dư đang ẩn: Nút Mắt mở app để xác thực sinh trắc học
  // Khi số dư đang hiển thị: Nút Mắt ẩn ngay lập tức ngoài widget
  const eyeClickAction = isHidden ? 'OPEN_URI' : 'TOGGLE_BALANCE';
  const eyeClickActionData = isHidden
    ? { uri: 'com.thang.multiwallet://unlock-widget' }
    : undefined;

  return (
    <OverlapWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#FAF8F5',
        borderRadius: 18,
        borderWidth: 2.5,
        borderColor: '#000000',
        overflow: 'hidden',
      }}
    >
      {/* Lớp 1: Background các hình khối màu sắc ngẫu nhiên phong cách Neo-brutalism */}
      <SvgWidget
        svg={BACKGROUND_SHAPES_SVG}
        style={{
          width: 'match_parent',
          height: 'match_parent',
        }}
      />

      {/* Lớp 2: Nội dung nổi phía trước thoáng đãng, không bị đóng hộp */}
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          padding: 12,
          justifyContent: 'space-between',
        }}
        clickAction="OPEN_APP"
      >
        {/* Header Hàng trên */}
        <FlexWidget
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: 'match_parent',
          }}
        >
          {/* Nhãn thương hiệu Neo-brutalism Vàng */}
          <FlexWidget
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFE600',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: '#000000',
            }}
          >
            <TextWidget
              text="VÍ CỦA TÔI"
              style={{
                fontSize: 10,
                fontWeight: '900',
                color: '#000000',
                letterSpacing: 0.5,
              }}
            />
          </FlexWidget>

          {/* Bộ 3 nút thao tác xúc giác (chỉ các nút này có khối riêng) */}
          <FlexWidget
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            {/* Nút Mắt Bật/Tắt ẩn số dư */}
            <FlexWidget
              style={{
                width: 32,
                height: 32,
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                borderWidth: 2,
                borderColor: '#000000',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 6,
              }}
              clickAction={eyeClickAction}
              clickActionData={eyeClickActionData}
            >
              <SvgWidget
                svg={isHidden ? EYE_OFF_SVG : EYE_OPEN_SVG}
                style={{ width: 17, height: 17 }}
              />
            </FlexWidget>

            {/* Nút Khối Trừ (-) Chi tiêu nhanh */}
            <FlexWidget
              style={{
                width: 32,
                height: 32,
                backgroundColor: '#FEE2E2',
                borderRadius: 8,
                borderWidth: 2,
                borderColor: '#000000',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 6,
              }}
              clickAction="OPEN_URI"
              clickActionData={{ uri: 'com.thang.multiwallet://quick-add?type=expense' }}
            >
              <SvgWidget
                svg={MINUS_SVG}
                style={{ width: 15, height: 15 }}
              />
            </FlexWidget>

            {/* Nút Khối Cộng (+) Thu nhập nhanh */}
            <FlexWidget
              style={{
                width: 32,
                height: 32,
                backgroundColor: '#DCFCE7',
                borderRadius: 8,
                borderWidth: 2,
                borderColor: '#000000',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              clickAction="OPEN_URI"
              clickActionData={{ uri: 'com.thang.multiwallet://quick-add?type=income' }}
            >
              <SvgWidget
                svg={PLUS_SVG}
                style={{ width: 15, height: 15 }}
              />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>

        {/* Thân giữa: Tổng tài sản - Thoáng đãng, số to rõ ràng trên nền hình khối */}
        <FlexWidget
          style={{
            width: 'match_parent',
            marginVertical: 2,
          }}
        >
          <TextWidget
            text="TỔNG TÀI SẢN"
            style={{
              fontSize: 10,
              fontWeight: '800',
              color: '#374151',
              letterSpacing: 0.5,
            }}
          />
          <TextWidget
            text={formattedAssets}
            style={{
              fontSize: 24,
              fontWeight: '900',
              color: '#000000',
              marginTop: 2,
            }}
          />
        </FlexWidget>

        {/* Khung đáy: Thu & Chi tháng này thanh lịch */}
        <FlexWidget
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: 'match_parent',
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: '#000000',
          }}
        >
          <FlexWidget
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <TextWidget
              text="Thu tháng: "
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: '#6B7280',
              }}
            />
            <TextWidget
              text={formattedIncome}
              style={{
                fontSize: 11,
                fontWeight: '900',
                color: '#15803D',
              }}
            />
          </FlexWidget>

          <FlexWidget
            style={{
              width: 1.5,
              height: 12,
              backgroundColor: '#D1D5DB',
            }}
          />

          <FlexWidget
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <TextWidget
              text="Chi tháng: "
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: '#6B7280',
              }}
            />
            <TextWidget
              text={formattedExpense}
              style={{
                fontSize: 11,
                fontWeight: '900',
                color: '#DC2626',
              }}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  );
}
