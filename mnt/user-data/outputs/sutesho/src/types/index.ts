// ============================================================
// 捨てショ - Type Definitions
// ============================================================

/** 類似レベル */
export type SimilarityLevel = 'very_similar' | 'similar' | 'maybe_similar';

/** 類似レベルの設定 */
export interface SimilarityConfig {
  key: SimilarityLevel;
  label: string;
  emoji: string;
  threshold: number;
  description: string;
}

export const SIMILARITY_LEVELS: SimilarityConfig[] = [
  {
    key: 'very_similar',
    label: 'めっちゃ似てる',
    emoji: '🎯',
    threshold: 0.22,
    description: 'ほぼ同じ写真だけ',
  },
  {
    key: 'similar',
    label: 'まあ似てる',
    emoji: '🔍',
    threshold: 0.32,
    description: '似てる写真も含む',
  },
  {
    key: 'maybe_similar',
    label: '多分似てる',
    emoji: '🌀',
    threshold: 0.42,
    description: 'ちょっと似てるのも含む',
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
  id: string; // localIdentifier
  uri: string;
  creationDate: string; // ISO 8601
  fileSize: number; // bytes
  width: number;
  height: number;
}

/** 類似グループ */
export interface SimilarGroup {
  id: string;
  assets: PhotoAsset[];
  /** ユーザーが残すと選んだアセットID */
  keepAssetId: string | null;
  /** グループ内の最大類似度 */
  maxSimilarity: number;
}

/** スキャン進捗 */
export interface ScanProgress {
  percent: number;
  current: number;
  total: number;
  phase: 'clustering' | 'analyzing' | 'grouping';
  phaseLabel: string;
}

/** 削除結果 */
export interface DeleteResult {
  deletedCount: number;
  freedBytes: number;
  success: boolean;
  error?: string;
}

/** Native Module イベント */
export interface ScannerEvents {
  onProgressUpdate: (progress: ScanProgress) => void;
  onGroupFound: (group: SimilarGroup) => void;
  onScanPaused: () => void;
  onScanCompleted: (totalGroups: number) => void;
  onThermalWarning: (level: 'nominal' | 'fair' | 'serious' | 'critical') => void;
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
  // スキャン
  scanState: ScanState;
  scanProgress: ScanProgress | null;
  similarityLevel: SimilarityLevel;
  groups: SimilarGroup[];
  thermalLevel: string;

  // UI
  toasts: ToastMessage[];
  hasSeenOnboarding: boolean;
  lastScanDate: string | null;
  hasPartialScan: boolean;

  // アクション
  setScanState: (state: ScanState) => void;
  setScanProgress: (progress: ScanProgress | null) => void;
  setSimilarityLevel: (level: SimilarityLevel) => void;
  addGroup: (group: SimilarGroup) => void;
  setGroups: (groups: SimilarGroup[]) => void;
  removeAssetsFromGroups: (assetIds: string[]) => void;
  setKeepAsset: (groupId: string, assetId: string) => void;
  setThermalLevel: (level: string) => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  setOnboardingSeen: () => void;
  setHasPartialScan: (has: boolean) => void;
}
