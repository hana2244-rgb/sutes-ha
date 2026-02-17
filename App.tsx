// ============================================================
// 捨てショ - App Entry Point
// ============================================================

import './src/i18n';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import mobileAds from 'react-native-google-mobile-ads';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ToastContainer } from './src/components/Toast';
import { AdsSdkReadyContext } from './src/ads/AdsSdkReadyContext';
import { RewardedAdProvider } from './src/ads/RewardedAdContext';
import { AdMobBanner } from './src/ads/AdMobBanner';

const INIT_TIMEOUT_MS = 5000;

export default function App() {
  const [adsSdkReady, setAdsSdkReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        if (__DEV__) console.log('[AdMob] init timeout, allowing ad mount');
        setAdsSdkReady(true);
      }
    }, INIT_TIMEOUT_MS);

    mobileAds()
      .initialize()
      .then((status) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        if (__DEV__) console.log('[AdMob] SDK initialized:', JSON.stringify(status));
        setAdsSdkReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        if (__DEV__) console.warn('[AdMob] SDK init failed:', err?.message ?? err);
        setAdsSdkReady(true);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AdsSdkReadyContext.Provider value={adsSdkReady}>
            <RewardedAdProvider>
              <View style={styles.main}>
                <View style={styles.content}>
                  <StatusBar style="dark" />
                  <AppNavigator />
                  <ToastContainer />
                </View>
                <AdMobBanner />
              </View>
            </RewardedAdProvider>
          </AdsSdkReadyContext.Provider>
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
