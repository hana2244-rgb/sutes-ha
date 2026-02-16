// ============================================================
// 捨てショ - Type Definitions
// ============================================================

/** 類似レベル */
export type SimilarityLevel = 'very_similar' | 'similar' | 'maybe_similar';

/** 類似レベルの設定 */
export interface SimilarityConfig {
  key: SimilarityLevel;
  emoji: string;
  threshold: number;
}

export const SIMILARITY_LEVELS: SimilarityConfig[] = [
  {
    key: 'very_similar',
    emoji: '🎯',
    threshold: 0.22,
  },
  {
    key: 'similar',
    emoji: '🔍',
    threshold: 0.32,
  },
  {
    key: 'maybe_similar',
    emoji: '🌀',
    threshold: 0.42,
  },
];

/** スキャン状態 */
export type ScanState =
  | 'idle'
  | 'requesting_permission'
  | 'scanning'
  | 'paused'
  | 'completed'
  | 'error';

/** 写真アセット（Nativeから受け取る） */
export interface PhotoAsset {
  id: string;
  uri: string;
  creationDate: string;
  fileSize: number;
  width: number;
  height: number;
}

/** 類似グループ */
export interface SimilarGroup {
  id: string;
  assets: PhotoAsset[];
  keepAssetIds: string[];
  maxSimilarity: number;
}

/** スキャン進捗 */
export interface ScanProgress {
  percent: number;
  current: number;
  total: number;
  phase: 'counting' | 'clustering' | 'analyzing' | 'grouping';
  phaseLabel: string;
}

/** 削除結果 */
export interface DeleteResult {
  deletedCount: number;
  freedBytes: number;
  success: boolean;
  error?: string;
}

/** トースト */
export interface ToastMessage {
  id: string;
  text: string;
  emoji: string;
  subtext?: string;
  duration?: number;
}

/** ストア状態 */
export interface AppState {
  scanState: ScanState;
  scanProgress: ScanProgress | null;
  similarityLevel: SimilarityLevel;
  groups: SimilarGroup[];
  thermalLevel: string;

  toasts: ToastMessage[];
  hasSeenOnboarding: boolean;
  hasPartialScan: boolean;

  setScanState: (state: ScanState) => void;
  setScanProgress: (progress: ScanProgress | null) => void;
  setSimilarityLevel: (level: SimilarityLevel) => void;
  addGroup: (group: SimilarGroup) => void;
  setGroups: (groups: SimilarGroup[]) => void;
  removeAssetsFromGroups: (assetIds: string[]) => void;
  toggleKeepAsset: (groupId: string, assetId: string) => void;
  setKeepAssets: (groupId: string, keepIds: string[]) => void;
  setThermalLevel: (level: string) => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  setOnboardingSeen: () => void;
  setHasSeenOnboarding: (value: boolean) => void;
  setHasPartialScan: (has: boolean) => void;
}
