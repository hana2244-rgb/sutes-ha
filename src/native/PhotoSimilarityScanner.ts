// ============================================================
// 捨てショ - Native Module Bridge (JS → Swift)
// ============================================================

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import type {
  SimilarityLevel,
  ScanProgress,
  SimilarGroup,
  DeleteResult,
  PhotoAsset,
} from '../types';

const { PhotoSimilarityScanner: NativeScanner } = NativeModules;

const isNativeAvailable = Platform.OS === 'ios' && NativeScanner != null;

/** Expo Go などネイティブモジュールが無い環境かどうか */
export function isNativeModuleAvailable(): boolean {
  return isNativeAvailable;
}

const scannerEmitter = isNativeAvailable
  ? new NativeEventEmitter(NativeScanner)
  : null;

const THRESHOLD_MAP: Record<SimilarityLevel, number> = {
  very_similar: 0.22,
  similar: 0.32,
  maybe_similar: 0.42,
};

export async function requestPhotoPermission(): Promise<
  'authorized' | 'limited' | 'denied'
> {
  if (!isNativeAvailable) {
    console.warn('[Scanner] Native module not available, using mock');
    return 'authorized';
  }
  return NativeScanner.requestPhotoPermission();
}

export async function startScan(level: SimilarityLevel): Promise<void> {
  if (!isNativeAvailable) {
    console.warn('[Scanner] Native module not available');
    return;
  }
  const threshold = THRESHOLD_MAP[level];
  return NativeScanner.startScan(threshold);
}

export async function pauseScan(): Promise<void> {
  if (!isNativeAvailable) return;
  return NativeScanner.pauseScan();
}

export async function resumeScan(level: SimilarityLevel): Promise<void> {
  if (!isNativeAvailable) return;
  const threshold = THRESHOLD_MAP[level];
  return NativeScanner.resumeScan(threshold);
}

export async function getScanProgress(): Promise<ScanProgress | null> {
  if (!isNativeAvailable) return null;
  return NativeScanner.getScanProgress();
}

export async function regroupWithLevel(
  level: SimilarityLevel
): Promise<SimilarGroup[]> {
  if (!isNativeAvailable) return [];
  const threshold = THRESHOLD_MAP[level];
  return NativeScanner.regroupWithThreshold(threshold);
}

export async function deleteAssets(assetIds: string[]): Promise<DeleteResult> {
  if (!isNativeAvailable) {
    return { deletedCount: 0, freedBytes: 0, success: false, error: 'Not available' };
  }
  return NativeScanner.deleteAssets(assetIds);
}

/** サムネイル用 file:// URL（一覧表示用） */
export async function getThumbnailURL(
  assetId: string,
  width: number = 256,
  height: number = 256
): Promise<string | null> {
  if (!isNativeAvailable) return null;
  const uri = await NativeScanner.getThumbnailURL(assetId, width, height);
  return uri ?? null;
}

/** 複数サムネイルを一括取得（1回のブリッジで高速化） */
export async function getThumbnailURLs(
  assetIds: string[],
  width: number = 256,
  height: number = 256
): Promise<Record<string, string>> {
  if (!isNativeAvailable || assetIds.length === 0) return {};
  const map = await NativeScanner.getThumbnailURLs(assetIds, width, height);
  return map ?? {};
}

/** スワイププレビュー用 file:// URL（1500x1500 実画像） */
export async function getPreviewImage(assetId: string): Promise<string | null> {
  if (!isNativeAvailable) return null;
  const uri = await NativeScanner.getPreviewImage(assetId);
  return uri ?? null;
}

/** 全写真をページネーションで取得（スワイプモード用） */
export async function getAllPhotos(
  offset: number,
  limit: number
): Promise<{ assets: PhotoAsset[]; total: number }> {
  if (!isNativeAvailable) return { assets: [], total: 0 };
  return NativeScanner.getAllPhotos(offset, limit);
}

export async function hasPartialScan(): Promise<boolean> {
  if (!isNativeAvailable) return false;
  return NativeScanner.hasPartialScan();
}

/** 次回起動用に保存されたグループ一覧（今日はここまでで保存したもの） */
export async function getSavedGroups(): Promise<SimilarGroup[]> {
  if (!isNativeAvailable) return [];
  return NativeScanner.getSavedGroups();
}

/** スキャン進捗・グループをファイルに永続化（「今日はここまで」用） */
export async function saveCurrentState(): Promise<void> {
  if (!isNativeAvailable) return;
  return NativeScanner.saveCurrentState();
}

export async function clearCache(): Promise<void> {
  if (!isNativeAvailable) return;
  return NativeScanner.clearCache();
}

export async function getTotalPhotoCount(): Promise<number> {
  if (!isNativeAvailable) return 0;
  return NativeScanner.getTotalPhotoCount();
}

type ScannerEventName =
  | 'onProgressUpdate'
  | 'onGroupFound'
  | 'onScanPaused'
  | 'onScanCompleted'
  | 'onThermalWarning';

function addScannerListener<T = unknown>(
  eventName: ScannerEventName,
  callback: (data: T) => void
): () => void {
  if (!scannerEmitter) {
    return () => {};
  }
  const subscription = scannerEmitter.addListener(eventName, callback as (data: unknown) => void);
  return () => subscription.remove();
}

export function subscribeScannerEvents(handlers: {
  onProgressUpdate?: (progress: ScanProgress) => void;
  onGroupFound?: (group: SimilarGroup) => void;
  /** 一時停止時、body で進捗が渡る場合あり（current/total の反映用） */
  onScanPaused?: (progress?: ScanProgress | null) => void;
  onScanCompleted?: (data: { totalGroups: number }) => void;
  onThermalWarning?: (data: { level: string }) => void;
}): () => void {
  const unsubscribers: (() => void)[] = [];

  if (handlers.onProgressUpdate) {
    unsubscribers.push(
      addScannerListener<ScanProgress>('onProgressUpdate', handlers.onProgressUpdate)
    );
  }
  if (handlers.onGroupFound) {
    unsubscribers.push(
      addScannerListener<SimilarGroup>('onGroupFound', handlers.onGroupFound)
    );
  }
  if (handlers.onScanPaused) {
    unsubscribers.push(
      addScannerListener<ScanProgress | null | undefined>('onScanPaused', handlers.onScanPaused)
    );
  }
  if (handlers.onScanCompleted) {
    unsubscribers.push(
      addScannerListener<{ totalGroups: number }>('onScanCompleted', handlers.onScanCompleted)
    );
  }
  if (handlers.onThermalWarning) {
    unsubscribers.push(
      addScannerListener<{ level: string }>('onThermalWarning', handlers.onThermalWarning)
    );
  }

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}
