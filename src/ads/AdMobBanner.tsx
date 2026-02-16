<<<<<<< HEAD
// ============================================================
// 捨て写 - AdMob バナー広告（常に画面下部）
// ============================================================
// Apple/AdMob 要件: 広告であることが分かる配置・個人化なしの場合は requestNonPersonalizedAdsOnly

import React, { useState, useCallback, useRef, useEffect, useContext } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
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
  const bannerWidth = Math.floor(Dimensions.get('window').width);

  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  const handleAdLoaded = useCallback(() => {
    console.log('[AdMobBanner] loaded');
    retryCount.current = 0;
  }, []);

  const handleAdFailedToLoad = useCallback((error: Error) => {
    console.warn('[AdMobBanner] failed:', error.message);
    if (retryCount.current < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount.current] ?? 60000;
      retryCount.current += 1;
      retryTimer.current = setTimeout(() => {
        console.log(`[AdMobBanner] retry ${retryCount.current}/${MAX_RETRIES}`);
        setAdKey((k) => k + 1); // re-mount で再リクエスト
      }, delay);
    }
  }, []);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {adsSdkReady && (
        <BannerAd
          key={adKey}
          unitId={BANNER_AD_UNIT_ID}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          width={bannerWidth}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          onAdLoaded={handleAdLoaded}
          onAdFailedToLoad={handleAdFailedToLoad}
        />
      )}
    </View>
  );
}

const BANNER_MIN_HEIGHT = 60;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minHeight: BANNER_MIN_HEIGHT,
    width: '100%',
  },
});
=======
// ============================================================
// 捨て写 - AdMob バナー広告（常に画面下部）
// ============================================================
// Apple/AdMob 要件: 広告であることが分かる配置・個人化なしの場合は requestNonPersonalizedAdsOnly

import React, { useState, useCallback, useRef, useEffect, useContext } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
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
  const bannerWidth = Math.floor(Dimensions.get('window').width);

  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  const handleAdLoaded = useCallback(() => {
    console.log('[AdMobBanner] loaded');
    retryCount.current = 0;
  }, []);

  const handleAdFailedToLoad = useCallback((error: Error) => {
    console.warn('[AdMobBanner] failed:', error.message);
    if (retryCount.current < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount.current] ?? 60000;
      retryCount.current += 1;
      retryTimer.current = setTimeout(() => {
        console.log(`[AdMobBanner] retry ${retryCount.current}/${MAX_RETRIES}`);
        setAdKey((k) => k + 1); // re-mount で再リクエスト
      }, delay);
    }
  }, []);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {adsSdkReady && (
        <BannerAd
          key={adKey}
          unitId={BANNER_AD_UNIT_ID}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          width={bannerWidth}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          onAdLoaded={handleAdLoaded}
          onAdFailedToLoad={handleAdFailedToLoad}
        />
      )}
    </View>
  );
}

const BANNER_MIN_HEIGHT = 60;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minHeight: BANNER_MIN_HEIGHT,
    width: '100%',
  },
});
>>>>>>> d8c7055 (Initial commit)
