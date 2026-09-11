import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { WalletWidget } from './WalletWidget';
import {
  loadWidgetData,
  toggleWidgetBalanceHidden,
} from '../services/widgetSyncService';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;

  if (widgetInfo.widgetName === 'WalletWidget') {
    switch (props.widgetAction) {
      case 'WIDGET_CLICK':
        if (props.clickAction === 'TOGGLE_BALANCE') {
          // Bấm mắt trên Widget: Lật trạng thái ẩn / hiện số dư tức thì ngoài Home Screen
          const updated = await toggleWidgetBalanceHidden();
          props.renderWidget(
            <WalletWidget
              totalAssets={updated.totalAssets}
              monthlyIncome={updated.monthlyIncome}
              monthlyExpense={updated.monthlyExpense}
              isHidden={updated.isHidden}
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
