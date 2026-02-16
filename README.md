# 🗑️ 捨て写（SuteSha）

**似てる写真整理アプリ** — React Native + Expo + Swift Native Module

端末内の写真をオフラインで解析し、似ている写真を自動検出。
ユーザーが残す写真を選び、不要な写真をさくっと削除できます。

---

## 🏗️ アーキテクチャ

```
React Native (UI / 状態管理)
  ↕  NativeEventEmitter / RCTBridge
Swift Native Module (Photos.framework + Vision)
```

### ファイル構成

```
sutesho/
├── App.tsx                          # エントリーポイント
├── app.json                         # Expo設定
├── eas.json                         # EASビルド設定
├── plugins/
│   └── withPhotoSimilarityScanner.js # Config Plugin（prebuild時にiosへコピー）
├── src/
│   ├── types/index.ts               # 型定義
│   ├── theme/index.ts               # テーマ（和モダン × ミニマル）
│   ├── store/index.ts               # Zustand ストア
│   ├── native/
│   │   └── PhotoSimilarityScanner.ts # JS→Native ブリッジ
│   ├── hooks/
│   │   └── usePhotoScanner.ts       # メインフック
│   ├── components/
│   │   ├── index.ts                 # コンポーネント一覧
│   │   ├── ProgressBar.tsx          # 進捗バー（Reanimated）
│   │   ├── SimilaritySlider.tsx     # 類似レベル3段階切替
│   │   ├── PhotoGroupCard.tsx       # グループ表示カード
│   │   ├── ActionButton.tsx         # 汎用ボタン
│   │   ├── ThermalBanner.tsx        # 発熱警告バナー
│   │   └── Toast.tsx                # トースト通知
│   ├── screens/
│   │   ├── OnboardingScreen.tsx     # 初回説明
│   │   └── ScanScreen.tsx          # メイン画面
│   └── navigation/
│       └── AppNavigator.tsx         # ナビゲーション
└── ios/
    ├── sutesho-Bridging-Header.h    # ObjCブリッジヘッダー
    └── Modules/
        ├── PhotoSimilarityScanner.m # ObjCブリッジ
        └── PhotoSimilarityScanner.swift # コアエンジン
```

---

## 🚀 セットアップ

### 前提条件
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- Xcode 15+ (iOS 16 SDK)

### インストール

```bash
cd sutesho
npm install

# Expo Dev Client でビルド（初回）
npx expo prebuild --platform ios
npx expo run:ios
```

### Expo Go で試す（UI プレビュー）

スキャン機能はネイティブモジュールのため Expo Go では動きませんが、画面遷移・デザインの確認はできます。

```bash
npm run start:go
```

QRコードを Expo Go で読み取り → 起動。画面上部に「Expo Go でプレビュー中」と表示され、「スキャン開始」を押すと「Expo Goではスキャン機能は使えません」とトーストが出ます。実機スキャンは `npx expo run:ios` の開発ビルドで行ってください。

**注意**: `app.json` の `icon` / `splash` 用に `assets/icon.png` と `assets/splash.png` が必要です。無い場合は適当な PNG を配置するか、一時的に `app.json` から該当キーを削除して試してください。

### EAS ビルド

```bash
# 開発ビルド（シミュレーター）
eas build --platform ios --profile development

# プレビュービルド（実機テスト）
eas build --platform ios --profile preview

# 本番ビルド
eas build --platform ios --profile production
```

---

## 📋 機能仕様

### 類似判定
| レベル | 閾値 | 用途 |
|--------|------|------|
| めっちゃ似てる 🎯 | < 0.22 | ほぼ同一の写真 |
| まあ似てる 🔍 | < 0.32 | 似た構図・場面 |
| 多分似てる 🌀 | < 0.42 | やや類似した写真 |

レベル切替は**再スキャン不要**（FeaturePrint距離の再グルーピングのみ）。

### スキャンフロー
1. **時刻クラスタリング**: 同日 + 5分以内の写真をグループ化
2. **FeaturePrint生成**: Vision framework で画像特徴量を抽出（300x300低解像度）
3. **距離計算**: クラスタ内でペアワイズ比較
4. **逐次通知**: グループ発見ごとにUIに即反映

### パフォーマンス
- `OperationQueue` で `activeProcessorCount` に基づく並列処理（2〜4）
- `thermalState` 監視: `serious` → 並列数削減, `critical` → 自動停止
- FeaturePrint はディスクキャッシュ（新規写真のみ再解析）

### プライバシー
- **完全オフライン**: 外部通信ゼロ
- **Photos.framework のみ**: 端末内処理
- Apple審査対応の `NSPhotoLibraryUsageDescription` 設定済み

---

## 🎨 デザイン

**テーマ**: 和モダン × ミニマル × ポップ
- **ベース**: ダークテーマ `#0A0A0A`
- **アクセント**: 朱色 `#E8503A`
- **セカンダリ**: 藍色 `#3D5A80`
- **成功**: 抹茶 `#7DB87D`

---

## 📝 Apple審査対応メモ

- `NSPhotoLibraryUsageDescription`: 明確な日本語説明
- `NSPhotoLibraryAddUsageDescription`: 設定済み
- 削除は `PHAssetChangeRequest.deleteAssets` → iOS標準の確認ダイアログ表示
- バックグラウンド処理なし（`UIBackgroundModes` 空）
- ネットワーク通信なし
