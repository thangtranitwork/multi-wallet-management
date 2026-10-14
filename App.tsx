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
import { CopilotProvider } from './src/context/CopilotContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LockScreenOverlay } from './src/components/LockScreenOverlay';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { logger } from './src/services/loggerService';

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <SQLiteProvider
          databaseName={DB_NAME}
          onInit={initDatabase}
          options={{ useNewConnection: true }}
          onError={(error) => {
            console.error('[SQLiteProvider] Lỗi kết nối cơ sở dữ liệu SQLite:', error);
          }}
        >
          <SecurityProvider>
            <WalletProvider>
              <CopilotProvider>
                <NavigationContainer
                  onStateChange={(state) => {
                    const route = state?.routes[state.index ?? 0]?.name;
                    if (route) {
                      logger.setCurrentScreen(route);
                    }
                  }}
                >
                  <RootNavigator />
                  <LockScreenOverlay />
                </NavigationContainer>
              </CopilotProvider>
            </WalletProvider>
          </SecurityProvider>
        </SQLiteProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
