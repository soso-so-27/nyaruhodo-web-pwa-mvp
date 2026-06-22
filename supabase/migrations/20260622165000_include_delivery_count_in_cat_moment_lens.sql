drop function if exists public.get_cat_moments_for_cat(uuid);

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
  delivery_count integer,
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
    cat_moments.delivery_count,
    cat_moment_cats.is_primary,
    cat_moments.captured_at,
    cat_moments.created_at
  from public.cat_moment_cats
  join public.cat_moments
    on cat_moments.id = cat_moment_cats.cat_moment_id
  where cat_moment_cats.cat_id = p_cat_id
  order by cat_moments.created_at desc;
$$;

grant execute on function public.get_cat_moments_for_cat(uuid) to authenticated;
