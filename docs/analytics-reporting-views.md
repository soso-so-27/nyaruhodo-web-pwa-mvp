# Analytics Reporting Views

Last updated: 2026-05-25

This memo lists the Supabase reporting views created for open beta.
They are intended for Supabase SQL Editor / dashboard checks, not for the public app UI.

## Safety Rules

- These views aggregate analytics and avoid raw `anonymous_id`, `session_id`, `user_id`, and `local_cat_id`.
- Do not export raw `product_analytics_events` unless there is a clear debugging reason.
- Do not send cat names, email addresses, image data, or free text into analytics events.
- The migration revokes view access from `anon` and `authenticated`; use the Supabase dashboard or service/admin context for reporting.

## Apply

Migration:

```text
supabase/migrations/20260525093000_create_analytics_reporting_views.sql
```

Apply with:

```bash
supabase db push
```

If CLI auth is not available, paste the migration SQL into Supabase SQL Editor.

## 1. Event Health

Use this first after deploy or SNS announcement.

```sql
select *
from public.analytics_event_health_24h
order by latest_created_at desc;
```

Answers:

- Are events arriving?
- Which event fired most recently?
- Are users/sessions non-zero?

## 2. Open Beta Funnel

This is the main daily readout.

```sql
select *
from public.analytics_open_beta_funnel_30d;
```

Important columns:

- `diagnosis_started_users`
- `diagnosis_completed_users`
- `diagnosis_completion_rate`
- `mikke_recorded_users`
- `completed_to_mikke_rate`
- `account_cta_clicked_users`
- `auth_succeeded_users`
- `account_sync_completed_users`
- `account_restore_completed_users`

## 3. Daily Metrics

Use this to compare SNS posts, campaigns, and daily changes.

```sql
select *
from public.analytics_daily_metrics_30d
order by day_jst desc, user_count desc;
```

Campaign-only view:

```sql
select *
from public.analytics_daily_metrics_30d
where utm_campaign is not null
order by day_jst desc, user_count desc;
```

## 4. Feature Engagement

Use this to see what users touch after onboarding.

```sql
select *
from public.analytics_feature_engagement_7d
order by area, user_count desc, event_count desc;
```

Useful checks:

- `home_mikke_recorded`: habit formation
- `torisetu_result_card_opened`: knowledge value
- `torisetu_locked_diagnosis_tapped`: future diagnosis interest
- `collection_photo_added`: collection behavior
- `collection_share_tapped`: sharing intent
- `collection_share_feed_card_opened`: share feed interest

## 5. Safe Recent Events

Use this for QA without exposing IDs or full property payloads.

```sql
select *
from public.analytics_safe_recent_events
order by created_at desc
limit 100;
```

Answers:

- Did my test action send an event?
- Did the route/source/campaign attach correctly?
- Was the user logged in (`has_user_id`)?
- Was a local cat attached (`has_local_cat_id`)?

## 6. Recommended Open Beta Routine

After a test deploy:

1. Open `/diagnosis-onboarding` and complete a diagnosis.
2. Use Home `mikke`.
3. Open Torisetu and tap a result card.
4. Open Collection and add a photo.
5. Create/login account and run sync.
6. Run:

```sql
select * from public.analytics_event_health_24h order by latest_created_at desc;
select * from public.analytics_open_beta_funnel_30d;
select * from public.analytics_feature_engagement_7d order by area, user_count desc;
select * from public.analytics_safe_recent_events order by created_at desc limit 50;
```

## 7. When Something Looks Wrong

- If event counts are zero: check `analytics_event_queue` in localStorage and Supabase insert permissions.
- If auth/sync events are missing: verify the user is logged in and the account action completed.
- If campaign values are missing: verify the entry URL includes `utm_source` / `utm_campaign`, and that the root redirect preserved query params.
- If views fail with permission errors in app code: that is expected. These views are intentionally not granted to `anon` or `authenticated`.
