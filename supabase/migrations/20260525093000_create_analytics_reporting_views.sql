-- Read-only analytics reporting views for open beta.
-- These views aggregate product_analytics_events without exposing raw
-- anonymous_id, session_id, user_id, or local_cat_id values.

create or replace view public.analytics_event_health_24h
with (security_invoker = true) as
select
  name,
  count(*)::int as event_count,
  count(distinct anonymous_id)::int as user_count,
  count(distinct session_id)::int as session_count,
  max(created_at) as latest_created_at
from public.product_analytics_events
where created_at >= now() - interval '24 hours'
group by name;

comment on view public.analytics_event_health_24h is
  'Open beta event health by event name for the last 24 hours. Aggregated only.';

create or replace view public.analytics_daily_metrics_30d
with (security_invoker = true) as
select
  date_trunc('day', created_at at time zone 'Asia/Tokyo')::date as day_jst,
  coalesce(source, 'unknown') as source,
  nullif(properties->>'utm_source', '') as utm_source,
  nullif(properties->>'utm_campaign', '') as utm_campaign,
  count(*)::int as event_count,
  count(distinct anonymous_id)::int as user_count,
  count(distinct session_id)::int as session_count,
  count(distinct anonymous_id) filter (where name = 'diagnosis_onboarding_started')::int as diagnosis_started_users,
  count(distinct anonymous_id) filter (where name = 'diagnosis_onboarding_completed')::int as diagnosis_completed_users,
  count(distinct anonymous_id) filter (where name = 'home_viewed')::int as home_viewed_users,
  count(distinct anonymous_id) filter (where name = 'home_mikke_recorded')::int as mikke_recorded_users,
  count(distinct anonymous_id) filter (where name = 'home_care_recorded')::int as care_recorded_users,
  count(distinct anonymous_id) filter (where name = 'home_photo_added')::int as photo_added_users,
  count(distinct anonymous_id) filter (where name = 'torisetu_viewed')::int as torisetu_viewed_users,
  count(distinct anonymous_id) filter (where name = 'torisetu_result_card_opened')::int as torisetu_result_opened_users,
  count(distinct anonymous_id) filter (where name = 'collection_viewed')::int as collection_viewed_users,
  count(distinct anonymous_id) filter (where name = 'collection_photo_added')::int as collection_photo_added_users,
  count(distinct anonymous_id) filter (where name = 'account_create_cta_viewed')::int as account_cta_viewed_users,
  count(distinct anonymous_id) filter (where name = 'account_create_cta_clicked')::int as account_cta_clicked_users,
  count(distinct anonymous_id) filter (where name = 'auth_google_succeeded')::int as auth_succeeded_users,
  count(distinct anonymous_id) filter (where name = 'settings_account_sync_completed')::int as account_sync_completed_users,
  count(distinct anonymous_id) filter (
    where name in ('settings_account_restore_completed', 'account_restore_prompt_restore_completed')
  )::int as account_restore_completed_users
from public.product_analytics_events
where created_at >= now() - interval '30 days'
group by day_jst, source, utm_source, utm_campaign;

comment on view public.analytics_daily_metrics_30d is
  'Daily open beta metrics by JST day, source, and campaign for the last 30 days. Aggregated only.';

