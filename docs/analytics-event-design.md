# Analytics Event Design

Last updated: 2026-05-24

## 1. Purpose

この計測設計の目的は、マネタイズ前に以下を判断できる状態を作ること。

1. SNSから来た人が診断を最後まで進めているか
2. 診断後にHomeで「みっけ」しているか
3. Torisetu / Collectionに保存価値を感じているか
4. Account / 保存CTAに反応しているか
5. 課金前に、長期保存・写真保存・深掘り診断のどれが強いか

既存のSupabase `events` は猫の行動ログであり、プロダクト分析イベントとは分ける。

```
events
  = 猫の記録データ

product_analytics_events
  = ユーザー行動・ファネル計測データ
```

## 2. Principles

- 個人情報や写真そのものは送らない
- 猫の名前、メール、自由入力文は送らない
- 診断回答は、最初は `question_id` と `option_index` に留める
- `local_cat_id` は必要なら送るが、公開分析では匿名IDとして扱う
- 課金判断に必要な最小イベントから始める
- 実装初期は失敗してもUXを止めない

## 3. Identity Model

### Anonymous identifiers

localStorageに以下を持つ。

```ts
analytics_anonymous_id: string; // uuid
analytics_session_id: string;   // 起動ごと、または30分無操作で更新
```

### Account identifiers

ログイン済みの場合のみ、Supabase `user.id` を `user_id` として送る。

送信イメージ:

```ts
{
  anonymous_id,
  session_id,
  user_id: user?.id ?? null,
  local_cat_id: activeCatId ?? null,
}
```

## 4. Base Event Shape

```ts
type ProductAnalyticsEvent = {
  name: string;
  occurred_at: string;
  anonymous_id: string;
  session_id: string;
  user_id?: string | null;
  local_cat_id?: string | null;
  route?: string;
  referrer?: string | null;
  source?: "sns" | "direct" | "pwa" | "unknown";
  properties?: Record<string, unknown>;
};
```

将来DB化する場合の候補:

```sql
create table product_analytics_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  occurred_at timestamptz not null default now(),
  anonymous_id text not null,
  session_id text not null,
  user_id uuid null,
  local_cat_id text null,
  route text null,
  referrer text null,
  source text null,
  properties jsonb not null default '{}'::jsonb
);
```

## 5. Event Naming Rules

形式:

```text
area_object_action
```

例:

```text
diagnosis_onboarding_started
home_mikke_recorded
torisetu_result_opened
collection_photo_added
account_create_cta_clicked
```

避ける命名:

- `click_button_1`
- `event_saved`
- `open`
- `done`

## 6. Required Events for Open Beta

### 6.1 Entry and session

| Event | When | Properties |
|---|---|---|
| `app_opened` | app初期表示時 | `display_mode`, `route`, `has_completed_onboarding`, `cat_count` |
| `route_viewed` | 主要ページ表示時 | `route`, `active_tab`, `cat_count` |
| `pwa_display_mode_detected` | app初期表示時 | `display_mode: browser/standalone/unknown` |

### 6.2 Diagnosis onboarding funnel

| Event | When | Properties |
|---|---|---|
| `diagnosis_onboarding_started` | `/diagnosis-onboarding` 初回表示 | `entry_source`, `has_existing_profile` |
| `diagnosis_name_submitted` | 名前入力の次へ | `name_length_bucket` |
| `diagnosis_photo_added` | 写真登録成功 | `source: camera/gallery`, `file_size_bucket` |
| `diagnosis_photo_skipped` | 写真スキップ | `next_step: coat` |
| `diagnosis_coat_selected` | 毛色選択 | `coat` |
| `diagnosis_basic_info_submitted` | 基本情報の次へ | `has_birth_date`, `has_gender`, `has_breed` |
| `diagnosis_basic_info_skipped` | 基本情報スキップ | none |
| `diagnosis_question_answered` | 各質問回答 | `phase`, `question_id`, `question_index`, `option_index` |
| `diagnosis_provisional_result_viewed` | 3問後の仮結果表示 | `type_key`, `answered_count` |
| `diagnosis_refinement_started` | 「くわしく診断する」押下 | `provisional_type_key` |
| `diagnosis_final_result_viewed` | 最終結果表示 | `type_key`, `provisional_type_key`, `changed_from_provisional`, `answered_count` |
| `diagnosis_result_saved` | cat_profiles保存成功 | `type_key`, `has_photo`, `has_basic_info` |
| `diagnosis_home_started` | Home遷移直前 | `cta: mikke_start` |

