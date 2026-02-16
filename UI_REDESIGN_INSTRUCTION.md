# 捨て写 UI リデザイン指示書（Claude Code 用）

> **このドキュメントについて**: 捨て写アプリのUI全面刷新をClaude Codeで実施するための指示書。現在のダークテーマを廃止し、BAKE CHEESE TART（cheesetart.com）の色使い・空気感 ＋「ガラスバブルビーズ」の質感を融合した、柔らかく透明感のあるライトテーマUIに作り変える。

---

## 0. 前提：変更しないもの

以下は今回のリデザイン対象**外**。ロジック・構造は一切触らないこと。

- `ios/Modules/` 以下（Swift Native Module）
- `src/native/PhotoSimilarityScanner.ts`（JS↔Nativeブリッジ）
- `src/hooks/usePhotoScanner.ts`（フック内部ロジック）
- `src/store/index.ts`（Zustand ストアの構造・アクション）
- `src/types/index.ts`（型定義）
- `App.tsx`（構成変更不要。StatusBar style を `"dark"` に変える程度はOK）

**変更対象ファイル:**

```
src/theme/index.ts          ← 全面書き換え
src/components/*.tsx         ← 全コンポーネントのスタイル書き換え
src/screens/*.tsx            ← 全画面のスタイル書き換え
src/navigation/AppNavigator.tsx ← navTheme のカラー変更
App.tsx                      ← StatusBar style, root backgroundColor
```

---

## 1. デザインコンセプト

### コンセプト名: 「ソーダグラス」

BAKE CHEESE TART の淡いラベンダーブルーの世界観に、ガラスビーズのような透明感・光沢・ぷるっとした丸みを加えた、**パステル×ガラスモーフィズム**のハイブリッド。

**キーワード**: 透明感、泡、やわらかい光、パステルブルー、ガラス玉、浮遊感、清潔感

### 1.1 参考: BAKE CHEESE TART から取り入れる要素

| 要素 | 取り入れるポイント |
|------|-------------------|
| **ベースカラー** | 淡いラベンダーブルーの全面背景。白ではなく「色のついた白」 |
| **テキスト階層** | 大見出しは白抜き or 濃色、本文は中間グレー。コントラスト控えめで上品 |
| **余白** | たっぷりの余白。密度を下げて呼吸させる |
| **丸み** | カード・画像フレームが有機的な丸形。角丸ではなく「まんまる」に近い形 |
| **ボタン** | 白背景のピル型。細い枠線、ミニマルなアイコン |
| **全体トーン** | 洗練されたスイーツブランド的な空気。重さゼロ |

### 1.2 「ガラスバブルビーズ」で加える要素

| 要素 | 実装方法 |
|------|---------|
| **ガラスの光沢** | ボタン・バッジに内側グラデーション（上部に白いハイライト帯） |
| **半透明レイヤー** | カード背景を `rgba(255,255,255,0.55)` 程度の半透明白 + `backdropFilter` 相当の効果（RNではborderとshadowで再現） |
| **バブル感** | ボタンの borderRadius を限界まで丸くする（pill型 or 正円）。影を柔らかく、浮いてるように |
| **内側のツヤ** | `borderTopColor` をわずかに明るくして上辺にハイライト線を入れる |
| **虹色の微光** | アクセント部分にほんのり暖色（ピーチ、ラベンダーピンク）を差す |
| **ぷるっとした弾力** | タップ時のアニメーションを `withSpring` でバウンシーに（damping低め） |

---

## 2. カラーパレット（theme 書き換え）

### `src/theme/index.ts` を以下のパレットで全面書き換え

