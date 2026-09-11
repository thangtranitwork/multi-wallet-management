import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { WalletWidget } from './WalletWidget';
import {
  loadWidgetData,
  saveWidgetData,
  toggleWidgetBalanceHidden,
} from '../services/widgetSyncService';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;

  if (widgetInfo.widgetName === 'WalletWidget') {
    switch (props.widgetAction) {
      case 'WIDGET_CLICK':
        if (props.clickAction === 'TOGGLE_BALANCE') {
          const current = await loadWidgetData();
          // Nếu đang ẩn: Tuyệt đối không cho phép hiển thị số dư từ background task khi app đang tắt!
          // Bắt buộc phải mở app mới được hiển thị số dư!
          if (current.isHidden) {
            return;
          }
          // Chỉ cho phép thao tác ẩn đi ngoài widget
          const updated = await saveWidgetData({ isHidden: true });
          props.renderWidget(
            <WalletWidget
              totalAssets={updated.totalAssets}
              monthlyIncome={updated.monthlyIncome}
              monthlyExpense={updated.monthlyExpense}
              isHidden={true}
              isAppLockEnabled={updated.isAppLockEnabled}
              lastUpdated={updated.lastUpdated}
            />
          );
        }
        break;

      case 'WIDGET_ADDED':
      case 'WIDGET_UPDATE':
      case 'WIDGET_RESIZED': {
        const data = await loadWidgetData();
        props.renderWidget(
          <WalletWidget
            totalAssets={data.totalAssets}
            monthlyIncome={data.monthlyIncome}
            monthlyExpense={data.monthlyExpense}
            isHidden={data.isHidden}
            isAppLockEnabled={data.isAppLockEnabled}
            lastUpdated={data.lastUpdated}
          />
        );
        break;
      }

      default:
        break;
    }
  }
}
