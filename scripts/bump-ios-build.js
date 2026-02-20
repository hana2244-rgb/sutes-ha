#!/usr/bin/env node
// ============================================================
// iOS ビルド番号を 1 増やす or 指定値にセット（Codemagic / ローカル両用）
// ============================================================
// 使い方:
//   npm run bump:ios                    … 1 増やす（例: 18 → 19）
//   node scripts/bump-ios-build.js      … 同上
//   node scripts/bump-ios-build.js 25   … 指定値にセット（Codemagic 用）

const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
const data = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

const current = data.expo?.ios?.buildNumber;
if (current == null) {
  console.error('app.json に expo.ios.buildNumber が見つかりません');
  process.exit(1);
}

const arg = process.argv[2];
const next = arg != null && String(Number(arg)) === String(arg)
  ? String(Number(arg))
  : String(parseInt(current, 10) + 1);

data.expo.ios.buildNumber = next;

fs.writeFileSync(appJsonPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`iOS buildNumber: ${current} → ${next}`);
