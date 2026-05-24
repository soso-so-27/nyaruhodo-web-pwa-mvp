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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create table if not exists public.cats (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  local_cat_id text,
  name text not null,
  type_key text,
  type_label text,
  type_tagline text,
  basic_info jsonb not null default '{}'::jsonb,
  appearance jsonb not null default '{}'::jsonb,
  axis_scores jsonb not null default '{}'::jsonb,
  activity_pattern jsonb not null default '{}'::jsonb,
  type_scores jsonb not null default '{}'::jsonb,
  modifiers jsonb not null default '[]'::jsonb,
  onboarding jsonb not null default '{}'::jsonb,
  understanding jsonb not null default '{}'::jsonb,
  avatar_storage_path text,
  home_photo_storage_path text,
  home_photo_position text,
  metadata jsonb not null default '{}'::jsonb,
  local_created_at timestamptz,
  local_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cats_basic_info_object check (jsonb_typeof(basic_info) = 'object'),
  constraint cats_appearance_object check (jsonb_typeof(appearance) = 'object'),
  constraint cats_axis_scores_object check (jsonb_typeof(axis_scores) = 'object'),
  constraint cats_activity_pattern_object check (jsonb_typeof(activity_pattern) = 'object'),
  constraint cats_type_scores_object check (jsonb_typeof(type_scores) = 'object'),
  constraint cats_modifiers_array check (jsonb_typeof(modifiers) = 'array'),
  constraint cats_onboarding_object check (jsonb_typeof(onboarding) = 'object'),
  constraint cats_understanding_object check (jsonb_typeof(understanding) = 'object'),
  constraint cats_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists cats_owner_user_id_updated_at_idx
on public.cats(owner_user_id, updated_at desc);

create unique index if not exists cats_owner_local_cat_id_uidx
on public.cats(owner_user_id, local_cat_id)
where local_cat_id is not null;

drop trigger if exists set_cats_updated_at on public.cats;
create trigger set_cats_updated_at
before update on public.cats
for each row
execute function public.set_updated_at();

create table if not exists public.record_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cat_id uuid not null references public.cats(id) on delete cascade,
  local_cat_id text,
  local_record_id text,
  record_type text not null,
  value text not null,
  label text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint record_logs_record_type_check
    check (record_type in ('yousu', 'mugi', 'reaction', 'photo')),
  constraint record_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists record_logs_user_occurred_at_idx
on public.record_logs(user_id, occurred_at desc);

create index if not exists record_logs_cat_occurred_at_idx
on public.record_logs(cat_id, occurred_at desc);

create unique index if not exists record_logs_user_local_record_id_uidx
on public.record_logs(user_id, local_record_id)
where local_record_id is not null;

create table if not exists public.collection_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cat_id uuid not null references public.cats(id) on delete cascade,
  local_cat_id text,
  local_photo_id text,
  slot_slug text not null,
  group_id text,
  storage_path text not null,
  metadata jsonb not null default '{}'::jsonb,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  constraint collection_photos_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists collection_photos_user_created_at_idx
on public.collection_photos(user_id, created_at desc);

create index if not exists collection_photos_cat_slot_idx
on public.collection_photos(cat_id, slot_slug, created_at desc);

create unique index if not exists collection_photos_user_local_photo_id_uidx
on public.collection_photos(user_id, local_photo_id)
where local_photo_id is not null;

create table if not exists public.account_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_pull_at timestamptz,
  last_push_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_sync_state_metadata_object check (jsonb_typeof(metadata) = 'object')
);

drop trigger if exists set_account_sync_state_updated_at on public.account_sync_state;
create trigger set_account_sync_state_updated_at
before update on public.account_sync_state
for each row
execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cat-photos',
  'cat-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.profiles enable row level security;
alter table public.cats enable row level security;
alter table public.record_logs enable row level security;
alter table public.collection_photos enable row level security;
alter table public.account_sync_state enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_delete_own"
on public.profiles
for delete
to authenticated
using (id = auth.uid());

create policy "cats_select_own"
on public.cats
for select
to authenticated
using (owner_user_id = auth.uid());

create policy "cats_insert_own"
on public.cats
for insert
to authenticated
with check (owner_user_id = auth.uid());

create policy "cats_update_own"
on public.cats
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "cats_delete_own"
on public.cats
for delete
to authenticated
using (owner_user_id = auth.uid());

create policy "record_logs_select_own"
on public.record_logs
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = record_logs.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "record_logs_insert_own"
on public.record_logs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = record_logs.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "record_logs_update_own"
on public.record_logs
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = record_logs.cat_id
      and cats.owner_user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = record_logs.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "record_logs_delete_own"
on public.record_logs
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = record_logs.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "collection_photos_select_own"
on public.collection_photos
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = collection_photos.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "collection_photos_insert_own"
on public.collection_photos
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = collection_photos.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "collection_photos_update_own"
on public.collection_photos
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = collection_photos.cat_id
      and cats.owner_user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = collection_photos.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "collection_photos_delete_own"
on public.collection_photos
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = collection_photos.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "account_sync_state_select_own"
on public.account_sync_state
for select
to authenticated
using (user_id = auth.uid());

create policy "account_sync_state_insert_own"
on public.account_sync_state
for insert
to authenticated
with check (user_id = auth.uid());

create policy "account_sync_state_update_own"
on public.account_sync_state
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "account_sync_state_delete_own"
on public.account_sync_state
for delete
to authenticated
using (user_id = auth.uid());

create policy "cat_photos_select_own_folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'cat-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "cat_photos_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'cat-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "cat_photos_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'cat-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'cat-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "cat_photos_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'cat-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.cats to authenticated;
grant select, insert, update, delete on public.record_logs to authenticated;
grant select, insert, update, delete on public.collection_photos to authenticated;
grant select, insert, update, delete on public.account_sync_state to authenticated;

