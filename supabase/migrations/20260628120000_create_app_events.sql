-- Generic app KPI event sink for Instagram launch.
-- Do not store photo URLs, signed URLs, cat names, locations, email addresses,
-- IP addresses, or full user agents in this table.

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  source text null default 'unknown',
  anonymous_id text null,
  user_id uuid null,
  session_id text null,
  submission_id text null,
  cat_id text null,
  photo_id text null,
  delivery_photo_id text null,
  route text null,
  surface text null,
  is_in_app_browser boolean null,
  is_standalone_pwa boolean null,
  error_code text null,
  error_message text null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint app_events_source_check
    check (source in (
      'instagram',
      'instagram_story',
      'instagram_bio',
      'instagram_dm',
      'direct',
      'unknown'
    )),
  constraint app_events_identity_check
    check (anonymous_id is not null or user_id is not null)
);

create index if not exists app_events_event_created_at_idx
  on public.app_events (event_name, created_at desc);

create index if not exists app_events_source_created_at_idx
  on public.app_events (source, created_at desc);

create index if not exists app_events_anonymous_created_at_idx
  on public.app_events (anonymous_id, created_at desc)
  where anonymous_id is not null;

create index if not exists app_events_user_created_at_idx
  on public.app_events (user_id, created_at desc)
  where user_id is not null;

create index if not exists app_events_submission_created_at_idx
  on public.app_events (submission_id, created_at desc)
  where submission_id is not null;

alter table public.app_events enable row level security;

create policy "anon can insert app events"
  on public.app_events
  for insert
  to anon
  with check (true);

create policy "authenticated can insert app events"
  on public.app_events
  for insert
  to authenticated
  with check (true);

grant usage on schema public to anon, authenticated;
grant insert on table public.app_events to anon, authenticated;

create or replace view public.analytics_app_event_health_24h
with (security_invoker = true) as
select
  event_name,
  count(*)::int as event_count,
  count(distinct coalesce(user_id::text, anonymous_id))::int as user_count,
  count(distinct session_id)::int as session_count,
  max(created_at) as latest_created_at
from public.app_events
where created_at >= now() - interval '24 hours'
group by event_name;

create or replace view public.analytics_launch_kpi_28d
with (security_invoker = true) as
with events as (
  select
    date_trunc('day', created_at at time zone 'Asia/Tokyo')::date as day_jst,
    coalesce(user_id::text, anonymous_id) as actor_id,
    coalesce(source, 'unknown') as source,
    event_name,
    created_at
  from public.app_events
  where created_at >= now() - interval '28 days'
),
daily_user_flags as (
  select
    day_jst,
    actor_id,
    bool_or(event_name in ('onboarding_photo_submitted', 'home_photo_submitted', 'photo_submitted')) as photo_submitted,
    bool_or(event_name in ('onboarding_delivery_opened', 'delivery_opened')) as delivery_opened
  from events
  where actor_id is not null
  group by day_jst, actor_id
)
select
  day_jst,
  count(distinct actor_id) filter (where photo_submitted and delivery_opened)::int
    as completed_delivery_user_count,
  count(distinct actor_id) filter (where photo_submitted)::int
    as photo_submitter_count,
  count(distinct actor_id) filter (where delivery_opened)::int
    as delivery_opener_count,
  round(
    100.0
      * count(distinct actor_id) filter (where photo_submitted and delivery_opened)
      / nullif(count(distinct actor_id) filter (where photo_submitted), 0),
    1
  ) as delivery_open_rate
from daily_user_flags
group by day_jst
order by day_jst desc;

comment on table public.app_events is
  'Generic app KPI events for Instagram launch. Privacy-sensitive data must not be stored.';
comment on view public.analytics_launch_kpi_28d is
  'Daily launch KPI summary centered on completed_delivery_user_count.';

revoke all on public.analytics_app_event_health_24h from anon, authenticated;
revoke all on public.analytics_launch_kpi_28d from anon, authenticated;
