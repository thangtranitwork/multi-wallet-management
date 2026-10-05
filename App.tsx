import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { SQLiteProvider } from 'expo-sqlite';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';

dayjs.locale('vi');
import { DB_NAME, initDatabase } from './src/database/db';
import { WalletProvider } from './src/context/WalletContext';
import { SecurityProvider } from './src/context/SecurityContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LockScreenOverlay } from './src/components/LockScreenOverlay';
import { ErrorBoundary } from './src/components/ErrorBoundary';

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <StatusBar style="dark" />
        <SQLiteProvider databaseName={DB_NAME} onInit={initDatabase}>
          <SecurityProvider>
            <WalletProvider>
              <NavigationContainer>
                <RootNavigator />
                <LockScreenOverlay />
              </NavigationContainer>
            </WalletProvider>
          </SecurityProvider>
        </SQLiteProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
