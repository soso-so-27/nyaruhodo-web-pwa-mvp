# Decisions

This file records product, logic, UI, schema, and architecture decisions.

Any change to the agreed specification must be recorded here.

# 設計判断：MVPでは calendar_context jsonb で生活文脈を保存する

## 背景

猫の行動は、人間の生活リズムにも影響される。

平日/休日、曜日、時間帯、祝日などによって、飼い主の在宅状況や行動が変わり、猫の行動も変わる可能性がある。

## 判断

MVPでは、events と diagnoses に calendar_context jsonb を追加する。

追加対象：

- events.calendar_context
- diagnoses.calendar_context

## 理由

events に保存することで、日常ログにも生活文脈を残せる。

diagnoses に保存することで、診断時の生活文脈を診断データ側にも残せる。

jsonb にすることで、今後祝日・連休・時間帯などの項目を柔軟に増やせる。

## 想定する形式

```json
{
  "dayOfWeek": 0,
  "dayName": "Sunday",
  "dayType": "weekend",
  "isWeekend": true,
  "isHoliday": false,
  "holidayName": null,
  "timeBand": "morning"
}
```

## timeBand

- early_morning
- morning
- daytime
- evening
- night
- late_night

## dayType

- weekday
- weekend
- holiday

## 今回はまだやらないこと

- 診断スコア補正
- 祝日API連携
- Google Calendar連携
- ユーザー予定連携
- 外部ライブラリ追加
- 既存データ移行
- RLS変更

## 既存データの扱い

既存データは calendar_context null のまま残す。

新規データから保存する。

## 2026-05-01

### Start With Web/PWA

Decision: Validate the MVP as a Next.js Web/PWA before native development.

Reason: Web/PWA is faster for MVP validation and can still support a future Expo React Native migration if logic and UI remain separated.

### Separate UI And Logic

Decision: Diagnosis logic, scoring, comprehension/confidence calculation, and shared types belong in `/core`.

Reason: This keeps the domain layer reusable for future native implementation and prevents UI components from becoming decision makers.

### Supabase Access Boundary

Decision: Supabase access must go through `/lib/supabase`.

Reason: A single access boundary keeps data access portable, testable, and easier to adapt.

### MVP Screen Scope

Decision: The MVP starts with only Home, meowing diagnosis flow, diagnosis result, and result feedback.

Reason: The first product risk is whether users can quickly input a concern and receive a useful interpretation.

### Home Is Input Only

Decision: Home contains only `いまの様子` and `気になること`.

Reason: Home should stay simple and focused. Action recommendations belong only on diagnosis result screens.

### Deterministic Diagnosis

Decision: Cause ranking is determined by deterministic scoring logic.

Reason: This keeps results explainable and stable. AI may help with wording but does not decide the category ranking.

### Health Override

Decision: Health-related flags prioritize `health`.

Reason: Health concerns should be handled conservatively and should not be hidden by ordinary scoring.

### Database Safety

Decision: DB migrations, RLS creation, SQL operations, and destructive changes require confirmation before execution.

Reason: Database changes can have durable effects. `supabase db reset` is prohibited.

### Memory Feedback Weights

Decision: Feedback is first reflected through in-memory category weights.

Reason: This lets the MVP feel slightly adaptive without introducing database persistence or complex learning logic. `resolved` adds 10 to the selected category weight, and `unresolved` subtracts 10.

### Elapsed Time Context

Decision: Diagnosis context can include `lastFoodMinutes` and `lastPlayMinutes` for core scoring.

Reason: Scenario tests need to distinguish recent food/play from long elapsed time without adding database persistence. Recent food reduces `food`, long elapsed time increases `food`, and recent play reduces `play`.

### Recent Events Context Fallback

Decision: Diagnosis pages may try to read recent `events` to derive `lastFoodMinutes` and `lastPlayMinutes`, but must fall back to fixed context if reads fail or no matching events exist.

Reason: MVP RLS currently allows anon insert only, so select is expected to fail until a later authenticated read policy is designed.

## 2026-05-02

# 設計判断：MVPでは local_cat_id で猫ごとの履歴を暫定分離する

## 背景

MVPでは localStorage ベースで複数猫プロフィールを管理している。

- `cat_profiles`
- `active_cat_id`

ただし、Supabase上の `events` / `diagnoses` / `feedbacks` はまだ猫ごとに分離されていない。

そのため、麦・雨・テスト猫で実利用すると履歴が混ざる。

## 判断

正式な `cats` テーブルはまだ作らない。

MVPでは、localStorage の `active_cat_id` を保存するために、各テーブルに `local_cat_id text` を追加する。

追加対象：

- `events.local_cat_id`
- `diagnoses.local_cat_id`
- `feedbacks.local_cat_id`

## 理由

既存DBには `cat_id uuid null` が存在するが、現在の `active_cat_id` は `local-cat-...` 形式の文字列であり、uuid型の `cat_id` にはそのまま保存できない。

そのため、正式な `cats` テーブル導入までは `local_cat_id text` を使う。

## やること

- `local_cat_id text null` を `events` / `diagnoses` / `feedbacks` に追加する
- 保存時に `active_cat_id` を `local_cat_id` として保存する
- `getRecentEvents` で `local_cat_id` を使って絞り込む
- 理解度と推測候補を猫ごとに分ける

## まだやらないこと

- `cats` テーブル追加
- `profiles` テーブル追加
- 認証追加
- 家族共有
- 複数端末同期
- RLSのユーザー単位制御
- 既存データ移行
- 既存 `cat_id uuid` の変更

## 既存データの扱い

既存の `local_cat_id null` のデータは移行せず、そのまま残す。

必要になれば後から「未分類データ」として扱う。
