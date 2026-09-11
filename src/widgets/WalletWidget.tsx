import React from 'react';
import {
  FlexWidget,
  TextWidget,
  SvgWidget,
} from 'react-native-android-widget';

export interface WalletWidgetProps {
  totalAssets?: number;
  monthlyIncome?: number;
  monthlyExpense?: number;
  isHidden?: boolean;
  lastUpdated?: string;
}

const EYE_OPEN_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

const EYE_OFF_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

const MINUS_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

const PLUS_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

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
  const formattedIncome = isHidden ? '••••••' : formatWidgetVND(monthlyIncome);
  const formattedExpense = isHidden ? '••••••' : formatWidgetVND(monthlyExpense);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#FAF8F5',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#000000',
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
        {/* Nhãn thương hiệu Neo-brutalism */}
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFE600',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            borderWidth: 1.5,
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

        {/* Nút thao tác nhanh bên phải: [Ẩn/Hiện] [- Chi tiêu] [+ Thu nhập] */}
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {/* Nút Bật/Tắt ẩn số dư trực tiếp trên Widget (Headless task) */}
          <FlexWidget
            style={{
              width: 32,
              height: 32,
              backgroundColor: '#FFFFFF',
              borderRadius: 8,
              borderWidth: 1.5,
              borderColor: '#000000',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 6,
            }}
            clickAction="TOGGLE_BALANCE"
          >
            <SvgWidget
              svg={isHidden ? EYE_OFF_SVG : EYE_OPEN_SVG}
              style={{ width: 17, height: 17 }}
            />
          </FlexWidget>

          {/* Nút Tạo Chi Tiêu Nhanh (-) mở thẳng popup Chi tiêu */}
          <FlexWidget
            style={{
              width: 32,
              height: 32,
              backgroundColor: '#FEE2E2',
              borderRadius: 8,
              borderWidth: 1.5,
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

          {/* Nút Tạo Thu Nhập Nhanh (+) mở thẳng popup Thu nhập */}
          <FlexWidget
            style={{
              width: 32,
              height: 32,
              backgroundColor: '#DCFCE7',
              borderRadius: 8,
              borderWidth: 1.5,
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

      {/* Thân giữa: Tổng tài sản (Khổ rộng 4 cột) */}
      <FlexWidget
        style={{
          width: 'match_parent',
          marginVertical: 4,
        }}
      >
        <TextWidget
          text="TỔNG TÀI SẢN"
          style={{
            fontSize: 9,
            fontWeight: '800',
            color: '#6B7280',
            letterSpacing: 0.5,
          }}
        />
        <TextWidget
          text={formattedAssets}
          style={{
            fontSize: 22,
            fontWeight: '900',
            color: '#000000',
            marginTop: 2,
          }}
        />
      </FlexWidget>

      {/* Khung đáy: Thu & Chi tháng này */}
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
          borderWidth: 1.5,
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
              color: '#E11D48',
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
