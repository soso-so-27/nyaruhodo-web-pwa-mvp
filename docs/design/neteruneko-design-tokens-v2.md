# ねてるねこ Design Tokens v2

正典: 日とと記。UIは紙とインクのみ。色は写真が運ぶ。

**トークンの実名・実値の単独の正は `src/app/tokens.css`**（BRAND-GUIDELINE §5と同方針）。
本書は適用ルールと索引のみを持ち、値を転記しない（乖離防止・2026-07-07改訂）。

## 根本変更

- ローズの廃止。
- 有彩色の面は禁止。
- 封筒・カード・ボタンの面は紙系だけ。
- `--seal` は封蝋の点と破壊的操作の文字にのみ使う。
  （旧「押下中の『おさえて ひらく』」用途は、長押し開封の廃止
  （`neteruneko-design-brief.md` Hard No・`opening-flow-v2.md`）に伴い削除）
- 背景は `--app-paper-background`（紙質感タイル込み）。グラデーション単体では紙にしない。
- 塗りつぶしボタンは1画面に最大1つ。
- ラベル・日付・ボタン文字は現行表示書体+字間。
- 旧「明朝+字間」決定は、2026-07-07に設定ページ本文書体（`--font-ui` = `Zen Kaku Gothic New`）を公式本文書体とする方針へ差し替え済み。

## トークン索引（実名のみ。値は `src/app/tokens.css` を参照）

- 紙とインク: `--paper` / `--paper-warm` / `--paper-card` / `--ink` / `--ink-soft` / `--ink-faint` / `--line` / `--line-strong`
- 深色・削除系: `--seal` / `--seal-soft` / `--danger` / `--danger-line`
- 背景: `--app-paper-background`（`--bg-gradient` は下地グラデーション）
- 影: `--shadow-e0` / `--shadow-e1` / `--shadow-e2`
  （旧 `--shadow-rest` / `--shadow-float` は実装に存在しない旧名。使用禁止）
- 角丸: `--radius-sm` / `--radius-md` / `--radius-lg` / `--radius-xl` / `--radius-2xl` / `--radius-full`
  （旧 `--radius-tile` / `--radius-img` / `--radius-s` は実装に存在しない旧名。使用禁止）
- 文字: `--font-display`（Klee One）/ `--font-ui`（Zen Kaku Gothic New）/ `--font-sans` / `--tracking-label` / `--tracking-body`
- 動き: `--ease-settle` / `--ease-gentle` / `--dur-instant` / `--dur-move` / `--dur-reveal` / `--dur-develop`

## 適用ルール

1. 有彩色の面は禁止。UIの面は `--paper`, `--paper-warm`, `--paper-card` のみ。
2. `--seal` は点と文字だけ。面に塗らない。
3. 背景は `--app-paper-background`。グラデーション単体では紙にしない。
4. ラベル・日付・ボタン文字は `--font-display` + `--tracking-label`。
5. 本文・設定説明・管理表示は `--font-ui`。
6. 物に説明を印字しない。
7. 写真タイルの白フチ・角丸は維持。写真だけが色の主役。

---
改訂履歴:
- 2026-07-07 (2): 値の転記を廃止し `src/app/tokens.css` を単独の正に。影・角丸の旧トークン名を
  使用禁止と明記。長押し「おさえて ひらく」への言及を全削除。背景ルールを
  `--app-paper-background` 基準へ改訂（docs監査 B2対応）。
- 2026-07-07 (1): 書体を現行（Klee One / Zen Kaku Gothic New）へ差し替え。
