// ============================================================
// 捨て写 - リワード広告（まとめて削除時に表示）
// ============================================================
// requestShowRewardedAd() が true → 削除許可、false → 削除拒否
// 広告の読込/表示が失敗した場合はフォールバックとして削除を許可

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from 'react-native-google-mobile-ads';
import { REWARDED_AD_UNIT_ID } from './adConfig';
import { AdsSdkReadyContext } from './AdsSdkReadyContext';
import { useAppStore } from '../store';

type RewardedAdContextValue = {
  requestShowRewardedAd: () => Promise<boolean>;
};

const RewardedAdContext = createContext<RewardedAdContextValue | null>(null);

export function useRewardedAdContext(): RewardedAdContextValue | null {
  return useContext(RewardedAdContext);
}

const MAX_RETRIES = 3;
const TIMEOUT_MS = 15000;

export function RewardedAdProvider({ children }: { children: React.ReactNode }) {
  const adsSdkReady = useContext(AdsSdkReadyContext);
  const isAdFree = useAppStore((s) => s.isAdFree);
  const adRef = useRef<RewardedAd | null>(null);
  const isLoadedRef = useRef(false);
  const pendingResolveRef = useRef<((v: boolean) => void) | null>(null);
  const earnedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadAttemptRef = useRef(0);
  const unsubscribersRef = useRef<(() => void)[]>([]);

  const cleanup = useCallback(() => {
    unsubscribersRef.current.forEach((fn) => fn());
    unsubscribersRef.current = [];
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
  }, []);

  const createAndLoad = useCallback(() => {
    cleanup();
    isLoadedRef.current = false;

    const ad = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });
    adRef.current = ad;

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      if (__DEV__) console.log('[RewardedAd] loaded');
      isLoadedRef.current = true;
      loadAttemptRef.current = 0;

      if (pendingResolveRef.current) {
        if (__DEV__) console.log('[RewardedAd] showing (was waiting)');
        // 広告表示開始 → ロード待ちタイムアウトをクリア（再生中に発火させない）
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        ad.show();
      }
    });

    const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      if (__DEV__) console.log('[RewardedAd] reward earned');
      earnedRef.current = true;
    });

    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      if (__DEV__) console.log('[RewardedAd] closed, earned:', earnedRef.current);
      resolvePending(earnedRef.current);
      loadAttemptRef.current = 0;
      createAndLoad();
    });

    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      if (__DEV__) console.warn('[RewardedAd] error:', error.message);
      isLoadedRef.current = false;

      if (loadAttemptRef.current < MAX_RETRIES) {
        loadAttemptRef.current += 1;
        const delay = loadAttemptRef.current * 2000;
        if (__DEV__) console.log(`[RewardedAd] retry ${loadAttemptRef.current}/${MAX_RETRIES} in ${delay}ms`);
        retryTimerRef.current = setTimeout(() => createAndLoad(), delay);
      } else if (pendingResolveRef.current) {
        if (__DEV__) console.warn('[RewardedAd] max retries exceeded, allowing action');
        resolvePending(true);
      }
    });

    unsubscribersRef.current = [unsubLoaded, unsubEarned, unsubClosed, unsubError];

    if (__DEV__) console.log('[RewardedAd] loading...');
    ad.load();
  }, []);

  const resolvePending = useCallback((value: boolean) => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (pendingResolveRef.current) {
      pendingResolveRef.current(value);
      pendingResolveRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!adsSdkReady) return;
    loadAttemptRef.current = 0;
    createAndLoad();
    return cleanup;
  }, [adsSdkReady, createAndLoad, cleanup]);

  const requestShowRewardedAd = useCallback((): Promise<boolean> => {
    if (isAdFree) return Promise.resolve(true);
    return new Promise((resolve) => {
      earnedRef.current = false;
      pendingResolveRef.current = resolve;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        if (__DEV__) console.warn('[RewardedAd] timeout, allowing action');
        if (pendingResolveRef.current) {
          pendingResolveRef.current(true);
          pendingResolveRef.current = null;
        }
      }, TIMEOUT_MS);

      if (isLoadedRef.current && adRef.current) {
        if (__DEV__) console.log('[RewardedAd] showing (already loaded)');
        // 広告表示開始 → ロード待ちタイムアウトをクリア（再生中に発火させない）
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        adRef.current.show();
      } else {
        if (__DEV__) console.log('[RewardedAd] not loaded, loading...');
        loadAttemptRef.current = 0;
        createAndLoad();
      }
    });
  }, [createAndLoad, isAdFree]);

  return (
    <RewardedAdContext.Provider value={{ requestShowRewardedAd }}>
      {children}
    </RewardedAdContext.Provider>
  );
}
