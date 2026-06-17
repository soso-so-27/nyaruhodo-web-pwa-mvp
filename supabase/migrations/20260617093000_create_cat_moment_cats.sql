create table if not exists public.cat_moment_cats (
  cat_moment_id uuid not null references public.cat_moments(id) on delete cascade,
  cat_id uuid not null references public.cats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (cat_moment_id, cat_id),
  constraint cat_moment_cats_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists cat_moment_cats_primary_moment_uidx
on public.cat_moment_cats(cat_moment_id)
where is_primary;

create index if not exists cat_moment_cats_cat_created_at_idx
on public.cat_moment_cats(cat_id, created_at desc);

create index if not exists cat_moment_cats_user_cat_idx
on public.cat_moment_cats(user_id, cat_id);

drop trigger if exists set_cat_moment_cats_updated_at on public.cat_moment_cats;
create trigger set_cat_moment_cats_updated_at
before update on public.cat_moment_cats
for each row
execute function public.set_updated_at();

alter table public.cat_moment_cats enable row level security;

drop policy if exists "cat_moment_cats_select_own" on public.cat_moment_cats;
create policy "cat_moment_cats_select_own"
on public.cat_moment_cats
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cat_moments
    where cat_moments.id = cat_moment_cats.cat_moment_id
      and cat_moments.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.cats
    where cats.id = cat_moment_cats.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

drop policy if exists "cat_moment_cats_insert_own" on public.cat_moment_cats;
create policy "cat_moment_cats_insert_own"
on public.cat_moment_cats
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cat_moments
    where cat_moments.id = cat_moment_cats.cat_moment_id
      and cat_moments.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.cats
    where cats.id = cat_moment_cats.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

drop policy if exists "cat_moment_cats_update_own" on public.cat_moment_cats;
create policy "cat_moment_cats_update_own"
on public.cat_moment_cats
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cat_moments
    where cat_moments.id = cat_moment_cats.cat_moment_id
      and cat_moments.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.cats
    where cats.id = cat_moment_cats.cat_id
      and cats.owner_user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cat_moments
    where cat_moments.id = cat_moment_cats.cat_moment_id
      and cat_moments.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.cats
    where cats.id = cat_moment_cats.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

drop policy if exists "cat_moment_cats_delete_own" on public.cat_moment_cats;
create policy "cat_moment_cats_delete_own"
on public.cat_moment_cats
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cat_moments
    where cat_moments.id = cat_moment_cats.cat_moment_id
      and cat_moments.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.cats
    where cats.id = cat_moment_cats.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

grant select, insert, update, delete on public.cat_moment_cats to authenticated;

insert into public.cat_moment_cats (
  cat_moment_id,
  cat_id,
  user_id,
  is_primary,
  metadata,
  created_at,
  updated_at
)
select
  cat_moments.id,
  cats.id,
  cat_moments.user_id,
  true,
  jsonb_build_object(
    'source', 'owner_cat_id_backfill',
    'owner_cat_id', cat_moments.owner_cat_id
  ),
  cat_moments.created_at,
  now()
from public.cat_moments
join public.cats
  on cats.owner_user_id = cat_moments.user_id
  and (
    cats.local_cat_id = cat_moments.owner_cat_id
    or cats.id::text = cat_moments.owner_cat_id
  )
where cat_moments.user_id is not null
  and cat_moments.owner_cat_id is not null
on conflict (cat_moment_id, cat_id) do update
set
  is_primary = public.cat_moment_cats.is_primary or excluded.is_primary,
  metadata = public.cat_moment_cats.metadata || excluded.metadata,
  updated_at = now();

create or replace function public.get_cats_for_cat_moment(p_cat_moment_id uuid)
returns table (
  cat_id uuid,
  local_cat_id text,
  name text,
  is_primary boolean,
  linked_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    cats.id as cat_id,
    cats.local_cat_id,
    cats.name,
    cat_moment_cats.is_primary,
    cat_moment_cats.created_at as linked_at
  from public.cat_moment_cats
  join public.cats
    on cats.id = cat_moment_cats.cat_id
  where cat_moment_cats.cat_moment_id = p_cat_moment_id
  order by cat_moment_cats.is_primary desc, cats.name asc, cats.created_at asc;
$$;

create or replace function public.get_cat_moments_for_cat(p_cat_id uuid)
returns table (
  cat_moment_id uuid,
  local_moment_id text,
  local_cat_id text,
  owner_cat_id text,
  photo_url text,
  state text,
  visibility text,
  delivery_status text,
  is_primary boolean,
  captured_at timestamptz,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    cat_moments.id as cat_moment_id,
    cat_moments.local_moment_id,
    cat_moments.local_cat_id,
    cat_moments.owner_cat_id,
    cat_moments.photo_url,
    cat_moments.state,
    cat_moments.visibility,
    cat_moments.delivery_status,
    cat_moment_cats.is_primary,
    cat_moments.captured_at,
    cat_moments.created_at
  from public.cat_moment_cats
  join public.cat_moments
    on cat_moments.id = cat_moment_cats.cat_moment_id
  where cat_moment_cats.cat_id = p_cat_id
  order by cat_moments.created_at desc;
$$;

grant execute on function public.get_cats_for_cat_moment(uuid) to authenticated;
grant execute on function public.get_cat_moments_for_cat(uuid) to authenticated;
