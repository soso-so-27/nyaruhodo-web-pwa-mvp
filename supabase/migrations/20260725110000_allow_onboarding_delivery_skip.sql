alter table public.onboarding_submissions
  add column if not exists delivery_choice_outcome text;

update public.onboarding_submissions
set delivery_choice_outcome = 'kept'
where delivery_choice_outcome is null
  and delivery_id is not null;

alter table public.onboarding_submissions
  drop constraint if exists onboarding_submissions_delivery_choice_outcome_check;

alter table public.onboarding_submissions
  add constraint onboarding_submissions_delivery_choice_outcome_check
  check (
    delivery_choice_outcome is null
    or (
      delivery_choice_outcome = 'kept'
      and delivery_id is not null
    )
    or (
      delivery_choice_outcome = 'skipped'
      and delivery_id is null
    )
  );

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
  v_existing_outcome text;
  v_existing_delivery_id text;
  v_existing_resolved_at timestamptz;
  v_requested_outcome text;
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
    or (
      p_selected_local_delivery_id is not null
      and p_selected_local_delivery_id not in (
        p_bundle_id || '-choice-1',
        p_bundle_id || '-choice-2',
        p_bundle_id || '-choice-3',
        p_bundle_id || '-choice-4'
      )
    ) then
    raise exception using errcode = '22023', message = 'invalid_choice_request';
  end if;

  v_requested_outcome := case
    when p_selected_local_delivery_id is null then 'skipped'
    else 'kept'
  end;

  select
    submission.delivery_choice_outcome,
    submission.delivery_id,
    submission.stage_updated_at
  into
    v_existing_outcome,
    v_existing_delivery_id,
    v_existing_resolved_at
  from public.onboarding_submissions as submission
  where submission.submission_id = p_submission_id
    and submission.resume_token_hash = p_resume_token_hash
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'onboarding_submission_forbidden';
  end if;

  if v_existing_outcome is not null or v_existing_delivery_id is not null then
    return query
    select
      coalesce(v_existing_outcome, 'kept')::text,
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

  if v_requested_outcome = 'kept' then
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
  end if;

  update public.onboarding_submissions as submission
  set
    delivery_choice_outcome = v_requested_outcome,
    delivery_id = p_selected_local_delivery_id,
    source_photo_id = v_selected_source_photo_id,
    stage = case
      when submission.stage in ('opened', 'completed') then submission.stage
      else 'delivered'
    end,
    stage_updated_at = v_resolved_at
  where submission.submission_id = p_submission_id
    and submission.resume_token_hash = p_resume_token_hash;

  if v_requested_outcome = 'kept' then
    update public.cat_moment_deliveries as delivery
    set status = 'kept'
    where delivery.local_delivery_id = p_selected_local_delivery_id
      and delivery.metadata ->> 'bundle_id' = p_bundle_id
      and delivery.metadata ->> 'onboarding_submission_id' = p_submission_id
      and delivery.status not in ('hidden', 'reported');
  end if;

  return query
  select
    v_requested_outcome,
    p_selected_local_delivery_id,
    v_resolved_at,
    true;
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

comment on column public.onboarding_submissions.delivery_choice_outcome is
  'Server-authoritative first resolution for an onboarding four-photo bundle.';

comment on function public.finalize_onboarding_delivery_choice is
  'Atomically keeps one onboarding delivery or records that none was kept. First resolution wins.';
