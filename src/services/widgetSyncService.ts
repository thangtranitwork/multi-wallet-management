import { File, Paths } from 'expo-file-system';
import { requestWidgetUpdate } from 'react-native-android-widget';
import React from 'react';
import { WalletWidget } from '../widgets/WalletWidget';

export interface WidgetData {
  totalAssets: number;
  monthlyIncome: number;
  monthlyExpense: number;
  isHidden: boolean;
  isAppLockEnabled?: boolean;
  walletCount: number;
  lastUpdated: string;
}

const DEFAULT_WIDGET_DATA: WidgetData = {
  totalAssets: 0,
  monthlyIncome: 0,
  monthlyExpense: 0,
  isHidden: true,
  isAppLockEnabled: false,
  walletCount: 0,
  lastUpdated: '',
};

function getWidgetFile(): File {
  return new File(Paths.document, 'widget_data.json');
}

/**
 * Đọc dữ liệu widget hiện tại từ bộ nhớ cục bộ
 */
export async function loadWidgetData(): Promise<WidgetData> {
  try {
    const file = getWidgetFile();
    if (file.exists) {
      const content = await file.text();
      const parsed = JSON.parse(content);
      return { ...DEFAULT_WIDGET_DATA, ...parsed };
    }
  } catch (err) {
    console.warn('Lỗi đọc dữ liệu widget:', err);
  }
  return DEFAULT_WIDGET_DATA;
}

/**
 * Lưu dữ liệu widget vào bộ nhớ cục bộ
 */
export async function saveWidgetData(data: Partial<WidgetData>): Promise<WidgetData> {
  try {
    const current = await loadWidgetData();
    const updated: WidgetData = {
      ...current,
      ...data,
      lastUpdated: new Date().toISOString(),
    };
    const file = getWidgetFile();
    if (!file.exists) {
      file.create();
    }
    await file.write(JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Lỗi ghi dữ liệu widget:', err);
    return { ...DEFAULT_WIDGET_DATA, ...data };
  }
}

/**
 * Đổi trạng thái ẩn/hiện số dư từ Widget (không cần mở app)
 */
export async function toggleWidgetBalanceHidden(): Promise<WidgetData> {
  const current = await loadWidgetData();
  const nextHidden = !current.isHidden;
  return await saveWidgetData({ isHidden: nextHidden });
}

/**
 * Đồng bộ dữ liệu mới nhất từ App ra Widget ngoài Home Screen
 */
export async function syncWidgetData(data: {
  totalAssets?: number;
  monthlyIncome?: number;
  monthlyExpense?: number;
  isHidden?: boolean;
  isAppLockEnabled?: boolean;
  walletCount?: number;
}): Promise<void> {
  try {
    const updated = await saveWidgetData(data);

    // Yêu cầu hệ thống Android vẽ lại widget
    await requestWidgetUpdate({
      widgetName: 'WalletWidget',
      renderWidget: () => (
        React.createElement(WalletWidget, {
          totalAssets: updated.totalAssets,
          monthlyIncome: updated.monthlyIncome,
          monthlyExpense: updated.monthlyExpense,
          isHidden: updated.isHidden,
          isAppLockEnabled: updated.isAppLockEnabled,
          lastUpdated: updated.lastUpdated,
        })
      ),
      widgetNotFound: () => {
        // Người dùng chưa thêm widget ra màn hình chính, không cần làm gì
      },
    });
  } catch (err) {
    // Nếu chạy trên Expo Go hoặc thiết bị chưa có widget, bỏ qua lỗi im lặng
    console.log('Widget update status:', (err as any)?.message || 'skipped');
  }
}
