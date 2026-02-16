# Xcode Cloud でビルドする（EAS クレジット不要）

Expo の EAS Build の代わりに、Apple の **Xcode Cloud** で iOS ビルド・TestFlight 配信を行う手順です。Apple Developer プログラムに含まれる月 25〜50 時間のクラウドビルドを利用できます。

---

## 前提

- Apple Developer アカウント（有料）
- 本リポジトリを **GitHub** などにプッシュし、Xcode Cloud から参照できること
- **Mac** で一度だけ `expo prebuild` を実行し、`ios/` をコミットする必要があります

---

## 1. ios/ を用意する（Windows の場合は GitHub Actions を使う）

Xcode Cloud は「リポジトリに含まれる Xcode プロジェクト」をビルドするため、**生成済みの ios/ をリポジトリに含める**必要があります。

**iOS の prebuild は macOS でしか動きません。** Windows の場合は **GitHub Actions** で生成できます。

### 方法 A: Windows の場合（推奨）— GitHub Actions で prebuild

1. このリポジトリを **GitHub** に push する（`.github/workflows/prebuild-ios.yml` と `app.json` の変更を含める）。
2. GitHub の **Actions** タブを開く → **「Prebuild iOS」** ワークフローを選ぶ → **「Run workflow」** で実行。
3. 完了すると、macOS ランナーで `npx expo prebuild --platform ios` が実行され、生成された **ios/** が自動でコミット・push されます（Expo のクレジットは使いません）。
4. 以降は Xcode Cloud でビルド可能です。

### 方法 B: Mac がある場合 — ローカルで prebuild

```bash
# プロジェクトルートで
npm install
npx expo prebuild --platform ios
```

- `ios/` が生成されます（`sutesho.xcworkspace` や `Podfile` など）。
- **`ios/` を .gitignore に入れていない**ことを確認してください。

```bash
git add ios
git add ci_scripts
git update-index --chmod=+x ci_scripts/ci_post_clone.sh
git commit -m "chore: add ios (prebuild) and ci_scripts for Xcode Cloud"
git push
```

---

## 2. App Store Connect で Xcode Cloud を有効化

1. [App Store Connect](https://appstoreconnect.apple.com/) にログイン
2. **マイ App** → 該当アプリ（捨て写）を選択
3. **TestFlight** タブ → **Xcode Cloud** セクションで「Xcode Cloud をセットアップ」または「ワークフローを追加」
4. 表示される手順に従い、**Git リポジトリ（GitHub など）を接続**
5. リポジトリ接続後、**Xcode プロジェクトの選択**で `ios/sutesho.xcworkspace` を選ぶ（`.xcworkspace` を選ぶこと）
6. スキーム・署名などは Xcode Cloud の案内に従って設定

---

## 3. ワークフローとビルド

- **トリガー**: ブランチへのプッシュなど、設定した条件でクラウドビルドが開始されます。
- **post-clone スクリプト**: リポジトリルートの `ci_scripts/ci_post_clone.sh` が自動で実行され、`npm ci` と `pod install` が行われます。
- ビルド成功後、**TestFlight に自動でアップロード**するようにも設定できます（Xcode Cloud の「アーカイブ後」アクションで配信を追加）。

---

## 4. トラブルシューティング

| 現象 | 対処 |
|------|------|
| `ios/` が見つからない | ローカルで `npx expo prebuild --platform ios` を実行し、`ios/` をコミットしてください。 |
| `pod install` で失敗 | ログでエラーを確認。`ios/Podfile` が prebuild で正しく生成されているか確認。 |
| ビルドフェーズで「GetEnv.NoBoolean: TRUE is not a boolean」 | 依存の `getenv` が古い場合に発生。本プロジェクトでは getenv 2.x のため通常は不要ですが、発生する場合は `patch-package` で `getenv` をパッチする方法があります。 |
| 署名エラー | Xcode Cloud 用の証明書・プロビジョニングは App Store Connect / Xcode Cloud の「署名」設定で行います。 |

---

## 5. 参考

- [Apple - Xcode Cloud でカスタムスクリプトを実行](https://developer.apple.com/documentation/xcode/writing-custom-build-scripts)
- [Compiling Expo Prebuild apps in XCode Cloud (richinfante.com)](https://www.richinfante.com/2024/11/18/running-expo-prebuild-in-xcode-cloud)
