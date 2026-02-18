// ============================================================
// 捨てショ - App Entry Point
// ============================================================

import './src/i18n';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ToastContainer } from './src/components/Toast';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <View style={styles.main}>
            <View style={styles.content}>
              <StatusBar style="dark" />
              <AppNavigator />
              <ToastContainer />
            </View>
          </View>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#DFE6F6',
  },
  main: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
