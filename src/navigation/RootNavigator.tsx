import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Platform, Text, Linking } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { DashboardScreen } from '../screens/DashboardScreen';
import { WalletsScreen } from '../screens/WalletsScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { DebtsScreen } from '../screens/DebtsScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { QuickAddModal } from '../components/QuickAddModal';
import { THEME } from '../constants';
import { hapticMedium } from '../utils/haptics';
import { saveWidgetData, syncWidgetData } from '../services/widgetSyncService';

const Tab = createBottomTabNavigator();
const NullComponent = () => null;

export const RootNavigator: React.FC = () => {
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [quickAddType, setQuickAddType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [quickAddPrefill, setQuickAddPrefill] = useState<{
    categoryId?: string;
    amount?: number;
    note?: string;
  }>({});
  const [centerPressed, setCenterPressed] = useState(false);

  useEffect(() => {
    const handleDeepLink = (url: string | null) => {
      if (!url) return;
      try {
        if (url.includes('unlock-widget')) {
          // Mở app yêu cầu xác thực vân tay/PIN (qua LockScreenOverlay)
          // Khi app được mở, hiển thị số dư trên widget
          saveWidgetData({ isHidden: false }).then(async (updated) => {
            await syncWidgetData({
              totalAssets: updated.totalAssets,
              monthlyIncome: updated.monthlyIncome,
              monthlyExpense: updated.monthlyExpense,
              isHidden: false,
              isAppLockEnabled: true,
            });
          });
        } else if (url.includes('type=income')) {
          setQuickAddPrefill({});
          setQuickAddType('income');
          setQuickAddVisible(true);
        } else if (url.includes('type=expense')) {
          setQuickAddPrefill({});
          setQuickAddType('expense');
          setQuickAddVisible(true);
        } else if (url.includes('quick-add')) {
          setQuickAddPrefill({});
          setQuickAddType('expense');
          setQuickAddVisible(true);
        }
      } catch (e) {
        console.error('Error handling widget deep link:', e);
      }
    };

    Linking.getInitialURL().then(handleDeepLink);

    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // Xử lý khi người dùng chạm vào thông báo nhắc nhở thông minh
    const handleNotificationData = (data: any) => {
      if (!data) return;
      if (data.action === 'QUICK_ADD') {
        if (data.type) {
          setQuickAddType(data.type);
        }
        setQuickAddPrefill({
          categoryId: data.categoryId,
          note: data.suggestedNote,
        });
        setQuickAddVisible(true);
      }
    };

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification?.request?.content?.data) {
        handleNotificationData(response.notification.request.content.data);
      }
    });

    const notificationSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      handleNotificationData(data);
    });

    return () => {
      subscription.remove();
      notificationSub.remove();
    };
  }, []);

  return (
    <>
      <Tab.Navigator
        screenListeners={{
          tabPress: () => {
            hapticMedium();
          },
        }}
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.neoTabBar,
          tabBarActiveTintColor: '#000000',
          tabBarInactiveTintColor: '#6B7280',
          tabBarLabelStyle: styles.tabBarLabel,
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            tabBarLabel: 'Tổng quan',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.tabIconBox, focused && styles.tabIconBoxActive]}>
                <Ionicons
                  name={focused ? 'home' : 'home-outline'}
                  size={19}
                  color="#000000"
                />
              </View>
            ),
          }}
        />

        <Tab.Screen
          name="Wallets"
          component={WalletsScreen}
          options={{
            tabBarLabel: 'Ví tiền',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.tabIconBox, focused && styles.tabIconBoxActive]}>
                <Ionicons
                  name={focused ? 'wallet' : 'wallet-outline'}
                  size={19}
                  color="#000000"
                />
              </View>
            ),
          }}
        />

        {/* Center Tactile Neo-Brutalist Add Button (+) */}
        <Tab.Screen
          name="QuickAddTab"
          component={NullComponent}
          options={{
            tabBarLabel: '',
            tabBarButton: () => {
              const currentOffset = centerPressed ? 0 : 3;
              return (
                <View style={styles.centerBtnContainer}>
                  <Pressable
                    onPressIn={() => setCenterPressed(true)}
                    onPressOut={() => setCenterPressed(false)}
                    onPress={() => {
                      hapticMedium();
                      setQuickAddType('expense');
                      setQuickAddVisible(true);
                    }}
                    style={styles.centerShadowBox}
                  >
                    <View
                      style={[
                        styles.centerInnerBtn,
                        {
                          transform: [
                            { translateX: -currentOffset },
                            { translateY: -currentOffset },
                          ],
                        },
                      ]}
                    >
                      <Ionicons name="add" size={28} color="#000000" />
                    </View>
                  </Pressable>
                </View>
              );
            },
          }}
        />

        <Tab.Screen
          name="Debts"
          component={DebtsScreen}
          options={{
            tabBarLabel: 'Sổ nợ',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.tabIconBox, focused && styles.tabIconBoxActive]}>
                <Ionicons
                  name={focused ? 'people' : 'people-outline'}
                  size={19}
                  color="#000000"
                />
              </View>
            ),
          }}
        />

        <Tab.Screen
          name="Transactions"
          component={TransactionsScreen}
          options={{
            tabBarLabel: 'Giao dịch',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.tabIconBox, focused && styles.tabIconBoxActive]}>
                <Ionicons
                  name={focused ? 'receipt' : 'receipt-outline'}
                  size={19}
                  color="#000000"
                />
              </View>
            ),
          }}
        />

        <Tab.Screen
          name="Analytics"
          component={AnalyticsScreen}
          options={{
            tabBarItemStyle: { display: 'none' },
            tabBarButton: () => null,
          }}
        />

        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarItemStyle: { display: 'none' },
            tabBarButton: () => null,
          }}
        />
      </Tab.Navigator>

      <QuickAddModal
        visible={quickAddVisible}
        onClose={() => {
          setQuickAddVisible(false);
          setQuickAddPrefill({});
        }}
        defaultType={quickAddType}
        prefillCategoryId={quickAddPrefill.categoryId}
        prefillAmount={quickAddPrefill.amount}
        prefillNote={quickAddPrefill.note}
      />
    </>
  );
};

const styles = StyleSheet.create({
  neoTabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2.5,
    borderTopColor: '#000000',
    height: Platform.OS === 'ios' ? 86 : 68,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    elevation: 8,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
    marginTop: 2,
  },
  tabIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIconBoxActive: {
    backgroundColor: THEME.primaryLight,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  centerBtnContainer: {
    top: -16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerShadowBox: {
    backgroundColor: '#000000',
    borderRadius: 16,
    width: 48,
    height: 48,
  },
  centerInnerBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: THEME.popYellow,
    borderWidth: 2.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
