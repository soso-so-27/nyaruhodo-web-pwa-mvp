create table if not exists public.evening_delivery_choice_resolutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_id text,
  bundle_id text not null,
  delivery_date_key date not null,
  outcome text not null,
  selected_local_delivery_id text,
  resolved_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint evening_delivery_choice_identity_xor
    check (num_nonnulls(user_id, anonymous_id) = 1),
  constraint evening_delivery_choice_outcome_check
    check (outcome in ('kept', 'skipped', 'expired')),
  constraint evening_delivery_choice_selection_check
    check (
      (outcome = 'kept' and selected_local_delivery_id is not null)
      or
      (outcome in ('skipped', 'expired') and selected_local_delivery_id is null)
    ),
  constraint evening_delivery_choice_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists evening_delivery_choice_user_bundle_uidx
on public.evening_delivery_choice_resolutions (user_id, bundle_id)
where user_id is not null;

create unique index if not exists evening_delivery_choice_anon_bundle_uidx
on public.evening_delivery_choice_resolutions (anonymous_id, bundle_id)
where user_id is null;

create index if not exists evening_delivery_choice_user_resolved_idx
on public.evening_delivery_choice_resolutions (user_id, resolved_at desc)
where user_id is not null;

create index if not exists evening_delivery_choice_anon_resolved_idx
on public.evening_delivery_choice_resolutions (anonymous_id, resolved_at desc)
where user_id is null;

alter table public.evening_delivery_choice_resolutions enable row level security;

revoke all on public.evening_delivery_choice_resolutions from public;
revoke all on public.evening_delivery_choice_resolutions from anon;
revoke all on public.evening_delivery_choice_resolutions from authenticated;
grant select, insert, update, delete
on public.evening_delivery_choice_resolutions to service_role;