```
■ ベース（背景系）
bg:              '#DFE6F6'    ← 全画面の背景。BAKE風ラベンダーブルー
bgSoft:          '#E8EDF9'    ← 少し明るいバリエーション
bgCard:          'rgba(255, 255, 255, 0.55)'  ← ガラスカード（半透明白）
bgCardSolid:     '#FFFFFF'    ← 不透明カードが必要な場合
bgOverlay:       'rgba(180, 190, 220, 0.4)'   ← オーバーレイ

■ テキスト
textPrimary:     '#2D3047'    ← 濃紺（黒ではない）
textSecondary:   '#7A809B'    ← グレイッシュブルー
textTertiary:    '#A8ADCA'    ← 薄いラベンダーグレー
textOnAccent:    '#FFFFFF'    ← アクセントボタン上の白文字
textOnGlass:     '#4A5073'    ← ガラスカード上のテキスト

■ アクセント（メインアクション）
accent:          '#7EB5F5'    ← 明るいスカイブルー（ガラスビーズの青）
accentDeep:      '#5A9AE6'    ← 押下時・強調用
accentSoft:      'rgba(126, 181, 245, 0.18)' ← アクセント背景

■ セカンダリ（情報・バッジ）
secondary:       '#B8A9D4'    ← ラベンダー
secondarySoft:   'rgba(184, 169, 212, 0.15)'

■ 成功（「残す」選択）
success:         '#8CC5A2'    ← ミントグリーン
successSoft:     'rgba(140, 197, 162, 0.2)'

■ 危険（削除）
danger:          '#F2918A'    ← コーラルピンク（赤すぎない）
dangerSoft:      'rgba(242, 145, 138, 0.15)'

■ 警告
warning:         '#F2CC6B'    ← やわらかいゴールド
warningSoft:     'rgba(242, 204, 107, 0.15)'

■ ガラス効果用
glassBorder:     'rgba(255, 255, 255, 0.6)'   ← カード外枠
glassHighlight:  'rgba(255, 255, 255, 0.8)'   ← 上辺ハイライト
glassInnerShadow:'rgba(100, 120, 180, 0.08)'  ← 内側の淡い影
bubbleShine:     'rgba(255, 255, 255, 0.9)'   ← ビーズのテカリ

■ ボーダー
border:          'rgba(180, 190, 220, 0.3)'
borderLight:     'rgba(255, 255, 255, 0.5)'
```

### shadow 定義（浮遊するガラス感）

```typescript
shadow: {
  glass: {
    shadowColor: '#8090C0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  glassSm: {
    shadowColor: '#8090C0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  bubble: {
    shadowColor: '#7EB5F5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 6,
  },
  soft: {
    shadowColor: '#A0AAD0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 3,
  },
}
```

---

## 3. コンポーネント別リデザイン仕様

### 3.1 ActionButton（ガラスバブルビーズボタン）

**これが最重要コンポーネント。「ガラスビーズ」を最も体現するパーツ。**

```
[primary ボタン]
┌─────────────────────────────────┐  ← borderRadius: 999（完全ピル型）
│  ░░░ 上部にハイライト帯 ░░░░░░  │  ← borderTopWidth: 1.5, borderTopColor: glassHighlight
│                                 │
│      🔍  スキャン開始            │  ← テキスト白、フォントweight 700
│                                 │
└─────────────────────────────────┘
  背景: accent (#7EB5F5)
  shadow: bubble（ふわっと浮く青い影）
  タップ時: withSpring scale 0.95 → 1.0（damping: 12, stiffness: 200）

[secondary ボタン]
  背景: rgba(255,255,255,0.6)  ← 半透明白ガラス
  borderWidth: 1
  borderColor: glassBorder
  borderTopColor: glassHighlight（上辺だけ明るい）
  テキスト色: accentDeep
  shadow: glassSm

[ghost ボタン]
  背景: transparent
  テキスト色: textSecondary
  タップ時のみ背景が bgCard に
```

### 3.2 カード（PhotoGroupCard / 各種カード）

```
ガラスカードスタイル:
  backgroundColor: rgba(255, 255, 255, 0.55)
  borderRadius: 24（大きめ丸角）
  borderWidth: 1
  borderColor: glassBorder  rgba(255,255,255,0.6)
  borderTopWidth: 1.5
  borderTopColor: glassHighlight  ← 上辺のガラスハイライト
  shadow: glass

  ※ bgCard の半透明白が、背景の #DFE6F6 と合わさって
    うっすらブルーがかった白ガラスに見える。これが狙い。
```

