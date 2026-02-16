#!/bin/bash
set -e
echo "[Xcode Cloud] ci_post_clone.sh - 開始"

# リポジトリルートに移動（Xcode Cloud の環境変数）
REPO_ROOT="${CI_WORKSPACE:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$REPO_ROOT"
echo "[Xcode Cloud] 作業ディレクトリ: $(pwd)"

# Node と CocoaPods をインストール（Xcode Cloud イメージに含まれない場合に備える）
brew install node cocoapods

# Node 依存関係
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

# iOS: Pod インストール（ios/ は prebuild で生成済みであること）
if [ ! -d ios ]; then
  echo "[Xcode Cloud] エラー: ios/ が見つかりません。先にローカルで 'npx expo prebuild --platform ios' を実行し、ios/ をコミットしてください。"
  exit 1
fi
cd ios
pod install
cd ..

echo "[Xcode Cloud] ci_post_clone.sh - 完了"