create or replace function public.finalize_evening_delivery_choice(
  p_user_id uuid,
  p_anonymous_id text,
  p_bundle_id text,
  p_delivery_date_key date,
  p_outcome text,
  p_selected_local_delivery_id text default null
)
returns table (
  outcome text,
  selected_local_delivery_id text,
  resolved_at timestamptz,
  applied boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bundle_count integer;
  v_cutoff timestamptz;
  v_outcome text;
  v_selected_local_delivery_id text;
  v_resolved_at timestamptz;
begin
  if num_nonnulls(p_user_id, p_anonymous_id) <> 1 then
    raise exception using errcode = '22023', message = 'invalid_identity';
  end if;

  if p_bundle_id is null or length(p_bundle_id) < 1 or length(p_bundle_id) > 160 then
    raise exception using errcode = '22023', message = 'invalid_bundle';
  end if;

  if p_outcome not in ('kept', 'skipped') then
    raise exception using errcode = '22023', message = 'invalid_outcome';
  end if;

  if (p_outcome = 'kept') <> (p_selected_local_delivery_id is not null) then
    raise exception using errcode = '22023', message = 'invalid_selection';
  end if;

  perform delivery.id
  from public.cat_moment_deliveries as delivery
  where (
      (p_user_id is not null and delivery.user_id = p_user_id)
      or
      (
        p_user_id is null
        and delivery.user_id is null
        and delivery.anonymous_id = p_anonymous_id
      )
    )
    and delivery.local_delivery_id = any(array[
      p_bundle_id || '-choice-1',
      p_bundle_id || '-choice-2',
      p_bundle_id || '-choice-3',
      p_bundle_id || '-choice-4'
    ])
  order by delivery.local_delivery_id
  for update;

  select
    resolution.outcome,
    resolution.selected_local_delivery_id,
    resolution.resolved_at
  into v_outcome, v_selected_local_delivery_id, v_resolved_at
  from public.evening_delivery_choice_resolutions as resolution
  where (
      (p_user_id is not null and resolution.user_id = p_user_id)
      or
      (
        p_user_id is null
        and resolution.user_id is null
        and resolution.anonymous_id = p_anonymous_id
      )
    )
    and resolution.bundle_id = p_bundle_id
  limit 1;

  if found then
    return query
    select v_outcome, v_selected_local_delivery_id, v_resolved_at, false;
    return;
  end if;

  select count(*)
  into v_bundle_count
  from public.cat_moment_deliveries as delivery
  where (
      (p_user_id is not null and delivery.user_id = p_user_id)
      or
      (
        p_user_id is null
        and delivery.user_id is null
        and delivery.anonymous_id = p_anonymous_id
      )
    )
    and delivery.local_delivery_id = any(array[
      p_bundle_id || '-choice-1',
      p_bundle_id || '-choice-2',
      p_bundle_id || '-choice-3',
      p_bundle_id || '-choice-4'
    ]);

  if v_bundle_count <> 4 then
    raise exception using errcode = 'P0002', message = 'bundle_not_found';
  end if;

  v_cutoff := ((p_delivery_date_key + 1) + time '05:00')
    at time zone 'Asia/Tokyo';

  if now() >= v_cutoff then
    v_outcome := 'expired';
    v_selected_local_delivery_id := null;
  else
    v_outcome := p_outcome;
    v_selected_local_delivery_id := p_selected_local_delivery_id;
  end if;

  if v_outcome = 'kept' and not exists (
    select 1
    from public.cat_moment_deliveries as delivery
    where (
        (p_user_id is not null and delivery.user_id = p_user_id)
        or
        (
          p_user_id is null
          and delivery.user_id is null
          and delivery.anonymous_id = p_anonymous_id
        )
      )
      and delivery.local_delivery_id = v_selected_local_delivery_id
      and delivery.local_delivery_id = any(array[
        p_bundle_id || '-choice-1',
        p_bundle_id || '-choice-2',
        p_bundle_id || '-choice-3',
        p_bundle_id || '-choice-4'
      ])
      and delivery.status not in ('hidden', 'reported')
  ) then
    raise exception using errcode = '22023', message = 'invalid_selection';
  end if;

  insert into public.evening_delivery_choice_resolutions as resolution (
    user_id,
    anonymous_id,
    bundle_id,
    delivery_date_key,
    outcome,
    selected_local_delivery_id,
    metadata
  ) values (
    p_user_id,
    case when p_user_id is null then p_anonymous_id else null end,
    p_bundle_id,
    p_delivery_date_key,
    v_outcome,
    v_selected_local_delivery_id,
    jsonb_build_object('policy', 'first_write_wins_v1')
  )
  returning resolution.resolved_at
  into v_resolved_at;

  if v_outcome = 'kept' then
    update public.cat_moment_deliveries as delivery
    set status = 'kept'
    where (
        (p_user_id is not null and delivery.user_id = p_user_id)
        or
        (
          p_user_id is null
          and delivery.user_id is null
          and delivery.anonymous_id = p_anonymous_id
        )
      )
      and delivery.local_delivery_id = v_selected_local_delivery_id
      and delivery.status not in ('hidden', 'reported');
  end if;

  return query
  select v_outcome, v_selected_local_delivery_id, v_resolved_at, true;
end;
$$;

revoke all on function public.finalize_evening_delivery_choice(
  uuid,
  text,
  text,
  date,
  text,
  text
) from public;
revoke all on function public.finalize_evening_delivery_choice(
  uuid,
  text,
  text,
  date,
  text,
  text
) from anon;
revoke all on function public.finalize_evening_delivery_choice(
  uuid,
  text,
  text,
  date,
  text,
  text
) from authenticated;
grant execute on function public.finalize_evening_delivery_choice(
  uuid,
  text,
  text,
  date,
  text,
  text
) to service_role;

comment on table public.evening_delivery_choice_resolutions is
  'Server-authoritative first-write-wins ledger for one resolution per evening choice bundle.';

comment on function public.finalize_evening_delivery_choice is
  'Atomically validates and finalizes an evening four-choice bundle. Unselected candidates remain delivered so the recirculation policy can reuse them after cooldown.';