**PhotoGroupCard 固有:**
- サムネイルの角丸を `12` → `16` に拡大
- 「残す」選択の枠色を `success` (#8CC5A2) のミントグリーンに
- 削除マスクの背景を `rgba(223, 230, 246, 0.6)` に（暗くせず青みの膜）
- ✕ マークの色を `danger` (#F2918A) に
- 「N枚を削除」ボタンを `danger` 色のピル型バブルボタンに
- サイズバッジの背景を `secondarySoft`、テキストを `secondary`

### 3.3 ProgressBar

```
トラック:
  backgroundColor: rgba(255, 255, 255, 0.4)  ← ガラストラック
  borderRadius: 999（完全丸）
  height: 10
  borderWidth: 1
  borderColor: rgba(255,255,255,0.5)

バー（fill）:
  backgroundColor: accent (#7EB5F5)
  borderRadius: 999
  ＋ 上半分に rgba(255,255,255,0.4) のハイライト帯
    → これでガラス棒のように見える

パーセント表示:
  color: accentDeep
  Menloフォント維持

枚数テキスト:
  color: textSecondary
```

### 3.4 SimilaritySlider（3段階切替）

```
トラック背景:
  ガラスカードと同じ（半透明白、glassBorder）

アクティブインジケーター:
  backgroundColor: rgba(126, 181, 245, 0.2)  ← accentSoft
  borderWidth: 1
  borderColor: rgba(126, 181, 245, 0.4)
  borderRadius: 16

各アイテムラベル:
  非アクティブ: textTertiary
  アクティブ: accentDeep, fontWeight 700

説明テキスト:
  color: textTertiary
```

### 3.5 Toast

```
背景: rgba(255, 255, 255, 0.85)  ← すりガラス白
borderRadius: 20
borderWidth: 1
borderColor: glassBorder
shadow: glass

テキスト: textPrimary
サブテキスト: textSecondary

アニメーション:
  上からスライドイン（現状維持）
  back easing でバウンス感を強調
```

### 3.6 ThermalBanner

```
serious:
  backgroundColor: rgba(242, 204, 107, 0.15)
  borderColor: rgba(242, 204, 107, 0.3)

critical:
  backgroundColor: rgba(242, 145, 138, 0.15)
  borderColor: rgba(242, 145, 138, 0.3)

テキスト: textPrimary / textSecondary（現状と同じ構成でカラーのみ変更）
borderRadius: 16
```

---

## 4. 画面別リデザイン仕様

### 4.1 OnboardingScreen

```
背景: bg (#DFE6F6) のべた塗り

装飾の円:
  現在の accentSoft 円 → rgba(126, 181, 245, 0.12) に
  secondarySoft 円 → rgba(184, 169, 212, 0.1) に
  ★ もう1個追加: rgba(242, 145, 138, 0.08) のピンクの円（右下あたり）
  → パステルのシャボン玉が浮いてるイメージ

タイトル「捨て写」:
  color: textPrimary (#2D3047)
  fontSize: 40, fontWeight 900 は維持

サブタイトル:
  color: textSecondary

Feature アイテム:
  各アイテムをガラスカード化
  backgroundColor: rgba(255,255,255,0.45)
  borderRadius: 20
  padding: 16
  borderWidth: 1, borderColor: glassBorder
  shadow: glassSm

「はじめる」ボタン:
  primary バブルボタン（3.1 の仕様通り）
  フル幅、高さ 56、borderRadius: 999
```

### 4.2 ScanScreen

```
背景: bg (#DFE6F6)

タイトル「捨て写」:
  color: textPrimary

枚数バッジ:
  secondarySoft 背景のガラスバッジ
  borderRadius: 999, borderWidth: 1, borderColor: rgba(184,169,212,0.3)
  テキスト: secondary

[idle] 未スキャンカード:
  ガラスカード（3.2仕様）
  中央の絵文字: 維持
  「スキャン開始」: primary バブルボタン

[scanning] スキャン中:
  ProgressBar（3.3仕様）
  「今日はここまででOK 👌」: ghost ボタン。color: textSecondary

[paused] 一時停止中:
  ガラスカード
  「▶ 続きから再開」: secondary バブルボタン

[completed, 0件]:
  ガラスカード
  「✨ きれい！」のテキスト色: success (#8CC5A2)

グループヘッダー「Nグループ」:
  textPrimary
  選択中テキスト: accentDeep
```

---

## 5. ナビゲーション・StatusBar

### `App.tsx`

```typescript
<StatusBar style="dark" />  // ← "light" から変更

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#DFE6F6',  // ← '#0A0A0A' から変更
  },
});
```

### `AppNavigator.tsx` の navTheme

```typescript
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#DFE6F6',
    card: '#FFFFFF',
    text: '#2D3047',
    border: 'rgba(180, 190, 220, 0.3)',
    primary: '#7EB5F5',
  },
};
```

---

## 6. ガラスバブル共通スタイルの定義

`src/theme/index.ts` にヘルパーとして以下を追加：

```typescript
export const glassCard = {
  backgroundColor: 'rgba(255, 255, 255, 0.55)',
  borderRadius: 24,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.6)',
  borderTopWidth: 1.5,
  borderTopColor: 'rgba(255, 255, 255, 0.8)',
  ...shadow.glass,
} as const;

export const glassPill = {
  borderRadius: 999,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.6)',
  borderTopWidth: 1.5,
  borderTopColor: 'rgba(255, 255, 255, 0.8)',
} as const;

export const bubbleButton = {
  ...glassPill,
  shadowColor: '#7EB5F5',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.2,
  shadowRadius: 20,
  elevation: 6,
} as const;
```

---

## 7. アニメーション調整

### タップフィードバック（全ボタン共通）

```typescript
// 現在: 特にスケールアニメーションなし
// 変更: ガラスビーズがぷるっと弾む感じ

const scale = useSharedValue(1);

const onPressIn = () => {
  scale.value = withSpring(0.94, {
    damping: 12,
    stiffness: 200,
  });
};

const onPressOut = () => {
  scale.value = withSpring(1, {
    damping: 8,     // ← 低めでバウンス
    stiffness: 250,
  });
};
```

### カード出現アニメーション

```typescript
// 現在: FadeInDown + springify
// 変更: スケールも加えて「ぽんっ」と膨らむ感じに

entering={FadeInDown.delay(index * 100).duration(500).springify().damping(14)}
```

### Toast 出現

```typescript
// バウンシーさを強調
scale.value = withSpring(1, {
  damping: 10,
  stiffness: 180,
});
```

---

## 8. タイポグラフィ微調整

フォント自体は変更不要（iOSシステムフォント）。以下の値を調整：

```
title:      fontSize 34 → 32, letterSpacing -0.5 → -0.8（少し詰める）
heading:    変更なし
subheading: 変更なし
body:       変更なし
caption:    fontWeight '500' → '600'（ガラス背景上で読みやすく）
tiny:       fontWeight '500' → '600'
mono:       fontFamily 'Menlo' 維持。color は accentDeep に
```

---

## 9. 実装手順（推奨順序）

Claude Code は以下の順で作業すること：

```
1. src/theme/index.ts を全面書き換え
   - カラー定義を全入れ替え
   - shadow 定義を入れ替え
   - glassCard, glassPill, bubbleButton ヘルパー追加

2. App.tsx の修正
   - StatusBar style="dark"
   - root backgroundColor を #DFE6F6 に

3. src/navigation/AppNavigator.tsx
   - navTheme のカラー変更

4. src/components/ActionButton.tsx
   - ガラスバブルボタンに全面書き換え
   - タップスケールアニメーション追加

5. src/components/Toast.tsx
   - ガラストースト化

6. src/components/ProgressBar.tsx
   - ガラストラック・バーに変更

7. src/components/SimilaritySlider.tsx
   - ガラストラック・インジケーター

8. src/components/ThermalBanner.tsx
   - カラー差し替え

9. src/components/PhotoGroupCard.tsx
   - ガラスカード化
   - サムネイル・バッジ・削除UIのカラー変更

10. src/screens/OnboardingScreen.tsx
    - ガラスカード化、装飾円の色変更

11. src/screens/ScanScreen.tsx
    - 全状態のカード・テキスト・ボタンのカラー変更
```

---

## 10. チェックリスト

実装後に以下を確認：

- [ ] アプリ全体の背景が淡いラベンダーブルー（#DFE6F6）になっている
- [ ] ダーク系の色（#0A0A0A, #1A1A1A, #141414 等）が一切残っていない
- [ ] カードが半透明白のガラス感になっている
- [ ] ボタンがピル型で、上辺に白いハイライトラインがある
- [ ] primaryボタンが青いガラスビーズに見える（浮遊する青い影つき）
- [ ] secondaryボタンが白い半透明ガラスに見える
- [ ] タップ時にぷるっとバウンスする
- [ ] テキストが背景に対して十分な可読性を持っている
- [ ] 「残す」選択の緑枠がミントグリーンになっている
- [ ] 削除ボタンがコーラルピンクになっている
- [ ] プログレスバーがガラス棒に見える
- [ ] Toast がすりガラス風になっている
- [ ] StatusBar が dark content になっている

---

## 11. やってはいけないこと

- ❌ `src/native/`, `src/hooks/`, `src/store/`, `src/types/` のロジック変更
- ❌ Swift Native Module への一切の変更
- ❌ コンポーネントの props インターフェースの変更
- ❌ 黒・ダーク系の色を残す
- ❌ `expo-blur` や `@react-native-community/blur` の新規追加（shadow + border でガラス感を出す）
- ❌ 既存の依存パッケージ以外の追加（`expo-linear-gradient` は入っているので使ってOK）
