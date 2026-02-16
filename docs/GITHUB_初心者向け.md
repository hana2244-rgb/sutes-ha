# GitHub を全然知らない人向けガイド（捨て写でやることだけ）

「GitHub 全然わかんない」という前提で、**捨て写の iOS をビルドするために必要なことだけ**書きます。

---

## GitHub って何？

- **コードを置いておく場所**（クラウドのフォルダみたいなもの）
- このプロジェクトを GitHub に置くと、**GitHub の Mac で prebuild を代わりに実行**してもらえます（あなたは Windows のままでOK）

---

## やることの流れ（3ステップ）

1. **GitHub にアカウントを作る**（まだなら）
2. **このプロジェクトを GitHub に「上げる」**
3. **サイト上で「Prebuild iOS」を1回だけ実行する**

---

## ステップ1: GitHub アカウントを作る（持ってなければ）

1. ブラウザで **https://github.com** を開く
2. 右上の **Sign up** をクリック
3. メール・パスワード・ユーザー名を入れてアカウント作成
4. メールの認証が出たら、案内に従う

---

## ステップ2: このプロジェクトを GitHub に上げる

「上げる」方法は **A（簡単）** と **B（コマンド）** のどちらかです。

### 方法A: GitHub のサイトでリポジトリを作ってから、フォルダをアップロード（いちばん簡単）

1. **GitHub にログイン**した状態で https://github.com を開く
2. 右上の **＋** → **New repository** をクリック
3. 次のように入力する：
   - **Repository name**: `sutesho`（好きな名前でOK）
   - **Public** を選ぶ
   - **Add a README file** は**チェックしない**（空のリポジトリにする）
   - **Create repository** をクリック
4. 次の画面で **「uploading an existing file」** というリンクをクリック（または「upload files」）
5. **C:\ws\sutesho** のフォルダの中身を**全部選んで**ドラッグ＆ドロップ  
   - **node_modules** は入れない（時間がかかるので）
   - **.github** フォルダは必ず入れる（中に `workflows/prebuild-ios.yml` がある）。隠しフォルダなので、エクスプローラーで「表示」→「隠しファイル」にチェックを入れてから選ぶ
6. 下の **Commit changes** をクリック

**注意**: `node_modules` を入れない場合、GitHub 上には「package.json など」だけになります。その状態でも **Actions の Prebuild iOS は動きます**（Actions 側で `npm ci` が実行され、依存関係が入ります）。

**node_modules を入れずに上げた場合**  
→ そのままステップ3へ。

**node_modules も含めて上げたい場合**  
→ 方法B（Git コマンド）か、GitHub Desktop を使う必要があります。

---

### 方法B: Git をインストールして「push」する（全部まとめて上げる）

1. **Git をインストール**  
   - https://git-scm.com/download/win からダウンロードしてインストール
2. **PowerShell または コマンドプロンプト**を開く
3. 次のコマンドを**順番に**打つ（`C:\ws\sutesho` にいる前提）：

```powershell
cd C:\ws\sutesho
git init
git add .
git commit -m "first"
```

4. GitHub で **New repository** を作る（名前は `sutesho` など、README は追加しない）
5. 作ったページに **「…or push an existing repository from the command line」** と出ているので、その2行をコピーして PowerShell で実行する（例）：

```powershell
git remote add origin https://github.com/あなたのユーザー名/sutesho.git
git branch -M main
git push -u origin main
```

6. ログインを求められたら、GitHub のユーザー名とパスワード（または Personal Access Token）を入れる

これでプロジェクト全体が GitHub に上がります。

---

## ステップ3: Prebuild iOS を1回だけ実行する

1. ブラウザで **あなたのリポジトリのページ**を開く  
   （例: `https://github.com/あなたのユーザー名/sutesho`）
2. 上のタブで **「Actions」** をクリック
3. 左の一覧から **「Prebuild iOS」** をクリック
4. 右側の **「Run workflow」** というドロップダウンをクリック
5. その中の **「Run workflow」** ボタン（緑）をクリック
6. しばらく待つ（2〜5分くらい）
7. 一覧に **黄色い丸 → 緑のチェック** になれば成功
8. 成功すると、**自動で ios フォルダがコミットされて push されます**

これで「GitHub の Mac で prebuild が1回実行された」状態になります。Expo のクレジットは使いません。

---

## よくあること

- **「Actions に Prebuild iOS が出てこない」**  
  → ステップ2で、`.github/workflows/prebuild-ios.yml` が GitHub に上がっているか確認。方法Aで上げた場合は、`.github` フォルダごとアップロードする必要があります。
- **「Run workflow がグレーで押せない」**  
  → ブランチを選ぶドロップダウンで **main**（またはデフォルトブランチ）を選んでから「Run workflow」を押す。
- **「失敗（赤い×）になった」**  
  → その実行をクリック → 中の「prebuild」などのステップを開くとログが出ます。ログの最後のエラーをコピーして、誰かに見てもらうと原因が分かりやすいです。

---

## このあと（Xcode Cloud でビルドする場合）

- GitHub に **ios/** が入ったら、**App Store Connect** で Xcode Cloud を有効化
- リポジトリを Xcode Cloud に接続して、**ios/sutesho.xcworkspace** を指定してビルド

くわしくは **XCODE_CLOUD.md** を見てください。

---

## まとめ

- GitHub = コードを置く場所。捨て写を置くと、GitHub の Mac で prebuild を実行してもらえる。
- やること: (1) アカウント作成 (2) プロジェクトを GitHub に上げる (3) Actions で「Prebuild iOS」を Run workflow で1回実行。
- これだけやれば、Windows のままでも ios フォルダが用意され、Xcode Cloud でビルドできるようになります。
