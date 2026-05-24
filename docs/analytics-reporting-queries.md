# Analytics Reporting Queries

Last updated: 2026-05-24

Open betaでは、まず「SNSから来た人が診断を完了し、ホームでみっけし、保存意欲を持つか」を見る。
このメモはSupabase SQL Editorでそのまま使うためのクエリ集。

## 0. Safety

- cat name, email, image data, free text are not stored in `product_analytics_events`.
- Raw `user_id`, `anonymous_id`, `session_id`, `local_cat_id` should not be exported casually.
- Reports should use counts, rates, and grouped buckets.

## 1. Event Health

直近24時間でイベントが入っているか確認する。

```sql
select
  name,
  count(*)::int as count,
  max(created_at) as latest_created_at
from public.product_analytics_events
where created_at >= now() - interval '24 hours'
group by name
order by latest_created_at desc;
```

## 2. Diagnosis Funnel

診断開始から保存完了までの人数ベースのファネル。

```sql
with users as (
  select
    anonymous_id,
    bool_or(name = 'diagnosis_onboarding_started') as started,
    bool_or(name = 'diagnosis_name_submitted') as name_submitted,
    bool_or(name in ('diagnosis_photo_added', 'diagnosis_photo_skipped')) as photo_step_done,
    bool_or(name in ('diagnosis_basic_info_submitted', 'diagnosis_basic_info_skipped')) as basic_info_done,
    bool_or(name = 'diagnosis_provisional_result_viewed') as provisional_viewed,
    bool_or(name = 'diagnosis_final_result_viewed') as final_viewed,
    bool_or(name = 'diagnosis_result_saved') as result_saved,
    bool_or(name = 'diagnosis_onboarding_completed') as completed,
    bool_or(name = 'home_viewed') as home_viewed
  from public.product_analytics_events
  where created_at >= now() - interval '7 days'
  group by anonymous_id
)
select '01 started' as step, count(*) filter (where started)::int as users from users
union all select '02 name submitted', count(*) filter (where name_submitted)::int from users
union all select '03 photo step done', count(*) filter (where photo_step_done)::int from users
union all select '04 basic info done', count(*) filter (where basic_info_done)::int from users
union all select '05 provisional viewed', count(*) filter (where provisional_viewed)::int from users
union all select '06 final viewed', count(*) filter (where final_viewed)::int from users
union all select '07 result saved', count(*) filter (where result_saved)::int from users
union all select '08 completed', count(*) filter (where completed)::int from users
union all select '09 home viewed', count(*) filter (where home_viewed)::int from users
order by step;
```

## 3. Diagnosis Drop-off Rate

どこで落ちているかをざっくり見る。

```sql
with funnel as (
  select
    count(distinct anonymous_id) filter (where name = 'diagnosis_onboarding_started') as started,
    count(distinct anonymous_id) filter (where name = 'diagnosis_name_submitted') as name_submitted,
    count(distinct anonymous_id) filter (where name = 'diagnosis_final_result_viewed') as final_viewed,
    count(distinct anonymous_id) filter (where name = 'diagnosis_onboarding_completed') as completed
  from public.product_analytics_events
  where created_at >= now() - interval '7 days'
)
select
  started,
  name_submitted,
  final_viewed,
  completed,
  round(100.0 * name_submitted / nullif(started, 0), 1) as name_submit_rate,
  round(100.0 * final_viewed / nullif(started, 0), 1) as final_view_rate,
  round(100.0 * completed / nullif(started, 0), 1) as completion_rate
from funnel;
```

## 4. First Home Action

診断後にホームで最初の価値行動が起きているかを見る。

```sql
with first_events as (
  select
    anonymous_id,
    min(created_at) filter (where name = 'diagnosis_onboarding_completed') as completed_at,
    min(created_at) filter (where name = 'home_mikke_recorded') as first_mikke_at,
    min(created_at) filter (where name = 'home_care_recorded') as first_care_at,
    min(created_at) filter (where name = 'home_photo_added') as first_photo_at
  from public.product_analytics_events
  where created_at >= now() - interval '7 days'
  group by anonymous_id
)
select
  count(*) filter (where completed_at is not null)::int as completed_users,
  count(*) filter (where first_mikke_at > completed_at)::int as mikke_after_completion,
  count(*) filter (where first_care_at > completed_at)::int as care_after_completion,
  count(*) filter (where first_photo_at > completed_at)::int as photo_after_completion
from first_events;
```

## 5. Account Funnel

アカウント保存導線が見られて、クリックされて、Googleログイン成功しているか。

