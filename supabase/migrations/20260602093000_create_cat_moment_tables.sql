create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.cat_moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_id text,
  local_moment_id text not null,
  local_cat_id text not null,
  owner_cat_id text not null,
  photo_url text not null,
  state text not null,
  visibility text not null,
  delivery_status text not null default 'available',
  source_moment_id text,
  metadata jsonb not null default '{}'::jsonb,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cat_moments_identity_check
    check (user_id is not null or anonymous_id is not null),
  constraint cat_moments_state_check
    check (state in ('sleeping')),
  constraint cat_moments_visibility_check
    check (visibility in ('private', 'shared')),
  constraint cat_moments_delivery_status_check
    check (delivery_status in ('available', 'hidden', 'reported')),
  constraint cat_moments_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists cat_moments_user_local_moment_uidx
on public.cat_moments(user_id, local_moment_id)
where user_id is not null;

create unique index if not exists cat_moments_anonymous_local_moment_uidx
on public.cat_moments(anonymous_id, local_moment_id)
where user_id is null;

create index if not exists cat_moments_local_cat_created_at_idx
on public.cat_moments(local_cat_id, created_at desc);

create index if not exists cat_moments_delivery_pool_idx
on public.cat_moments(visibility, delivery_status, created_at desc);

create index if not exists cat_moments_source_moment_idx
on public.cat_moments(source_moment_id);

drop trigger if exists set_cat_moments_updated_at on public.cat_moments;
create trigger set_cat_moments_updated_at
before update on public.cat_moments
for each row
execute function public.set_updated_at();

create table if not exists public.cat_moment_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id text,
  local_delivery_id text not null,
  source_moment_id text,
  source_photo_id text,
  recipient_local_cat_id text,
  photo_url text not null,
  status text not null default 'delivered',
  metadata jsonb not null default '{}'::jsonb,
  delivered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cat_moment_deliveries_identity_check
    check (user_id is not null or anonymous_id is not null),
  constraint cat_moment_deliveries_status_check
    check (status in ('delivered', 'kept', 'dismissed', 'hidden', 'reported')),
  constraint cat_moment_deliveries_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists cat_moment_deliveries_user_local_delivery_uidx
on public.cat_moment_deliveries(user_id, local_delivery_id)
where user_id is not null;

create unique index if not exists cat_moment_deliveries_anonymous_local_delivery_uidx
on public.cat_moment_deliveries(anonymous_id, local_delivery_id)
where user_id is null;

create index if not exists cat_moment_deliveries_source_moment_idx
on public.cat_moment_deliveries(source_moment_id);

create index if not exists cat_moment_deliveries_source_photo_idx
on public.cat_moment_deliveries(source_photo_id);

create index if not exists cat_moment_deliveries_recipient_idx
on public.cat_moment_deliveries(recipient_local_cat_id, delivered_at desc);

drop trigger if exists set_cat_moment_deliveries_updated_at on public.cat_moment_deliveries;
create trigger set_cat_moment_deliveries_updated_at
before update on public.cat_moment_deliveries
for each row
execute function public.set_updated_at();

alter table public.cat_moments enable row level security;
alter table public.cat_moment_deliveries enable row level security;

drop policy if exists "cat_moments_select_own" on public.cat_moments;
create policy "cat_moments_select_own"
on public.cat_moments
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "cat_moments_insert_own" on public.cat_moments;
create policy "cat_moments_insert_own"
on public.cat_moments
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "cat_moments_insert_anonymous_backup" on public.cat_moments;
create policy "cat_moments_insert_anonymous_backup"
on public.cat_moments
for insert
to anon
with check (user_id is null and anonymous_id is not null);

drop policy if exists "cat_moments_update_own" on public.cat_moments;
create policy "cat_moments_update_own"
on public.cat_moments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "cat_moments_delete_own" on public.cat_moments;
create policy "cat_moments_delete_own"
on public.cat_moments
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "cat_moment_deliveries_select_own" on public.cat_moment_deliveries;
create policy "cat_moment_deliveries_select_own"
on public.cat_moment_deliveries
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "cat_moment_deliveries_insert_own" on public.cat_moment_deliveries;
create policy "cat_moment_deliveries_insert_own"
on public.cat_moment_deliveries
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "cat_moment_deliveries_insert_anonymous_backup" on public.cat_moment_deliveries;
create policy "cat_moment_deliveries_insert_anonymous_backup"
on public.cat_moment_deliveries
for insert
to anon
with check (user_id is null and anonymous_id is not null);

drop policy if exists "cat_moment_deliveries_update_own" on public.cat_moment_deliveries;
create policy "cat_moment_deliveries_update_own"
on public.cat_moment_deliveries
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "cat_moment_deliveries_delete_own" on public.cat_moment_deliveries;
create policy "cat_moment_deliveries_delete_own"
on public.cat_moment_deliveries
for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.cat_moments to authenticated;
grant insert on public.cat_moments to anon;

grant select, insert, update, delete on public.cat_moment_deliveries to authenticated;
grant insert on public.cat_moment_deliveries to anon;
