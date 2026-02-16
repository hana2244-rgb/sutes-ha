# TestFlight まで出す手順（捨て写）

TestFlight にビルドを出すまでの流れです。

---

## 前提

- **Apple Developer Program** に加入済み（有料）
- **EAS CLI** でログイン済み（`npx eas login`）
- **App Store Connect** でアプリを1つ作成済み（後述）

---

## 1. App Store Connect でアプリを作る（初回だけ）

1. [App Store Connect](https://appstoreconnect.apple.com/) にログイン
2. **マイ App** → **+** → **新しい App**
3. 次のように入力して作成:
   - **プラットフォーム**: iOS
   - **名前**: 捨て写
   - **主言語**: 日本語
   - **バンドルID**: `com.Akifumi.H.trashsnap`（app.json の `ios.bundleIdentifier` と一致させる）
   - **SKU**: 例 `sutesho-001`
4. 作成後、**App 情報** を開き **Apple ID**（数字のみ）をメモ → これが **App Store Connect App ID（ascAppId）**

---

## 2. eas.json を自分の環境に合わせる

`eas.json` の **submit.production.ios** を編集します。

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "あなたのAppleIDメール@example.com",
      "ascAppId": "App Store Connect の Apple ID（数字）"
    }
  }
}
```

- **appleId**: App Store Connect にログインする Apple ID（メールアドレス）
- **ascAppId**: 上記でメモした「App の Apple ID」（数字のみの文字列）

---

## 2.5 TestFlight 提出前チェックリスト

提出前に以下を確認してください。

| 項目 | 確認 |
|------|------|
| **eas.json** | `submit.production.ios.appleId` と `ascAppId` を自分の値にしている（ascAppId は数字のみ） |
| **app.json** | `ios.bundleIdentifier` が App Store Connect のアプリのバンドルIDと一致（`com.Akifumi.H.trashsnap`） |
| **アイコン** | `assets/icon.png` が **1024×1024px** の PNG（透過なし推奨）。違う場合は差し替えてからビルド |
| **輸出コンプライアンス** | app.json に `ITSAppUsesNonExemptEncryption: false` あり（写真のみ・暗号化なしなら「いいえ」でOK） |
| **App Store Connect** | 提出後、TestFlight のビルド詳細で「輸出コンプライアンス」を答える（暗号化なしなら「いいえ」） |
| **プライバシーポリシー** | 写真ライブラリにアクセスするため、審査で求められることがある。必要なら Web に1ページ用意し、App Store Connect の「App のプライバシーに関する詳細」やアプリ情報の URL に設定 |

上記が問題なければ、そのままビルド・提出して大丈夫です。

---

## 3. 本番用ビルドを作る

```bash
npm run build:ios:production
```

または:

```bash
npx eas build --platform ios --profile production
```

- 初回は Apple の認証やプロビジョニングの質問が出るので、案内に従って入力
- ビルド完了まで 15〜30 分程度かかることがあります

---

## 4. TestFlight に提出する

### 方法 A: ビルド後に提出

```bash
npm run submit:ios
```

または:

```bash
npx eas submit --platform ios --profile production --latest
```

- **最新の production ビルド** が選ばれ、App Store Connect に送られます
- 初回は App Store Connect API キー作成を聞かれたら「Yes」で進める

### 方法 B: ビルドと提出を一度にやる

```bash
npm run build:ios:testflight
```

または:

```bash
npx eas build --platform ios --profile production --auto-submit
```

- ビルドが成功したら、そのまま TestFlight に提出されます

---

## 5. App Store Connect 側の作業

1. 提出後、App Store Connect の **TestFlight** タブを開く
2. ビルドが「処理中」→「テスト可能」になるまで数分〜数十分待つ
3. **テスト情報**（輸出コンプライアンスなど）が未入力なら入力する  
   - 暗号化: 「いいえ」で問題ない（app.json で `ITSAppUsesNonExemptEncryption: false` にしている想定）
4. **内部テスト** または **外部テスト** でテスターを追加し、TestFlight からインストールして動作確認

---

## チェックリスト（TestFlight 前）

- [ ] Apple Developer Program 加入済み
- [ ] App Store Connect でアプリ作成済み（バンドルID: `com.Akifumi.H.trashsnap`）
- [ ] eas.json の `appleId` / `ascAppId` を設定済み
- [ ] アイコン `assets/icon.png` が 1024×1024px の PNG
- [ ] `npx eas build --platform ios --profile production` が成功している

---

## よくあるトラブル

| 現象 | 対処 |
|------|------|
| ascAppId が無効 | App Store Connect でアプリの「Apple ID」を再度確認し、数字のみをコピー |
| ビルドが「処理中」のまま | 最大 1 時間ほど待つ。それ以上なら [EAS のステータス](https://expo.dev/accounts/[your-account]/projects/sutesho/builds) を確認 |
| 輸出コンプライアンスで止まる | TestFlight のビルド詳細で「暗号化」を「いいえ」に設定（本アプリは暗号化なしの想定） |

---

## 参考

- [EAS Build - iOS 本番ビルド](https://docs.expo.dev/build-reference/ios-builds/)
- [EAS Submit - iOS](https://docs.expo.dev/submit/ios/)
- [TestFlight の使い方（Apple）](https://developer.apple.com/testflight/)
