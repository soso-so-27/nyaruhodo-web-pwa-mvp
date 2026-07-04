---
name: ig-post-draft
description: Generate two quiet Instagram feed caption drafts from a cat photo description and short memo, then self-check them against docs/marketing/MARKETING-CANON.md. Use when 中西 asks for IGフィード投稿, むぎ日常, build in public, 写真説明＋一言メモからキャプション案, or a MARKETING-CANON compliant draft.
---

# ig-post-draft

Generate Instagram feed caption drafts only. Do not decide whether to post, and do not present final copy as approved.

Always begin the response exactly with:

```text
【ドラフト】以下はドラフトです。最終判断は中西さんです。
```

## Source of Truth

Treat `docs/marketing/MARKETING-CANON.md` as the single source of truth. Use `canon-check.md` as the extracted checklist for normal drafting.

When `docs/marketing/MARKETING-CANON.md` has changed more recently than `canon-check.md`, stop and tell the user that `canon-check.md` must be regenerated before using the skill.

Read `canon-check.md` before drafting. Read `examples.md` when tone calibration is useful or the input is ambiguous.

## Inputs

Require, or infer from the user's natural-language prompt:

- Photo description: what the sleeping cat photo shows.
- Short memo: the fragment 中西 wants to convey.

Optional:

- Type: `むぎ日常` or `build in public`. If omitted, infer it and say it is inferred.
- Phase: P1/P2/P3. If omitted, use P1.

Use `むぎ日常` when the photo and Mugi's state are the center. Use `build in public` when the memo is mainly about making the app, design decisions, development, launch preparation, or what 中西 is building.

## Drafting Workflow

1. Identify photo description, memo, type, and phase.
2. Sanitize the memo before drafting:
   - Remove or rephrase prohibited words.
   - In P1, remove app name `ねてるねこ`, release dates, and store links.
   - In P2, remove release dates and store links.
   - Remove emoji.
3. Draft two captions:
   - 案A starts from recent state or time, in a confiding tone.
   - 案B starts from scene or visual description.
   - Both use quiet `です・ます` Japanese.
   - Use either `私` or no explicit subject.
   - Structure: photo scene -> memo fragment -> optional quiet close.
   - Do not add punchlines, lessons, campaign copy, corporate announcements, or strong calls to action.
4. Self-check both drafts against `canon-check.md`.
5. If a draft violates a hard rule, discard and rewrite it before showing it.
6. If the user's input contained a prohibited word or phase-blocked phrase that was removed, mention that in the inspection section.
7. Only if a violation cannot be resolved after rewriting, show the least problematic draft and name the violation precisely.

## Fixed Output Format

```text
【ドラフト】以下はドラフトです。最終判断は中西さんです。

■ 種別: むぎ日常 / build in public（推定の場合はその旨）
■ フェーズ: P1（このフェーズで出せないもの: アプリ名・リリース日）

── 案A（トーン: 打ち明け）
<キャプション本文>

── 案B（トーン: 情景から入る）
<キャプション本文>

■ 規範検査
- 禁止表現: 検出なし / 検出あり（該当箇所と条項）
- 語彙ロック: 準拠 / 違反（該当箇所）
- フェーズ制約: 準拠 / 違反（P1でアプリ名が出ている 等）
- 絵文字: なし / あり（位置)

■ 補足（任意）
写真とキャプションの整合で気になる点があれば1点まで
```

For phase text, list the actual blocked items for that phase:

- P1: アプリ名・リリース日・ストアリンク
- P2: リリース日・ストアリンク
- P3: なし（数字誇示は恒久禁止）

## Boundaries

Do not propose posting timing, scheduling, stories copy, image edits, photo selection, DM replies, comment replies, or weekly reports.

