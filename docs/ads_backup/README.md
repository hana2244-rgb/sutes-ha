# 広告コードバックアップ（AdMob 無効時用）

リリース用に AdMob を外した際のバックアップです。  
再実装時は以下を復元してください。

- `RewardedAdContext.tsx` → `src/ads/RewardedAdContext.tsx`
- `AdMobBanner.tsx` → `src/ads/AdMobBanner.tsx`
- `adConfig.ts` → `src/ads/adConfig.ts`

復元後は以下も必要です。

1. `package.json` に `"react-native-google-mobile-ads": "^16.0.3"` を追加
2. `app.json` の `plugins` に AdMob プラグインを追加
3. `App.tsx` で SDK 初期化・AdsSdkReadyContext・RewardedAdProvider・AdMobBanner を復元
4. `npm install` → `npx expo prebuild --platform ios --clean`
