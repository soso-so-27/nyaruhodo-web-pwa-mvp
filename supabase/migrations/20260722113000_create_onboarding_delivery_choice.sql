drop index if exists public.cat_moment_deliveries_onboarding_submission_uidx;

create unique index if not exists cat_moment_deliveries_onboarding_single_submission_uidx
  on public.cat_moment_deliveries ((metadata ->> 'onboarding_submission_id'))
  where metadata ->> 'onboarding_submission_id' is not null
    and (metadata ->> 'experience_version') is distinct from 'onboarding_choice_v1';

create unique index if not exists cat_moment_deliveries_onboarding_choice_slot_uidx
  on public.cat_moment_deliveries (
    (metadata ->> 'onboarding_submission_id'),
    (metadata ->> 'delivery_position')
  )
  where metadata ->> 'onboarding_submission_id' is not null
    and metadata ->> 'experience_version' = 'onboarding_choice_v1';

comment on index public.cat_moment_deliveries_onboarding_single_submission_uidx is
  'Keeps legacy onboarding delivery idempotent at one delivery per submission.';

comment on index public.cat_moment_deliveries_onboarding_choice_slot_uidx is
  'Keeps onboarding four-photo bundles idempotent at one row per submission slot.';

create or replace function public.finalize_onboarding_delivery_choice(
  p_submission_id text,
  p_resume_token_hash text,
  p_bundle_id text,
  p_selected_local_delivery_id text
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
  v_existing_delivery_id text;
  v_existing_resolved_at timestamptz;
  v_selected_source_photo_id text;
  v_resolved_at timestamptz := now();
begin
  if p_submission_id is null
    or length(p_submission_id) < 1
    or length(p_submission_id) > 240
    or p_resume_token_hash is null
    or p_resume_token_hash !~ '^[0-9a-f]{64}$'
    or p_bundle_id is null
    or length(p_bundle_id) < 1
    or length(p_bundle_id) > 160
    or p_selected_local_delivery_id is null
    or p_selected_local_delivery_id not in (
      p_bundle_id || '-choice-1',
      p_bundle_id || '-choice-2',
      p_bundle_id || '-choice-3',
      p_bundle_id || '-choice-4'
    ) then
    raise exception using errcode = '22023', message = 'invalid_choice_request';
  end if;

  select submission.delivery_id, submission.stage_updated_at
  into v_existing_delivery_id, v_existing_resolved_at
  from public.onboarding_submissions as submission
  where submission.submission_id = p_submission_id
    and submission.resume_token_hash = p_resume_token_hash
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'onboarding_submission_forbidden';
  end if;

  if v_existing_delivery_id is not null then
    return query
    select
      'kept'::text,
      v_existing_delivery_id,
      coalesce(v_existing_resolved_at, v_resolved_at),
      false;
    return;
  end if;

  select count(*)
  into v_bundle_count
  from public.cat_moment_deliveries as delivery
  where delivery.local_delivery_id in (
      p_bundle_id || '-choice-1',
      p_bundle_id || '-choice-2',
      p_bundle_id || '-choice-3',
      p_bundle_id || '-choice-4'
    )
    and delivery.metadata ->> 'bundle_id' = p_bundle_id
    and delivery.metadata ->> 'onboarding_submission_id' = p_submission_id
    and delivery.metadata ->> 'experience_version' = 'onboarding_choice_v1';

  if v_bundle_count <> 4 then
    raise exception using errcode = 'P0002', message = 'choice_bundle_not_found';
  end if;

  select delivery.source_photo_id
  into v_selected_source_photo_id
  from public.cat_moment_deliveries as delivery
  where delivery.local_delivery_id = p_selected_local_delivery_id
    and delivery.metadata ->> 'bundle_id' = p_bundle_id
    and delivery.metadata ->> 'onboarding_submission_id' = p_submission_id
    and delivery.metadata ->> 'experience_version' = 'onboarding_choice_v1'
    and delivery.status not in ('hidden', 'reported')
  limit 1;

  if not found then
    raise exception using errcode = '22023', message = 'invalid_selection';
  end if;

  update public.onboarding_submissions as submission
  set
    delivery_id = p_selected_local_delivery_id,
    source_photo_id = v_selected_source_photo_id,
    stage = case
      when submission.stage in ('opened', 'completed') then submission.stage
      else 'delivered'
    end,
    stage_updated_at = v_resolved_at
  where submission.submission_id = p_submission_id
    and submission.resume_token_hash = p_resume_token_hash;

  update public.cat_moment_deliveries as delivery
  set status = 'kept'
  where delivery.local_delivery_id = p_selected_local_delivery_id
    and delivery.metadata ->> 'bundle_id' = p_bundle_id
    and delivery.metadata ->> 'onboarding_submission_id' = p_submission_id
    and delivery.status not in ('hidden', 'reported');

  return query
  select 'kept'::text, p_selected_local_delivery_id, v_resolved_at, true;
end;
$$;

revoke all on function public.finalize_onboarding_delivery_choice(
  text,
  text,
  text,
  text
) from public;

revoke all on function public.finalize_onboarding_delivery_choice(
  text,
  text,
  text,
  text
) from anon;

revoke all on function public.finalize_onboarding_delivery_choice(
  text,
  text,
  text,
  text
) from authenticated;

grant execute on function public.finalize_onboarding_delivery_choice(
  text,
  text,
  text,
  text
) to service_role;

comment on function public.finalize_onboarding_delivery_choice is
  'Atomically keeps the first valid photo selected from an onboarding four-photo bundle.';
