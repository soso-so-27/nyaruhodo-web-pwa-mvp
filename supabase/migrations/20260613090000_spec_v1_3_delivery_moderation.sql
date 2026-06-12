alter table public.cat_moments
  add column if not exists moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by text,
  add column if not exists delivery_count integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cat_moments'
      and column_name = 'pool_date'
  ) then
    begin
      execute 'alter table public.cat_moments add column pool_date date generated always as (((created_at at time zone ''UTC'') + interval ''13 hours'')::date) stored';
    exception
      when others then
        execute 'alter table public.cat_moments add column pool_date date';
        execute 'update public.cat_moments set pool_date = ((created_at at time zone ''UTC'') + interval ''13 hours'')::date where pool_date is null';
        execute 'alter table public.cat_moments alter column pool_date set not null';
    end;
  end if;
end $$;

create or replace function public.set_cat_moment_pool_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.pool_date = ((new.created_at at time zone 'UTC') + interval '13 hours')::date;
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cat_moments'
      and column_name = 'pool_date'
      and is_generated = 'NEVER'
  ) then
    drop trigger if exists set_cat_moment_pool_date on public.cat_moments;
    create trigger set_cat_moment_pool_date
    before insert or update of created_at on public.cat_moments
    for each row
    execute function public.set_cat_moment_pool_date();
  end if;
end $$;

update public.cat_moments
set
  moderation_status = 'approved',
  moderated_at = coalesce(moderated_at, now()),
  moderated_by = coalesce(moderated_by, 'system:admin-stock-backfill')
where local_moment_id like 'stock-sleeping-%'
  and moderation_status = 'pending';

create index if not exists idx_cat_moments_moderation
on public.cat_moments (moderation_status, delivery_status, visibility);

create index if not exists idx_cat_moments_pool
on public.cat_moments (pool_date, moderation_status, delivery_status, visibility);

create index if not exists idx_cat_moments_delivery_tier
on public.cat_moments (visibility, delivery_status, moderation_status, delivery_count, created_at desc);

create index if not exists idx_deliveries_user_source
on public.cat_moment_deliveries (user_id, source_moment_id)
where user_id is not null;

create index if not exists idx_deliveries_anon_source
on public.cat_moment_deliveries (anonymous_id, source_moment_id)
where anonymous_id is not null;

do $$
declare
  before_cutoff date;
  after_cutoff date;
begin
  before_cutoff := ((timestamp with time zone '2026-06-13 10:59:00+00') at time zone 'UTC' + interval '13 hours')::date;
  after_cutoff := ((timestamp with time zone '2026-06-13 11:00:00+00') at time zone 'UTC' + interval '13 hours')::date;

  if before_cutoff <> date '2026-06-13' then
    raise exception 'pool_date boundary check failed for 19:59 JST: %', before_cutoff;
  end if;

  if after_cutoff <> date '2026-06-14' then
    raise exception 'pool_date boundary check failed for 20:00 JST: %', after_cutoff;
  end if;
end $$;
