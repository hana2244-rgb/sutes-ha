# 捨て写（SuteSha）開発ガイド

> Cursor / Claude 開発時のコンテキスト用。プロジェクト概要・アーキテクチャ・規約をまとめています。詳細は `src/` と `ios/Modules/` の実装を参照してください。

---

## 1. 概要

| 項目 | 内容 |
|------|------|
| アプリ名 | 捨て写 |
| 機能 | 端末内の似ている写真を検出し、ユーザー主導で整理・削除 |
| プラットフォーム | iOS 16+ |
| スタック | React Native + Expo (Dev Client), Swift (UIKit), Zustand, Reanimated, react-i18next |

### 2つのモード

- **スキャン開始**: 類似画像を検索してグループ表示 → グループ単位で「残す」選択 → 削除。一時停止で「スキャンをここまでで中断」可能。
- **スワイプで整理**: 全写真を1枚ずつスワイプして残す/削除。スキャン結果のグループは「見比べて選ぶ」で4分割比較画面から選択・削除。

### コア体験（スキャンモード）

1. オンボーディングで「スワイプで整理」または「スキャン開始」を選択
2. スキャン開始 → Native が時刻クラスタ → Vision FeaturePrint → 類似判定
3. グループが見つかるたびに `onGroupFound` で UI に追加
4. 各グループで「残す」をタップ選択 → 「削除」で一括削除（確認あり）
5. 「スキャンをここまでで中断」で進捗・グループを保存し、次回「続きから再開」可能
6. 削除作業中は「📌 今日はここまで」でリスト位置を保存し、次回そのあたりから表示

---

## 2. ディレクトリ構成

```
sutesho/
├── App.tsx
├── app.json, eas.json, package.json, tsconfig.json
├── plugins/
│   ├── withPhotoSimilarityScanner.js    # prebuild で ios にコピー
│   └── ios-modules/                     # ★ EAS Build で使う Swift/.m（ここを正とする）
│       ├── PhotoSimilarityScanner.swift
│       └── PhotoSimilarityScanner.m
├── ios/
│   ├── sutesho-Bridging-Header.h
│   └── Modules/                         # 開発時は plugins と同期
│       ├── PhotoSimilarityScanner.swift
│       └── PhotoSimilarityScanner.m
└── src/
    ├── types/index.ts                   # 型定義
    ├── theme/index.ts                   # テーマ（色・spacing・shadow）
    ├── store/index.ts                   # Zustand
    ├── i18n/                            # ja, en, index
    ├── native/PhotoSimilarityScanner.ts # JS → Native ブリッジ
    ├── hooks/usePhotoScanner.ts
    ├── constants/storageKeys.ts         # AsyncStorage キー
    ├── components/
    │   ├── index.ts
    │   ├── ActionButton, ProgressBar, SimilaritySlider, PhotoGroupCard
    │   ├── ThermalBanner, Toast
    ├── screens/
    │   ├── OnboardingScreen.tsx
    │   ├── ScanScreen.tsx
    │   ├── SwipeAllPhotosScreen.tsx     # 全写真スワイプ
    │   └── CompareViewScreen.tsx        # 見比べて選ぶ（4分割比較）
    └── navigation/AppNavigator.tsx
```

---

## 3. アーキテクチャ

### 3.1 役割分担

- **JS**: UI、Zustand、進捗表示、類似レベル切替、スキャン開始/停止/再開、削除UI（選択→確認→実行）、トースト、i18n。
- **Native**: Photos、時刻クラスタ（同日+5分）、Vision FeaturePrint、距離計算、OperationQueue、発熱制御、進捗/グループ保存・復元、削除、サムネイル/プレビュー用 file URL 出力、全写真ページネーション（スワイプモード用）。

### 3.2 JS → Native（Promise）

| 関数 | 説明 |
|------|------|
| `requestPhotoPermission()` | 写真アクセス許可 |
| `startScan(level)` | スキャン開始（内部で threshold に変換） |
| `pauseScan()` | 一時停止（進捗・foundGroups をファイル保存） |
| `resumeScan(level)` | 続きから再開（threshold 渡す） |
| `getScanProgress()` | 現在進捗 |
| `getFoundGroups()` | 発見済みグループ |
| `getSavedGroups()` | 一時停止時に保存したグループ |
| `regroupWithLevel(level)` | 閾値変更で再グルーピング（再スキャン不要） |
| `deleteAssets(assetIds)` | 写真削除 |
| `getThumbnailURL(assetId, w, h)` / `getThumbnailURLs(assetIds, w, h)` | サムネイル file:// |
| `getPreviewImage(assetId)` | プレビュー用 file://（例: 1500x1500） |
| `getAllPhotos(offset, limit)` | 全写真ページネーション（スワイプモード用） |
| `hasPartialScan()` | 前回中断の有無 |
| `saveCurrentState()` | 現在のグループ・進捗をファイル保存（「今日はここまで」用） |
| `clearCache()` | FeaturePrint 等キャッシュ削除 |
| `getTotalPhotoCount()` | 写真総数 |

