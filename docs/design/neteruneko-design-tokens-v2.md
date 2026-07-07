# ねてるねこ Design Tokens v2

正典: 日とと記。UIは紙とインクのみ。色は写真が運ぶ。

## 根本変更

- ローズの廃止。
- 有彩色の面は禁止。
- 封筒・カード・ボタンの面は紙系だけ。
- `--seal` は封蝋の点、押下中の「おさえて ひらく」、破壊的操作の文字にのみ使う。
- 背景は全画面 `--bg-gradient`。
- 塗りつぶしボタンは1画面に最大1つ。
- ラベル・日付・ボタン文字は現行表示書体+字間。
- 旧「明朝+字間」決定は、2026-07-07に設定ページ本文書体（`--font-ui` = `Zen Kaku Gothic New`）を公式本文書体とする方針へ差し替え済み。

## CSS Tokens

```css
:root {
  /* ===== 紙とインク(これが全て) ===== */
  --paper:      #fbfaf7;
  --paper-warm: #f4f1ea;
  --paper-card: #f1efe9;
  --ink:        #3f3a33;
  --ink-soft:   #8a847a;
  --ink-faint:  #b8b2a6;
  --line:       #e3dfd5;

  /* ===== 唯一の深色(封蝋と削除系のみ。面に塗らない) ===== */
  --seal:       #a8584e;

  /* ===== 背景: 紙に当たる光(フラット禁止・全画面共通) ===== */
  --bg-gradient: linear-gradient(180deg, var(--paper) 0%, var(--paper-warm) 100%);

  /* ===== 影(2段・さらに弱く) ===== */
  --shadow-rest:  0 4px 12px rgba(120, 110, 95, 0.08);
  --shadow-float: 0 10px 24px rgba(120, 110, 95, 0.14);

  /* ===== 角丸(3段・据え置き) ===== */
  --radius-tile: 24px;
  --radius-img: 17px;
  --radius-s: 13px;

  /* ===== 文字 ===== */
  --font-display: var(--font-klee-one), "Klee One", sans-serif;
  --font-ui: var(--font-zen-kaku), "Zen Kaku Gothic New", -apple-system, "Hiragino Sans", sans-serif;
  --font-sans: -apple-system, "Hiragino Sans", sans-serif;
  --tracking-label: 0.18em;
  --tracking-body:  0.06em;

  /* ===== 動き ===== */
  --ease-settle: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-gentle: cubic-bezier(0.4, 0, 0.2, 1);
  --dur-instant: 180ms;
  --dur-move:    420ms;
  --dur-reveal:  900ms;
  --dur-develop: 1600ms;
}
```

## 適用ルール

1. 有彩色の面は禁止。UIの面は `--paper`, `--paper-warm`, `--paper-card` のみ。
2. `--seal` は点と文字だけ。面に塗らない。
3. 背景は `--bg-gradient`。
4. ラベル・日付・ボタン文字は `--font-display` + `--tracking-label`。
5. 本文・設定説明・管理表示は `--font-ui`。
6. 物に説明を印字しない。「おさえて ひらく」は封筒下の独立行。
7. 写真タイルの白フチ・角丸は維持。写真だけが色の主役。
