# ig-post-draft canon-check

Generated from `docs/marketing/MARKETING-CANON.md` v0.1 sections 2, 3, 4, and 5.

`docs/marketing/MARKETING-CANON.md` is the single source of truth. When CANON changes, regenerate this file before using the skill.

## Type

- `むぎ日常`: Mugi, the sleeping photo, and ordinary close observation are the center.
- `build in public`: Development, design decisions, launch preparation, or making the app are the center.

If the user does not specify a type, infer it from the memo and state that it was inferred.

## Prohibited Words

Detect exact matches and natural inflections.

| Category | Words |
| --- | --- |
| 死関連 | 一生, 最期, 見送る, 見送り, 虹の橋, 天国 |
| 煽り | 今だけ, お早めに, 残りわずか, 見逃すな, 必見, バズ, 緊急 |
| 誇示 | 突破, ランキング, 話題の, 大人気, 急上昇 |
| 依頼 | 拡散, シェアお願い, フォローお願い, いいねお願い |
| ゲーミフィケーション | 連続記録, ストリーク, ポイント, ランク, 達成 |
| リファラル報酬 | 紹介で, 招待特典 |

If any prohibited word appears in the input memo, rephrase it before drafting and report the rephrase in `規範検査`.

## Vocabulary Lock

Apply only when mentioning app behavior.

| Concept | Required / preferred wording |
| --- | --- |
| Sleeping cat photo | ねがお |
| Notification / delivery | ねこだより / とどく |
| Opening | ひらく |

Prefer `一日一枚` over `毎日` when it fits. This is a note-level recommendation, not a hard violation.

## Phase Constraints

| Phase | Blocked |
| --- | --- |
| P1 | App name `ねてるねこ`, release dates, store links |
| P2 | Release dates, store links |
| P3 | No phase-specific blocked items |

P3 still inherits permanent bans on hype, numerical boasting, and prohibited words.

If no phase is specified, use P1.

## Format Rules

- Emoji: hard violation.
- Hashtags: at most 3.
- Hype tags such as `#拡散希望` are prohibited.
- Length: 400 Japanese characters is the target. Exceeding it is a note-level issue, not a hard violation.

## Voice Rules

- Use quiet Japanese in `です・ます` form.
- Use `私` or no subject.
- Do not use corporate announcement style.
- Do not write campaign copy.
- Do not create a punchline, lesson, hard conclusion, or call to action.
- Use short sentences.
- Avoid overusing noun-ending fragments.