### 3.3 Native → JS（イベント）

| イベント | ペイロード | 説明 |
|----------|------------|------|
| `onProgressUpdate` | `ScanProgress` | 進捗（percent, current, total, phase, phaseLabel） |
| `onGroupFound` | `SimilarGroup` | 類似グループ1件 |
| `onScanPaused` | `ScanProgress \| null` | 一時停止時（body で進捗を送る場合あり） |
| `onScanCompleted` | `{ totalGroups: number }` | スキャン完了 |
| `onThermalWarning` | `{ level: string }` | 発熱状態 |

### 3.4 類似閾値

- `very_similar` < 0.22 / `similar` < 0.32 / `maybe_similar` < 0.42  
- レベル切替時は `regroupWithLevel()` のみ（FeaturePrint 再計算不要）。

---

## 4. 型・ストア（要点）

- **ScanState**: `'idle' | 'requesting_permission' | 'scanning' | 'paused' | 'completed' | 'error'`
- **SimilarGroup**: `id`, `assets: PhotoAsset[]`, `keepAssetIds: string[]`, `maxSimilarity`
- **ScanProgress**: `percent`, `current`, `total`, `phase: 'counting' | 'clustering' | 'analyzing' | 'grouping'`, `phaseLabel`
- **AppState**: `scanState`, `scanProgress`, `similarityLevel`, `groups`, `toasts`, `hasSeenOnboarding`, `hasPartialScan`, および `setScanState`, `addGroup`, `setGroups`, `removeAssetsFromGroups`, `toggleKeepAsset`, `setKeepAssets`, `addToast`, `setOnboardingSeen`, `setHasPartialScan` など。  
  （詳細は `src/types/index.ts` と `src/store/index.ts` を参照。）

---

## 5. テーマ

- **コンセプト**: ソーダグラス（パステル × ガラスモーフィズム）。ライト基調。
- **色**: `theme.colors` に `bg`, `bgCard`, `accent`, `secondary`, `success`, `danger`, `textPrimary`, `textSecondary` 等。  
  `src/theme/index.ts` を必ず使用する。

---

## 6. 開発手順・規約

### ビルド

```bash
npm install
npx expo prebuild --platform ios
npx expo run:ios
```

### Native 変更時

1. `ios/Modules/PhotoSimilarityScanner.swift` を編集
2. 新メソッド: `PhotoSimilarityScanner.m` に `RCT_EXTERN_METHOD`、`src/native/PhotoSimilarityScanner.ts` にラッパー
3. **EAS Build 用**: `plugins/ios-modules/` の Swift と .m を同じ内容にしておく（prebuild でここがコピーされる）
4. `npx expo prebuild --platform ios --clean` → `npx expo run:ios`

### コーディング規約

- TypeScript strict、型明示。関数コンポーネント + hooks のみ。
- スタイルは `StyleSheet.create`。状態はローカルは `useState`、グローバルは Zustand。
- ボタンタップ時は `expo-haptics`。命名: コンポーネント PascalCase、hooks/utils camelCase。

### 禁止事項

- SwiftUI 使用、ネットワーク通信、`UIBackgroundModes` 追加
- 写真の自動削除（必ずユーザー確認）
- `PHPhotoLibrary.shared().performChanges` 以外での削除
- FeaturePrint 用フル解像度（300x300 に制限）、メインスレッドでの FeaturePrint 処理

---

## 7. デバッグ

- Swift: `print("[SuteSha] ...")` → Xcode Console
- JS: `console.log('[Scanner] ...')` → Metro
- Native 未認識: `npx expo prebuild --platform ios --clean` → `cd ios && pod install` → `npx expo run:ios`

---

## 8. 参照

- 依存: `package.json` 参照（expo, react-native-reanimated, zustand, react-i18next, @react-navigation 等）
- 未実装・改善候補: オンボーディング永続化、エラーハンドリング強化、アプリアイコン/スプラッシュ等は必要に応じて `src/` を確認

---

*最終更新: プロジェクト現状に合わせて整理*
