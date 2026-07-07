alter table public.cats
  add column if not exists cover_storage_path text,
  add column if not exists cover_crop jsonb;

update public.cats
set cover_storage_path = avatar_storage_path
where cover_storage_path is null
  and avatar_storage_path is not null;

alter table public.cats
  add constraint cats_cover_crop_object
  check (cover_crop is null or jsonb_typeof(cover_crop) = 'object')
  not valid;

alter table public.cats
  validate constraint cats_cover_crop_object;
