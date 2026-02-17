// ============================================================
// 捨て写 - リワード広告（まとめて削除時に表示）
// ============================================================
// requestShowRewardedAd() が true を返した場合のみ削除を実行（AdMob 要件）
// 広告読込失敗時はフォールバックとして削除を許可

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRewardedAd } from 'react-native-google-mobile-ads';
import { REWARDED_AD_UNIT_ID } from './adConfig';
import { AdsSdkReadyContext } from './AdsSdkReadyContext';

type RewardedAdContextValue = {
  /** リワード広告を表示し、視聴完了で true、スキップ/エラーで false */
  requestShowRewardedAd: () => Promise<boolean>;
};

const RewardedAdContext = createContext<RewardedAdContextValue | null>(null);

export function useRewardedAdContext(): RewardedAdContextValue | null {
  return useContext(RewardedAdContext);
}

export function RewardedAdProvider({ children }: { children: React.ReactNode }) {
  const adsSdkReady = useContext(AdsSdkReadyContext);
  const adUnitId = adsSdkReady ? REWARDED_AD_UNIT_ID : null;
  const {
    load,
    show,
    isLoaded,
    isClosed,
    isEarnedReward,
    error,
  } = useRewardedAd(adUnitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  const pendingResolveRef = useRef<((value: boolean) => void) | null>(null);
  const needShowWhenLoadedRef = useRef(false);
  const earnedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadAttemptRef = useRef(0);
  const maxRetries = 3;
  // error 参照が変わらない場合に備えてカウントで検知
  const [errorCount, setErrorCount] = useState(0);

  // SDK 初期化完了後（adsSdkReady）に adUnitId が渡り、そのタイミングで初回ロード
  useEffect(() => {
    if (!adUnitId) return;
    loadAttemptRef.current = 0;
    if (__DEV__) console.log('[RewardedAd] initial load (SDK ready)');
    load();
  }, [adUnitId, load]);

  // 広告読み込みエラー検知
  useEffect(() => {
    if (error) {
      setErrorCount((c) => c + 1);
    }
  }, [error]);

  // エラーカウント変化でリトライ（error 参照が同じでも動く）
  useEffect(() => {
    if (errorCount === 0) return;
    if (__DEV__) console.warn(`[RewardedAd] load error #${errorCount}:`, error?.message);

    if (loadAttemptRef.current < maxRetries) {
      loadAttemptRef.current += 1;
      const delay = loadAttemptRef.current * 2000; // 2s, 4s, 6s
      if (__DEV__) console.log(`[RewardedAd] retry ${loadAttemptRef.current}/${maxRetries} in ${delay}ms`);
      retryTimerRef.current = setTimeout(() => load(), delay);
    } else if (pendingResolveRef.current) {
      // 最大リトライ超過 → 広告なしで削除を許可
      if (__DEV__) console.warn('[RewardedAd] max retries exceeded, allowing action without ad');
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      const resolve = pendingResolveRef.current;
      pendingResolveRef.current = null;
      needShowWhenLoadedRef.current = false;
      resolve(true);
    }
  }, [errorCount, load]);

  // タイマークリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const requestShowRewardedAd = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      earnedRef.current = false;
      pendingResolveRef.current = resolve;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // タイムアウト: 広告が表示できない場合は許可（UXブロック防止）
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        if (pendingResolveRef.current) {
          if (__DEV__) console.warn('[RewardedAd] timeout, allowing action without ad');
          pendingResolveRef.current(true);
          pendingResolveRef.current = null;
          needShowWhenLoadedRef.current = false;
        }
      }, 15000);

      if (isLoaded) {
        if (__DEV__) console.log('[RewardedAd] showing (already loaded)');
        show();
      } else {
        if (__DEV__) console.log('[RewardedAd] not loaded yet, loading...');
        needShowWhenLoadedRef.current = true;
        loadAttemptRef.current = 0;
        load();
      }
    });
  }, [isLoaded, load, show]);

  useEffect(() => {
    if (isEarnedReward) {
      if (__DEV__) console.log('[RewardedAd] reward earned');
      earnedRef.current = true;
    }
  }, [isEarnedReward]);

  useEffect(() => {
    if (isLoaded) {
      if (__DEV__) console.log('[RewardedAd] loaded');
      if (needShowWhenLoadedRef.current) {
        needShowWhenLoadedRef.current = false;
        show();
      }
    }
  }, [isLoaded, show]);

  useEffect(() => {
    if (isClosed) {
      if (__DEV__) console.log('[RewardedAd] closed, earned:', earnedRef.current);
      if (pendingResolveRef.current) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        const resolve = pendingResolveRef.current;
        pendingResolveRef.current = null;
        resolve(earnedRef.current);
      }
      // 次回用に事前ロード
      loadAttemptRef.current = 0;
      load();
    }
  }, [isClosed, load]);

  const value: RewardedAdContextValue = {
    requestShowRewardedAd,
  };

  return (
    <RewardedAdContext.Provider value={value}>
      {children}
    </RewardedAdContext.Provider>
  );
}
