# Codemagic でビルドする（捨て写）

Codemagic はクラウドで iOS/Android をビルドできる CI/CD サービスです。無料枠があります。  
このプロジェクト用の `codemagic.yaml` をリポジトリルートに置いてあります。

---

## 前提

- **GitHub にこのリポジトリ**（`ios/` 含む）が push 済みであること  
  （まだなら GitHub Actions の「Prebuild iOS」で ios/ を生成してから push）
- **Apple Developer アカウント**（有料）で App Store Connect API キーを発行できること

---

## 1. Codemagic にアプリを追加

1. **https://codemagic.io** にアクセスしてサインアップ（GitHub でログイン可）
2. **「Add application」** をクリック
3. **GitHub** を選び、**このリポジトリ**（例: `hana2244-rgb/sutes-ha`）を接続
4. ブランチを選び、**「Check for configuration file」** で `codemagic.yaml` を検出させる
5. 表示された **「iOS Release」** ワークフローを選択してビルド開始できる状態に

---

## 2. コード署名の設定（必須）

Codemagic の **Team 設定**で、iOS 用の署名を用意します。

### App Store Connect API キー

1. **App Store Connect** → **ユーザとアクセス** → **統合** → **App Store Connect API** で **「+」** からキーを生成
2. キーを **1回だけダウンロード**（.p8 ファイル）。**Key ID** と **Issuer ID** をメモ
3. **Codemagic** → **Team settings**（左上）→ **Integrations** → **Developer Portal** → **Manage keys**
4. **「Add key」** で .p8 をアップロードし、**Key ID**・**Issuer ID** を入力。**API key name** を付ける（例: `Codemagic_App_Store_Connect`）
5. `codemagic.yaml` の `integrations.app_store_connect` の値を、この **API key name** に合わせる

### 証明書とプロビジョニングプロファイル

1. **Codemagic** → **Team settings** → **codemagic.yaml** → **Code signing identities**
2. **iOS certificates** で **Distribution** 証明書を追加（Codemagic が API キーで生成するか、手動アップロード）
3. **iOS provisioning profiles** で **App Store** 用プロファイルを追加（Bundle ID: `com.Akifumi.H.trashsnap` に一致するもの）

`codemagic.yaml` の `ios_signing.bundle_identifier: com.Akifumi.H.trashsnap` と一致していると、Codemagic が自動で証明書・プロファイルを選びます。

---

## 3. ビルドの実行

1. Codemagic の **Applications** でこのアプリを開く
2. **「Start new build」** をクリック
3. ワークフロー **「iOS Release」** を選び、**「Start build」** で実行

成功すると **IPA** がアーティファクトとしてダウンロードでき、`submit_to_testflight: true` のため **TestFlight** に自動でアップロードされます。

---

## 4. ビルド番号を 1 増やす（ローカル）

リリース前に `app.json` の iOS ビルド番号を 1 増やしたいとき:

```bash
npm run bump:ios
```

- `expo.ios.buildNumber` が 1 増える（例: 18 → 19）
- コミットして push したうえで Codemagic を実行すると、その番号が prebuild に反映される  
  （Codemagic 側では「TestFlight 最新+1」を自動でセットするので、通常はローカルで bump しなくてもよい）

---

## 5. トラブルシューティング

| 現象 | 対処 |
|------|------|
| `ios/` がない | GitHub Actions の「Prebuild iOS」を実行し、生成された ios/ を push する |
| 署名エラー | Code signing identities に Distribution 証明書と App Store 用プロファイルが Bundle ID 一致で登録されているか確認 |
| スキームが見つからない | `codemagic.yaml` の `XCODE_SCHEME` を、Xcode のスキーム名（多くは `sutesho`）に合わせる |
| TestFlight に上げたくない | `publishing.app_store_connect.submit_to_testflight: false` にすると IPA のみビルド |

---

## 参考

- [Codemagic - React Native apps](https://docs.codemagic.io/yaml-quick-start/building-a-react-native-app)
- [Codemagic - App Store Connect publishing](https://docs.codemagic.io/yaml-publishing/app-store-connect)
