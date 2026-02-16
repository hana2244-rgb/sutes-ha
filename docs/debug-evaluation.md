# 捨て写 - デバッグ評価

評価日: 2025年2月（最新確認）

---

## 1. 現状サマリー

| 項目 | 状態 | 備考 |
|------|------|------|
| JS ログ | ⚠️ 部分的 | プレフィックス統一あり、本番でも出力 |
| Swift ログ | ❌ 未使用 | ガイドに記載あるが実装に print なし |
| エラー表示 | ✅ 良好 | Toast + console.error でユーザー・開発者に通知 |
| Error Boundary | ✅ 導入済み | ルートでラップ、フォールバック＋「もう一度試す」 |
| ビルド構成 | ✅ 明確 | development=Debug / production=Release |
| クラッシュ収集 | ❌ なし | 本番クラッシュの追跡なし |

---

## 2. 良い点

### 2.1 ログのプレフィックス統一
- `[Scanner]` … usePhotoScanner / PhotoSimilarityScanner
- `[ScanScreen]` … スキャン画面の保存・復元
- `[SwipeAll]` … スワイプ画面
- Metro / Xcode でフィルタしやすい。

### 2.2 エラー時のユーザー通知
- Native 失敗時は `addToast` でメッセージ表示。
- 削除失敗などは `console.error` と Toast の両方で追いやすい。

### 2.3 開発ビルドの分離
- `eas.json`: development → `developmentClient: true`, `buildConfiguration: "Debug"`。
- 本番は Release。デバッグ用と配布用の切り分けは明確。

### 2.4 TypeScript strict
- 型エラーをビルド時にはじけるため、実行前のデバッグに有効。

### 2.5 Error Boundary（導入済み）
- `App.tsx` で `ErrorBoundary` がルートをラップ。
- 未捕捉の React 例外時に「問題が発生しました」＋「もう一度試す」を表示。`__DEV__` 時はエラーメッセージも表示、`console.error('[ErrorBoundary]', ...)` でログ出力。

---

## 3. 課題と推奨

### 3.1 Swift 側にログがない（優先: 中）
- **現状**: CLAUDE.md に「`print("[SuteSha] ...")` → Xcode Console」とあるが、Swift 内に print が無い。
- **影響**: クラスタ数・一時停止・キャッシュヒットなど、Native の挙動を追いにくい。
- **推奨**:
  - 重要なポイントにだけ `print("[SuteSha] ...")` を入れる（例: スキャン開始/一時停止/完了、クラスタ数、キャッシュ保存）。
  - または `#if DEBUG` で囲い、Release では出さないようにする。

### 3.2 本番でも console が出る（優先: 低）
- **現状**: `console.warn` / `console.error` に `__DEV__` ガードが無い。
- **影響**: 本番ビルドでも Metro に繋いでいればログが出る。通常ユーザーは Metro を使わないため実害は小さいが、ログ内容によっては情報漏れの懸念。
- **推奨**: 詳細なデバッグ用 `console.log` には `if (__DEV__) { ... }` を付ける。`console.error` は本番でも残してよい（問題追跡のため）。

### 3.3 クラッシュ・エラー収集が無い（優先: 将来）
- **現状**: Sentry 等のクラッシュ/エラー収集は未導入。
- **影響**: 本番のクラッシュや Native 例外を事後的に追いにくい。
- **推奨**: リリース安定後、必要に応じて Sentry や Apple のクラッシュレポートと連携することを検討。

---

## 4. デバッグ時の手順（現状のまとめ）

1. **JS**
   - `npx expo run:ios` で Metro 起動 → ターミナルで `[Scanner]` / `[ScanScreen]` 等でフィルタ。
2. **Native**
   - Xcode で `ios/sutesho.xcworkspace` を開き、Run して Console で `[SuteSha]` をフィルタ（現状は Swift に print が無いため、上記「3.1」対応後に有効になる）。
3. **Native Module 未認識**
   - `npx expo prebuild --platform ios --clean` → `cd ios && pod install` → `npx expo run:ios`。

---

## 5. 優先して実施するとよい改善

1. **Swift の重要ポイントに print を追加**（中）  
   → スキャン・一時停止・クラスタ数など、Native の流れを追いやすくする。

2. **__DEV__ でデバッグ用 console.log をガード**（低）  
   → 本番ビルドで不要なログを減らし、情報露出を抑える。

3. **クラッシュ収集の検討**（将来）  
   → 本番安定後に Sentry 等を検討。

Error Boundary は導入済みのため、残りは Swift ログと本番ログの整理が有効です。
