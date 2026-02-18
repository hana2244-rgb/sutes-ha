// ============================================================
// 捨て写 - AdMob バナー広告（常に画面下部）
// ============================================================

import React, { useState, useCallback, useRef, useEffect, useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { BANNER_AD_UNIT_ID } from './adConfig';
import { AdsSdkReadyContext } from './AdsSdkReadyContext';

const MAX_RETRIES = 5;
const RETRY_DELAYS = [3000, 6000, 15000, 30000, 60000];

export function AdMobBanner() {
  const insets = useSafeAreaInsets();
  const adsSdkReady = useContext(AdsSdkReadyContext);
  const [adKey, setAdKey] = useState(0);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  const handleAdLoaded = useCallback(() => {
    if (__DEV__) console.log('[AdMobBanner] loaded');
    retryCount.current = 0;
  }, []);

  const handleAdFailedToLoad = useCallback((error: Error) => {
    if (__DEV__) console.warn('[AdMobBanner] failed:', error.message);
    if (retryCount.current < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount.current] ?? 60000;
      retryCount.current += 1;
      retryTimer.current = setTimeout(() => {
        if (__DEV__) console.log(`[AdMobBanner] retry ${retryCount.current}/${MAX_RETRIES}`);
        setAdKey((k) => k + 1);
      }, delay);
    }
  }, []);

  if (!adsSdkReady) return <View style={[styles.container, { paddingBottom: insets.bottom }]} />;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <BannerAd
        key={adKey}
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={handleAdLoaded}
        onAdFailedToLoad={handleAdFailedToLoad}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minHeight: 60,
    width: '100%',
  },
});
