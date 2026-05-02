# Product Spec

## Product Summary

This MVP is a Web/PWA app that helps cat owners quickly log a cat's current behavior or concern and receive a lightweight interpretation of possible causes.

The first implementation focuses on validating the user experience on Web/PWA before considering native app development with Expo React Native.

## MVP Goals

- Let users select a cat behavior or concern from a simple Home screen.
- Provide a diagnosis flow for "鳴いてる".
- Show diagnosis results without claiming certainty.
- Collect lightweight feedback on whether the result felt useful or accurate.

## Non-Goals For Initial MVP

- Full behavior journal.
- Account management beyond what is needed for future Supabase integration.
- Push notifications.
- Native app implementation.
- Complex medical triage.
- AI-driven final diagnosis.
- Home-screen action recommendations.

## Target Screens

1. Home screen
2. Meowing diagnosis flow
3. Diagnosis result screen
4. Result feedback screen or section

## Home Screen Role

Home is only an input surface.

It should help users answer:

- What is the cat doing now?
- What is concerning right now?

Home must not include:

- 記録する
- 今やること
- Action recommendations
- Diagnosis explanations

## Home Categories And Options

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

## First Diagnosis Path

The first connected flow is:

1. User selects `鳴いてる`.
2. App collects minimal context needed for scoring.
3. App calculates likely cause categories in `/core`.
4. App shows one or two likely candidates.
5. App shows suggested next actions only on the result screen.
6. App collects result feedback.

## Cause Categories

- `food`
- `play`
- `social`
- `stress`
- `health`

## Product Tone

- Calm
- Non-alarming
- Not overconfident
- Helpful without pretending to know exactly what the cat wants
- Clear that health concerns should be handled carefully

## AI Usage Policy

AI may be used for:

- Explanation copy
- Suggestion copy
- Making the result feel understandable

AI must not be the final decision maker for cause ranking. Ranking is determined by deterministic logic.
