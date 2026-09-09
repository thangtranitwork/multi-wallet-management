import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { SQLiteProvider } from 'expo-sqlite';
import { DB_NAME, initDatabase } from './src/database/db';
import { WalletProvider } from './src/context/WalletContext';
import { SecurityProvider } from './src/context/SecurityContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LockScreenOverlay } from './src/components/LockScreenOverlay';

export default function App() {
  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}