### 6.3 Home habit events

| Event | When | Properties |
|---|---|---|
| `home_viewed` | `/home` 表示 | `cat_count`, `has_active_cat`, `has_home_photo`, `record_count` |
| `home_cat_switched` | 猫切り替え | `method: avatar_swipe/pill/sheet` |
| `home_recommendation_board_peeked` | おすすめボードが初期表示 | `card_count` |
| `home_recommendation_board_expanded` | 上スワイプ/展開 | `card_count` |
| `home_recommendation_card_tapped` | おすすめカード押下 | `card_id`, `card_type` |
| `home_mikke_opened` | みっけ入力を開く | `entry: main_card/recommendation` |
| `home_mikke_recorded` | みっけ記録完了 | `value`, `lock_remaining_before` |
| `home_care_opened` | おせわ/してあげた入力を開く | `entry` |
| `home_care_recorded` | おせわ記録完了 | `value`, `lock_remaining_before` |
| `home_photo_action_opened` | 写真導線を開く | `entry` |
| `home_photo_added` | 写真追加成功 | `source: camera/gallery` |

### 6.4 Torisetu events

| Event | When | Properties |
|---|---|---|
| `torisetu_viewed` | `/torisetu` 表示 | `result_count`, `available_diagnosis_count`, `locked_diagnosis_count` |
| `torisetu_result_card_opened` | 発見/診断結果カードを開く | `result_id`, `result_type: observation/diagnosis` |
| `torisetu_diagnosis_card_started` | 診断カード開始 | `diagnosis_id`, `diagnosis_status` |
| `torisetu_locked_card_viewed` | ロック中カードが表示される | `diagnosis_id`, `unlock_condition` |

### 6.5 Collection events

| Event | When | Properties |
|---|---|---|
| `collection_viewed` | `/collection` 表示 | `photo_count`, `today_target_slug` |
| `collection_target_viewed` | 今日の見つけたい姿表示 | `pose_slug` |
| `collection_photo_add_opened` | 写真追加導線を開く | `entry: target/grid/detail` |
| `collection_photo_added` | 写真追加成功 | `pose_slug`, `source: camera/gallery` |
| `collection_pose_found` | 〇〇を見つけた表示 | `pose_slug` |
| `collection_share_tapped` | share押下 | `pose_slug`, `has_photo` |

### 6.6 Account and monetization intent

| Event | When | Properties |
|---|---|---|
| `account_create_cta_viewed` | 保存CTA表示 | `route`, `cat_count`, `trigger` |
| `account_create_cta_clicked` | CTA押下 | `route`, `trigger` |
| `auth_google_started` | Googleログイン開始 | `route` |
| `auth_google_succeeded` | callback成功 | `route_after` |
| `auth_google_failed` | callback失敗 | `error_type` |
| `paid_interest_cta_viewed` | 課金前CTA表示 | `offer_type: long_term_save/photo_storage/deep_diagnosis` |
| `paid_interest_cta_clicked` | 課金前CTA押下 | `offer_type` |

## 7. Derived Funnels

### SNS diagnosis funnel

```text
diagnosis_onboarding_started
-> diagnosis_name_submitted
-> diagnosis_photo_added / diagnosis_photo_skipped
-> diagnosis_basic_info_submitted / diagnosis_basic_info_skipped
-> diagnosis_provisional_result_viewed
-> diagnosis_final_result_viewed
-> diagnosis_result_saved
-> home_viewed
-> home_mikke_recorded
```

Primary metric:

- diagnosis start to final result rate
- final result to saved profile rate
- saved profile to first mikke rate

### Save intent funnel

```text
home_viewed
-> torisetu_viewed / collection_viewed
-> account_create_cta_viewed
-> account_create_cta_clicked
-> auth_google_started
-> auth_google_succeeded
```

Primary metric:

- account CTA click rate after meaningful value exposure

### Paid intent funnel

```text
torisetu_result_card_opened / collection_photo_added
-> paid_interest_cta_viewed
-> paid_interest_cta_clicked
```

