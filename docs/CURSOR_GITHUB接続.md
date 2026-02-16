# Cursor と GitHub を接続する方法

Cursor で編集しているフォルダ（今のプロジェクト）を GitHub のリポジトリとつなげて、**push / pull** できるようにする手順です。

---

## 前提

- **Git** が入っていること（Cursor に同梱されている場合あり）
- **GitHub アカウント** があること
- GitHub に **リポジトリがすでにある** 場合（例: `hana2244-rgb/sutes-ha`）と、**これから作る** 場合の両方に対応

---

## 方法1: すでに GitHub にリポジトリがある場合（今のプロジェクトをそこに送る）

### 1. Cursor でフォルダを開いた状態で、ターミナルを開く

- **Ctrl + `**（バッククォート）または メニュー **Terminal** → **New Terminal**

### 2. 今のフォルダが Git 管理されているか確認

```powershell
git status
```

- **「fatal: not a git repository」** と出る → まだ Git が初期化されていない（次のステップへ）
- **ブランチ名などが出る** → すでに Git は初期化済み（ステップ 4 へ）

### 3. Git を初期化して最初のコミットを作る（まだの場合）

```powershell
git init
git add .
git commit -m "Initial commit"
```

### 4. GitHub のリポジトリを「リモート」として追加する

GitHub のリポジトリ URL を使います。例: `https://github.com/hana2244-rgb/sutes-ha.git`

```powershell
git remote add origin https://github.com/hana2244-rgb/sutes-ha.git
```

※ 自分のリポジトリの URL に置き換えてください。GitHub のリポジトリページで **「Code」** → 緑の **「Code」** ボタン → **HTTPS** の URL をコピーできます。

### 5. ブランチ名を main にして push する

```powershell
git branch -M main
git push -u origin main
```

- **ログインを求められたら**  
  - ユーザー名: GitHub のユーザー名  
  - パスワード: **Personal Access Token（PAT）** を入れる（通常のパスワードは使えない場合が多い）

---

## 方法2: GitHub にリポジトリをこれから作る場合

### 1. GitHub で新しいリポジトリを作成

1. **https://github.com/new** を開く
2. **Repository name**: 例 `sutesho`
3. **Public** を選択
4. **「Add a README file」** は**チェックしない**（ローカルに既にファイルがあるため）
5. **Create repository** をクリック

### 2. 表示された「…or push an existing repository from the command line」のコマンドを使う

作成直後のページに、次のような 3 行が出ます。

```powershell
git remote add origin https://github.com/あなたのユーザー名/sutesho.git
git branch -M main
git push -u origin main
```

### 3. Cursor のターミナルで実行

**まず Git 初期化と初回コミット（まだの場合）:**

```powershell
cd C:\ws\sutesho
git init
git add .
git commit -m "Initial commit"
```

**そのあと、上でコピーした 3 行を順に実行:**

```powershell
git remote add origin https://github.com/あなたのユーザー名/sutesho.git
git branch -M main
git push -u origin main
```

---

## 接続後の使い方（Cursor から GitHub へ送る）

1. **ファイルを編集**（いつも通り）
2. **ソース管理ビューを開く**  
   - 左サイドバーの **分岐マーク（Git アイコン）** をクリック  
   - または **Ctrl + Shift + G**
3. **変更をステージ**  
   - 「変更」の横の **+** をクリック（全部ステージ）またはファイルごとに **+**
4. **コミット**  
   - 上欄にメッセージ（例: `〇〇を修正`）を入力 → **✓ Commit** をクリック
5. **Push**  
   - メニュー **⋯**（三点）→ **Push**  
   - またはターミナルで `git push`

---

## GitHub のパスワード（Personal Access Token）を作る

push するときに「パスワード」を求められたら、**GitHub のログイン用パスワードではなく、Personal Access Token（PAT）** を使います。

1. **https://github.com/settings/tokens** を開く
2. **「Generate new token」** → **「Generate new token (classic)」**
3. **Note**: 例 `Cursor`
4. **Expiration**: 90 days または No expiration
5. **Select scopes**: **repo** にチェック
6. **Generate token** をクリック
7. 表示された **トークン** をコピー（一度しか表示されないので保管）
8. push 時に「パスワード」を聞かれたら、このトークンを貼り付ける

---

## まとめ

| やりたいこと           | やること |
|------------------------|----------|
| 既存の GitHub リポジトリに接続 | `git remote add origin <URL>` → `git push -u origin main` |
| 新規リポジトリを作って接続     | GitHub でリポジトリ作成 → 表示された 3 行を実行 |
| 今後、変更を GitHub に送る   | 左の Git アイコン → ステージ → コミット → Push |

**接続は一度できれば、あとは「コミット → Push」の繰り返しで、Cursor で編集した内容が GitHub に反映されます。**
