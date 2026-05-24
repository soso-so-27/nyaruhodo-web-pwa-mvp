-- Product analytics event sink for open beta.
-- Stores app funnel events only. Do not send cat names, email addresses,
-- image data, or free text into this table.

create table if not exists public.product_analytics_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  occurred_at timestamptz not null default now(),
  anonymous_id text not null,
  session_id text not null,
  user_id uuid null,
  local_cat_id text null,
  route text null,
  referrer text null,
  source text null default 'unknown',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint product_analytics_events_source_check
    check (source in ('sns', 'direct', 'pwa', 'unknown'))
);

create index if not exists product_analytics_events_name_created_at_idx
  on public.product_analytics_events (name, created_at desc);

create index if not exists product_analytics_events_anonymous_id_created_at_idx
  on public.product_analytics_events (anonymous_id, created_at desc);

create index if not exists product_analytics_events_session_id_created_at_idx
  on public.product_analytics_events (session_id, created_at desc);

create index if not exists product_analytics_events_local_cat_id_created_at_idx
  on public.product_analytics_events (local_cat_id, created_at desc);

create index if not exists product_analytics_events_user_id_created_at_idx
  on public.product_analytics_events (user_id, created_at desc)
  where user_id is not null;

alter table public.product_analytics_events enable row level security;

create policy "anon can insert product analytics events"
  on public.product_analytics_events
  for insert
  to anon
  with check (true);

create policy "authenticated can insert product analytics events"
  on public.product_analytics_events
  for insert
  to authenticated
  with check (true);

grant usage on schema public to anon, authenticated;
grant insert on table public.product_analytics_events to anon, authenticated;
