import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Platform, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { DashboardScreen } from '../screens/DashboardScreen';
import { WalletsScreen } from '../screens/WalletsScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { DebtsScreen } from '../screens/DebtsScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { QuickAddModal } from '../components/QuickAddModal';
import { THEME } from '../constants';

const Tab = createBottomTabNavigator();
const NullComponent = () => null;

export const RootNavigator: React.FC = () => {
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [centerPressed, setCenterPressed] = useState(false);

  return (
    <>
      <Tab.Navigator
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

        {/* Center Tactile Neo-Brutalist Add Button (+) y hệt nút vàng trong ảnh của Ngài */}
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
                    onPress={() => setQuickAddVisible(true)}
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
        onClose={() => setQuickAddVisible(false)}
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
