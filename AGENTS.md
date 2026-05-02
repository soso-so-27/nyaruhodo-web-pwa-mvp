# AGENTS.md

## Project Goal

This repository implements an MVP Web/PWA app for logging and interpreting cat behavior.

The first validation target is Web/PWA. The architecture must keep future migration to Expo React Native realistic by separating UI, domain logic, data access, and platform-specific concerns.

## Tech Stack

- Next.js
- TypeScript
- Supabase
- Vercel
- Future Expo React Native migration in mind

## Required Architecture

- Put diagnosis logic, scoring, comprehension/confidence calculation, and shared types under `/core`.
- Keep UI components free of diagnosis logic.
- Access Supabase only through `/lib/supabase`.
- Keep domain logic framework-independent wherever possible.
- Prefer functions that can be reused from Web and future React Native.

## MVP Scope

Implement only these screens first:

1. Home
2. Meowing diagnosis flow
3. Diagnosis result
4. Result feedback

Home is an input surface only. Do not show action recommendations on Home.

## Home Categories

Home has only two categories:

- いまの様子
- 気になること

Do not add these categories to Home:

- 記録する
- 今やること

## Home Options

### いまの様子

- ねてる
- 遊んでる
- グルーミング
- ご飯たべた
- トイレした
- ゴロゴロしてる

### 気になること

- 鳴いてる
- ついてくる
- 落ち着かない
- 元気ない
- ケンカしてる
- よくわからない

## Design Rules

- Use a gray-based visual system.
- Use at most one accent color.
- Do not encode too much meaning with color.
- Use no shadow or minimal shadow.
- Buttons should be rounded and flat.
- Use generous spacing.
- Avoid adding excessive information.
- Home is for input; action recommendations appear only on diagnosis result screens.

## Diagnosis Logic Rules

- Decisions are made by deterministic logic.
- AI may assist only with explanation text, suggestion text, and perceived helpfulness.
- Do not force a single cause when scores are close.
- If the top two score difference is less than 10, show two candidates.
- Health-related flags override ordinary scoring and prioritize `health`.

## Supabase Rules

- Data access must go through `/lib/supabase`.
- Do not write Supabase calls inside UI components.
- Before creating or running DB migrations, RLS policies, or SQL operations, ask the user for confirmation.
- Destructive operations are prohibited unless explicitly approved.
- Never run `supabase db reset`.

## Change Management

- Any product, logic, UI, schema, or architecture decision change must be recorded in `docs/decisions.md`.
- Keep documentation updated before or during implementation, not after large drift has accumulated.

## Development Order

Follow this order:

1. Create `AGENTS.md` and docs.
2. Create the Next.js directory structure.
3. Implement only the Home UI.
4. Implement `/core` scoring functions.
5. Connect "鳴いてる" to the diagnosis result flow.

Move in small increments. Do not implement everything at once.
