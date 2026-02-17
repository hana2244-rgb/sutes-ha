# 捨て写 - 公開前チェックリスト

リリース前に以下を確認・実施してください。

## 必須

### 1. AdMob 本番 App ID への差し替え

- **現状**: `app.json` の `react-native-google-mobile-ads` プラグインで **テスト用 App ID** が設定されています。
- **対応**: [AdMob コンソール](https://admob.google.com/) でアプリを登録し、発行される **本番の iOS / Android App ID**（`ca-app-pub-XXXX~YYYY` 形式）を取得し、`app.json` の `plugins` 内で差し替えてください。

```json
["react-native-google-mobile-ads", {
  "iosAppId": "ca-app-pub-XXXXXXXX~YYYYYYYYYY",
  "androidAppId": "ca-app-pub-XXXXXXXX~ZZZZZZZZZZ"
}]
```

- 広告ユニットID（バナー・リワード）は `src/ads/adConfig.ts` で本番用に設定済みです。App ID のみ `app.json` で本番に差し替えればOKです。

### 2. アプリアイコン・スプラッシュ

- **アイコン**: `app.json` の `icon` は `./assets/icon.png` を参照しています。1024x1024 のアイコンを配置してください。
- **スプラッシュ**: 現在は `backgroundColor` のみ設定。必要に応じて `splash.image` を追加してください。

### 3. ビルド番号・バージョン

- `app.json` の `expo.ios.buildNumber` と `expo.version` をストア提出用に更新してください。

---

## 推奨（実施済み・確認のみ）

- **オンボーディング永続化**: `hasSeenOnboarding` を AsyncStorage（`ONBOARDING_SEEN_KEY`）で永続化済み。
- **本番ログ**: `console.log` / `console.warn` は `__DEV__` でガード済み。本番ビルドでは出力されません。
- **未使用依存**: `expo-linear-gradient` は未使用のため削除済み。

---

## 提出前の最終確認

- [ ] AdMob 本番 App ID を `app.json` に設定した
- [ ] `assets/icon.png` を配置した（1024x1024 推奨）
- [ ] `npx expo prebuild --platform ios --clean` → `npx expo run:ios` で動作確認した
- [ ] 実機で広告表示・リワード広告・削除フローを確認した
- [ ] App Store Connect の App Privacy で「収集データなし・トラッキングなし」を設定した