create or replace view public.analytics_open_beta_funnel_30d
with (security_invoker = true) as
with users as (
  select
    anonymous_id,
    bool_or(name = 'diagnosis_onboarding_started') as diagnosis_started,
    bool_or(name = 'diagnosis_name_submitted') as diagnosis_name_submitted,
    bool_or(name in ('diagnosis_photo_added', 'diagnosis_photo_skipped')) as diagnosis_photo_step_done,
    bool_or(name in ('diagnosis_basic_info_submitted', 'diagnosis_basic_info_skipped')) as diagnosis_basic_info_done,
    bool_or(name = 'diagnosis_final_result_viewed') as diagnosis_final_viewed,
    bool_or(name = 'diagnosis_result_saved') as diagnosis_result_saved,
    bool_or(name = 'diagnosis_onboarding_completed') as diagnosis_completed,
    bool_or(name = 'home_viewed') as home_viewed,
    bool_or(name = 'home_mikke_recorded') as mikke_recorded,
    bool_or(name = 'home_care_recorded') as care_recorded,
    bool_or(name = 'home_photo_added') as photo_added,
    bool_or(name = 'torisetu_viewed') as torisetu_viewed,
    bool_or(name = 'torisetu_result_card_opened') as torisetu_result_opened,
    bool_or(name = 'collection_viewed') as collection_viewed,
    bool_or(name = 'collection_photo_added') as collection_photo_added,
    bool_or(name = 'account_create_cta_viewed') as account_cta_viewed,
    bool_or(name = 'account_create_cta_clicked') as account_cta_clicked,
    bool_or(name = 'auth_google_started') as auth_started,
    bool_or(name = 'auth_google_succeeded') as auth_succeeded,
    bool_or(name = 'settings_account_sync_completed') as account_sync_completed,
    bool_or(name in ('settings_account_restore_completed', 'account_restore_prompt_restore_completed')) as account_restore_completed
  from public.product_analytics_events
  where created_at >= now() - interval '30 days'
  group by anonymous_id
),
funnel as (
  select
    count(*) filter (where diagnosis_started)::int as diagnosis_started_users,
    count(*) filter (where diagnosis_name_submitted)::int as diagnosis_name_submitted_users,
    count(*) filter (where diagnosis_photo_step_done)::int as diagnosis_photo_step_done_users,
    count(*) filter (where diagnosis_basic_info_done)::int as diagnosis_basic_info_done_users,
    count(*) filter (where diagnosis_final_viewed)::int as diagnosis_final_viewed_users,
    count(*) filter (where diagnosis_result_saved)::int as diagnosis_result_saved_users,
    count(*) filter (where diagnosis_completed)::int as diagnosis_completed_users,
    count(*) filter (where home_viewed)::int as home_viewed_users,
    count(*) filter (where mikke_recorded)::int as mikke_recorded_users,
    count(*) filter (where care_recorded)::int as care_recorded_users,
    count(*) filter (where photo_added)::int as photo_added_users,
    count(*) filter (where torisetu_viewed)::int as torisetu_viewed_users,
    count(*) filter (where torisetu_result_opened)::int as torisetu_result_opened_users,
    count(*) filter (where collection_viewed)::int as collection_viewed_users,
    count(*) filter (where collection_photo_added)::int as collection_photo_added_users,
    count(*) filter (where account_cta_viewed)::int as account_cta_viewed_users,
    count(*) filter (where account_cta_clicked)::int as account_cta_clicked_users,
    count(*) filter (where auth_started)::int as auth_started_users,
    count(*) filter (where auth_succeeded)::int as auth_succeeded_users,
    count(*) filter (where account_sync_completed)::int as account_sync_completed_users,
    count(*) filter (where account_restore_completed)::int as account_restore_completed_users
  from users
)
select
  *,
  round(100.0 * diagnosis_completed_users / nullif(diagnosis_started_users, 0), 1) as diagnosis_completion_rate,
  round(100.0 * mikke_recorded_users / nullif(diagnosis_completed_users, 0), 1) as completed_to_mikke_rate,
  round(100.0 * account_cta_clicked_users / nullif(account_cta_viewed_users, 0), 1) as account_cta_click_rate,
  round(100.0 * auth_succeeded_users / nullif(auth_started_users, 0), 1) as auth_success_rate,
  round(100.0 * account_sync_completed_users / nullif(auth_succeeded_users, 0), 1) as auth_to_sync_rate,
  round(100.0 * account_restore_completed_users / nullif(auth_succeeded_users, 0), 1) as auth_to_restore_rate
from funnel;

comment on view public.analytics_open_beta_funnel_30d is
  'Open beta user funnel for the last 30 days. Aggregated only.';

create or replace view public.analytics_feature_engagement_7d
with (security_invoker = true) as
select
  case
    when name like 'diagnosis_%' then 'diagnosis'
    when name like 'home_%' then 'home'
    when name like 'torisetu_%' then 'torisetu'
    when name like 'collection_%' then 'collection'
    when name like 'account_%' or name like 'auth_%' or name like 'settings_account_%' then 'account'
    else 'other'
  end as area,
  name,
  count(*)::int as event_count,
  count(distinct anonymous_id)::int as user_count,
  count(distinct session_id)::int as session_count,
  max(created_at) as latest_created_at
from public.product_analytics_events
where created_at >= now() - interval '7 days'
group by area, name;

comment on view public.analytics_feature_engagement_7d is
  'Feature engagement by app area and event name for the last 7 days. Aggregated only.';

create or replace view public.analytics_safe_recent_events
with (security_invoker = true) as
select
  created_at,
  occurred_at,
  name,
  route,
  coalesce(source, 'unknown') as source,
  nullif(properties->>'utm_source', '') as utm_source,
  nullif(properties->>'utm_campaign', '') as utm_campaign,
  (user_id is not null) as has_user_id,
  (local_cat_id is not null) as has_local_cat_id
from public.product_analytics_events
where created_at >= now() - interval '7 days';

comment on view public.analytics_safe_recent_events is
  'Recent events without raw user, anonymous, session, local cat, or properties payloads.';

revoke all on public.analytics_event_health_24h from anon, authenticated;
revoke all on public.analytics_daily_metrics_30d from anon, authenticated;
revoke all on public.analytics_open_beta_funnel_30d from anon, authenticated;
revoke all on public.analytics_feature_engagement_7d from anon, authenticated;
revoke all on public.analytics_safe_recent_events from anon, authenticated;
