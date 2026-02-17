// ============================================================
// 捨てショ - usePhotoScanner Hook
// ============================================================

import { useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import {
  requestPhotoPermission,
  startScan,
  pauseScan,
  resumeScan,
  getScanProgress,
  regroupWithLevel,
  deleteAssets,
  hasPartialScan,
  getSavedGroups,
  clearCache,
  subscribeScannerEvents,
  getTotalPhotoCount,
  isNativeModuleAvailable,
} from '../native/PhotoSimilarityScanner';
import type { SimilarityLevel, SimilarGroup } from '../types';

export function usePhotoScanner() {
  const { t } = useTranslation();
  const isSubscribed = useRef(false);

  const scanState = useAppStore((s) => s.scanState);
  const scanProgress = useAppStore((s) => s.scanProgress);
  const similarityLevel = useAppStore((s) => s.similarityLevel);
  const groups = useAppStore((s) => s.groups);
  const thermalLevel = useAppStore((s) => s.thermalLevel);

  useEffect(() => {
    if (isSubscribed.current) return;
    isSubscribed.current = true;

    const unsubscribe = subscribeScannerEvents({
      onProgressUpdate: (progress) => {
        useAppStore.getState().setScanProgress(progress);
      },
      onGroupFound: (group: SimilarGroup) => {
        useAppStore.getState().addGroup(group);
      },
      onScanPaused: (progressFromEvent) => {
        useAppStore.getState().setScanState('paused');
        useAppStore.getState().setHasPartialScan(true);
        if (progressFromEvent?.current != null && progressFromEvent?.total != null) {
          useAppStore.getState().setScanProgress(progressFromEvent);
        } else {
          getScanProgress().then((p) => {
            if (p) useAppStore.getState().setScanProgress(p);
          });
        }
      },
      onScanCompleted: (data) => {
        useAppStore.getState().setScanState('completed');
        useAppStore.getState().setHasPartialScan(false);
        const totalGroups = typeof data?.totalGroups === 'number' ? data.totalGroups : useAppStore.getState().groups.length;
        useAppStore.getState().addToast({
          emoji: '✅',
          text: t('scanner.scanComplete'),
          subtext: t('scanner.groupsFound', { count: totalGroups }),
        });
      },
      onThermalWarning: ({ level }) => {
        useAppStore.getState().setThermalLevel(level);
        if (level === 'critical') {
          useAppStore.getState().addToast({
            emoji: '🌡️',
            text: t('scanner.deviceHot'),
            subtext: t('scanner.autoStopped'),
            duration: 3000,
          });
        } else if (level === 'serious') {
          useAppStore.getState().addToast({
            emoji: '🌡️',
            text: t('scanner.warmingUp'),
            subtext: t('scanner.slowedDown'),
            duration: 2000,
          });
        }
      },
    });

    return () => {
      unsubscribe();
      isSubscribed.current = false;
    };
  }, [t]);

  const handleStartScan = useCallback(async () => {
    try {
      if (!isNativeModuleAvailable()) {
        useAppStore.getState().setScanState('scanning');
        useAppStore.getState().setGroups([]);
        useAppStore.getState().setScanProgress(null);
        await startScan(useAppStore.getState().similarityLevel);
        useAppStore.getState().setScanState('completed');
        useAppStore.getState().addToast({
          emoji: '📱',
          text: t('scanner.expoGoNoScan'),
          subtext: t('scanner.expoGoHint'),
          duration: 4000,
        });
        return;
      }

      useAppStore.getState().setScanState('requesting_permission');
      const permission = await requestPhotoPermission();

      if (permission === 'denied') {
        useAppStore.getState().setScanState('error');
        useAppStore.getState().addToast({
          emoji: '⚠️',
          text: t('scanner.permissionNeeded'),
          subtext: t('scanner.permissionHint'),
          duration: 3000,
        });
        return;
      }

      useAppStore.getState().setScanState('scanning');
      useAppStore.getState().setGroups([]);
      useAppStore.getState().setScanProgress(null);
      await startScan(useAppStore.getState().similarityLevel);
    } catch (error) {
      if (__DEV__) console.error('[Scanner] Start failed:', error);
      useAppStore.getState().setScanState('error');
      useAppStore.getState().addToast({
        emoji: '❌',
        text: t('scanner.scanFailed'),
        duration: 3000,
      });
    }
  }, [t]);

  const handlePause = useCallback(async () => {
    try {
      await pauseScan();
    } catch (error) {
      if (__DEV__) console.error('[Scanner] Pause failed:', error);
    }
  }, []);

  const handleResume = useCallback(async () => {
    try {
      useAppStore.getState().setScanState('scanning');
      await resumeScan(useAppStore.getState().similarityLevel);
    } catch (error) {
      if (__DEV__) console.error('[Scanner] Resume failed:', error);
      useAppStore.getState().setScanState('error');
    }
  }, []);

  const handleChangeSimilarityLevel = useCallback(
    async (level: SimilarityLevel) => {
      useAppStore.getState().setSimilarityLevel(level);
      const state = useAppStore.getState().scanState;
      if (state === 'completed' || state === 'paused') {
        try {
          const newGroups = await regroupWithLevel(level);
          useAppStore.getState().setGroups(newGroups);
        } catch (error) {
          if (__DEV__) console.error('[Scanner] Regroup failed:', error);
        }
      }
    },
    []
  );

  const handleDeleteAssets = useCallback(
    async (assetIds: string[]) => {
      try {
        const result = await deleteAssets(assetIds);
        const store = useAppStore.getState();
        if (result?.success) {
          store.removeAssetsFromGroups(assetIds);
          const freedMB = (result.freedBytes / (1024 * 1024)).toFixed(0);
          store.addToast({
            emoji: '🎉',
            text: t('scanner.deleteSuccess', { count: result.deletedCount }),
            subtext: t('scanner.deleteFreed', { size: freedMB }),
            duration: 2500,
          });
        } else if (isNativeModuleAvailable()) {
          store.addToast({
            emoji: '❌',
            text: t('scanner.deleteFailed'),
            subtext: result?.error,
            duration: 3000,
          });
        } else {
          store.removeAssetsFromGroups(assetIds);
          store.addToast({
            emoji: '👀',
            text: t('scanner.demoDelete'),
            duration: 2500,
          });
        }
        return result;
      } catch (error) {
        if (__DEV__) console.error('[Scanner] Delete failed:', error);
        useAppStore.getState().addToast({
          emoji: '❌',
          text: t('scanner.deleteError'),
          duration: 3000,
        });
        return {
          deletedCount: 0,
          freedBytes: 0,
          success: false,
          error: String(error),
        };
      }
    },
    [t]
  );

  const checkPartialScan = useCallback(async () => {
    const has = await hasPartialScan();
    useAppStore.getState().setHasPartialScan(has);
    if (has) {
      try {
        const savedGroups = await getSavedGroups();
        if (savedGroups.length > 0) {
          useAppStore.getState().setGroups(savedGroups);
        }
      } catch (e) {
        if (__DEV__) console.warn('[Scanner] getSavedGroups failed:', e);
      }
    }
    return has;
  }, []);

  const getPhotoCount = useCallback(async () => {
    return getTotalPhotoCount();
  }, []);

  const handleClearCache = useCallback(async () => {
    try {
      await clearCache();
      useAppStore.getState().setGroups([]);
      useAppStore.getState().setHasPartialScan(false);
      useAppStore.getState().setScanState('idle');
      // キャッシュクリア後にアプリを再起動
      const RNRestart = require('react-native-restart').default;
      RNRestart.restart();
    } catch (error) {
      if (__DEV__) console.error('[Scanner] Clear cache failed:', error);
    }
  }, []);

  return {
    scanState,
    scanProgress,
    similarityLevel,
    groups,
    thermalLevel,

    startScan: handleStartScan,
    pauseScan: handlePause,
    resumeScan: handleResume,
    changeSimilarityLevel: handleChangeSimilarityLevel,
    deleteAssets: handleDeleteAssets,
    clearCache: handleClearCache,
    checkPartialScan,
    getPhotoCount,
  };
}