```sql
with users as (
  select
    anonymous_id,
    bool_or(name = 'account_create_cta_viewed') as viewed,
    bool_or(name = 'account_create_cta_clicked') as clicked,
    bool_or(name = 'auth_google_started') as auth_started,
    bool_or(name = 'auth_google_succeeded') as auth_succeeded
  from public.product_analytics_events
  where created_at >= now() - interval '7 days'
  group by anonymous_id
)
select '01 account cta viewed' as step, count(*) filter (where viewed)::int as users from users
union all select '02 account cta clicked', count(*) filter (where clicked)::int from users
union all select '03 google auth started', count(*) filter (where auth_started)::int from users
union all select '04 google auth succeeded', count(*) filter (where auth_succeeded)::int from users
order by step;
```

## 6. Account Funnel Conversion

```sql
with funnel as (
  select
    count(distinct anonymous_id) filter (where name = 'account_create_cta_viewed') as viewed,
    count(distinct anonymous_id) filter (where name = 'account_create_cta_clicked') as clicked,
    count(distinct anonymous_id) filter (where name = 'auth_google_started') as auth_started,
    count(distinct anonymous_id) filter (where name = 'auth_google_succeeded') as auth_succeeded
  from public.product_analytics_events
  where created_at >= now() - interval '7 days'
)
select
  viewed,
  clicked,
  auth_started,
  auth_succeeded,
  round(100.0 * clicked / nullif(viewed, 0), 1) as cta_click_rate,
  round(100.0 * auth_succeeded / nullif(auth_started, 0), 1) as auth_success_rate
from funnel;
```

## 7. Torisetu / Collection Value Exposure

診断後に価値ページへ進んでいるか。

```sql
select
  name,
  count(*)::int as events,
  count(distinct anonymous_id)::int as users
from public.product_analytics_events
where created_at >= now() - interval '7 days'
  and name in (
    'torisetu_viewed',
    'torisetu_result_card_opened',
    'torisetu_diagnosis_card_started',
    'collection_viewed',
    'collection_photo_added',
    'collection_share_tapped'
  )
group by name
order by users desc, events desc;
```

## 8. Source Performance

SNS公開時、source別に診断完了率を見る。

```sql
with per_user as (
  select
    anonymous_id,
    min(source) filter (where source is not null) as source,
    bool_or(name = 'diagnosis_onboarding_started') as started,
    bool_or(name = 'diagnosis_onboarding_completed') as completed,
    bool_or(name = 'home_mikke_recorded') as mikke_recorded,
    bool_or(name = 'auth_google_succeeded') as auth_succeeded
  from public.product_analytics_events
  where created_at >= now() - interval '7 days'
  group by anonymous_id
)
select
  coalesce(source, 'unknown') as source,
  count(*) filter (where started)::int as started_users,
  count(*) filter (where completed)::int as completed_users,
  count(*) filter (where mikke_recorded)::int as mikke_users,
  count(*) filter (where auth_succeeded)::int as auth_users,
  round(100.0 * count(*) filter (where completed) / nullif(count(*) filter (where started), 0), 1) as completion_rate
from per_user
group by source
order by started_users desc;
```

## 9. Daily Trend

日別の主要イベント推移。

```sql
select
  date_trunc('day', created_at at time zone 'Asia/Tokyo')::date as day_jst,
  count(distinct anonymous_id) filter (where name = 'diagnosis_onboarding_started') as diagnosis_started,
  count(distinct anonymous_id) filter (where name = 'diagnosis_onboarding_completed') as diagnosis_completed,
  count(distinct anonymous_id) filter (where name = 'home_mikke_recorded') as mikke_users,
  count(distinct anonymous_id) filter (where name = 'auth_google_succeeded') as auth_users
from public.product_analytics_events
where created_at >= now() - interval '30 days'
group by day_jst
order by day_jst desc;
```

## 10. QA: Latest Events Without IDs

イベントが入っているかだけを確認する。IDやpropertiesは見ない。

```sql
select
  name,
  route,
  source,
  created_at
from public.product_analytics_events
order by created_at desc
limit 50;
```

## 11. Related QA Flow

Manual QA order and expected events are tracked in:

- `docs/open-beta-qa-checklist.md`

## 12. Open Beta Campaign Attribution

SNS公開時は、入口URLに `utm_source` / `utm_campaign` を付ける。

Example:

- `/?utm_source=instagram&utm_campaign=open_beta_01`
- `/?source=sns&utm_campaign=open_beta_01`

The root route preserves these params when it redirects to `/diagnosis-onboarding` or `/home`, and analytics events copy them into `properties`.

```sql
select
  properties->>'utm_source' as utm_source,
  properties->>'utm_campaign' as utm_campaign,
  count(distinct anonymous_id) filter (where name = 'diagnosis_onboarding_started') as diagnosis_started,
  count(distinct anonymous_id) filter (where name = 'diagnosis_onboarding_completed') as diagnosis_completed,
  count(distinct anonymous_id) filter (where name = 'home_mikke_recorded') as mikke_users,
  count(distinct anonymous_id) filter (where name = 'auth_google_succeeded') as auth_users
from public.product_analytics_events
where created_at >= now() - interval '30 days'
group by utm_source, utm_campaign
order by diagnosis_started desc nulls last;
```