Primary metric:

- which offer type receives the strongest click rate

## 8. Properties to Avoid

Do not send:

- cat name
- email
- image data / image URL before privacy design
- free text breed as-is
- raw user agent if not needed
- exact birth date

Use buckets instead:

```ts
name_length_bucket: "1-3" | "4-8" | "9+";
age_bucket: "kitten" | "adult" | "senior" | "unknown";
file_size_bucket: "small" | "medium" | "large";
```

## 9. Implementation Options

### Option A: Manual feedback first

No code implementation. Use SNS replies/forms and manual observation.

Pros:

- fastest
- no privacy complexity

Cons:

- funnel drop-off is invisible
- cannot quantify account/save intent

### Option B: Local queue + Supabase analytics table

Add a lightweight `trackProductEvent()` that writes to a local queue and flushes to Supabase.

Pros:

- enough for open beta
- no third-party analytics tool
- flexible schema

Cons:

- requires DB/RLS/privacy wording
- needs failure handling

### Option C: External analytics tool

PostHog / Plausible / Vercel Analytics etc.

Pros:

- faster dashboarding

Cons:

- privacy review
- event schema still must be designed
- user-level funnel may still need app-side IDs

## 10. Recommendation

For open beta:

1. Implement Option B only for the core funnel events.
2. Do not send photos, names, email, or free text.
3. Start with diagnosis funnel + first Home action + account CTA.
4. Add Torisetu / Collection events after page roles stabilize.

First implementation batch:

- `diagnosis_onboarding_started`
- `diagnosis_name_submitted`
- `diagnosis_photo_added`
- `diagnosis_photo_skipped`
- `diagnosis_basic_info_submitted`
- `diagnosis_basic_info_skipped`
- `diagnosis_provisional_result_viewed`
- `diagnosis_refinement_started`
- `diagnosis_final_result_viewed`
- `diagnosis_result_saved`
- `home_viewed`
- `home_mikke_recorded`
- `home_care_recorded`
- `account_create_cta_viewed`
- `account_create_cta_clicked`

This is enough to answer:

- SNSから来た人は診断を終えるか
- 入力ステップのどこで落ちるか
- 診断後にHomeで記録するか
- 保存したい気持ちが発生しているか

## 11. Implementation Status

### Implemented in the first batch

Storage keys:

- `analytics_anonymous_id`
- `analytics_session`
- `analytics_event_queue`

Utility:

- `src/lib/analytics/productAnalytics.ts`

Behavior:

- Generates anonymous id locally
- Generates session id locally and refreshes after 30 minutes of inactivity
- Stores events in a capped localStorage queue
- Flushes queued events to Supabase `product_analytics_events` when the migration is applied
- Does not store cat names, emails, image data, or free text

Instrumented events:

- `diagnosis_onboarding_started`
- `diagnosis_name_submitted`
- `diagnosis_photo_added`
- `diagnosis_photo_skipped`
- `diagnosis_coat_selected`
- `diagnosis_basic_info_submitted`
- `diagnosis_basic_info_skipped`
- `diagnosis_question_answered`
- `diagnosis_provisional_result_viewed`
- `diagnosis_refinement_started`
- `diagnosis_final_result_viewed`
- `diagnosis_result_saved`
- `diagnosis_home_started`
- `home_viewed`
- `home_mikke_recorded`
- `home_care_recorded`
- `home_photo_added`
- `account_create_cta_viewed`
- `account_create_cta_clicked`
- `auth_google_started`
- `auth_google_failed`
- `auth_google_succeeded`
- `torisetu_viewed`
- `torisetu_result_card_opened`
- `torisetu_diagnosis_card_started`
- `torisetu_diagnosis_completed`
- `collection_viewed`
- `collection_target_viewed`
- `collection_group_selected`
- `collection_slot_opened`
- `collection_photo_add_started`
- `collection_photo_added`
- `collection_pose_found`
- `collection_share_tapped`

### Not implemented yet

- analytics dashboard
- paid intent events
- remote migration application in production/staging

### Next implementation batch

1. Apply `20260524152000_create_product_analytics_events.sql` to Supabase
2. Add a small internal event QA/debug viewer if needed
3. Add paid-intent CTA events after CTA copy is finalized
4. Build the first dashboard queries for open beta
