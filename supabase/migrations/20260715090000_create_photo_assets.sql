create table if not exists public.photo_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_asset_id text not null,
  source_surface text not null,
  cat_id text,
  display_storage_path text,
  original_storage_path text not null,
  original_file_name text not null,
  original_mime_type text not null,
  original_bytes bigint not null check (original_bytes > 0),
  pixel_width integer check (pixel_width is null or pixel_width > 0),
  pixel_height integer check (pixel_height is null or pixel_height > 0),
  file_last_modified_at timestamptz,
  captured_at timestamptz not null,
  status text not null default 'pending',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photo_assets_source_surface_check check (
    source_surface in (
      'sleeping',
      'onboarding',
      'cat_gallery',
      'collection',
      'cover',
      'home_cover'
    )
  ),
  constraint photo_assets_status_check check (
    status in ('pending', 'ready', 'failed')
  ),
  constraint photo_assets_owner_surface_local_unique unique (
    user_id,
    source_surface,
    local_asset_id
  )
);

create index if not exists photo_assets_user_captured_at_idx
on public.photo_assets(user_id, captured_at desc);

create index if not exists photo_assets_display_storage_path_idx
on public.photo_assets(user_id, display_storage_path)
where display_storage_path is not null;

drop trigger if exists set_photo_assets_updated_at on public.photo_assets;
create trigger set_photo_assets_updated_at
before update on public.photo_assets
for each row
execute function public.set_updated_at();

alter table public.photo_assets enable row level security;

create policy "photo_assets_select_own"
on public.photo_assets
for select
to authenticated
using (user_id = auth.uid());

create policy "photo_assets_insert_own"
on public.photo_assets
for insert
to authenticated
with check (user_id = auth.uid());

create policy "photo_assets_update_own"
on public.photo_assets
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "photo_assets_delete_own"
on public.photo_assets
for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.photo_assets to authenticated;
grant select, insert, update, delete on public.photo_assets to service_role;

update storage.buckets
set
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'image/avif',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
where id in ('cat-photos', 'cat-photos-backup');
