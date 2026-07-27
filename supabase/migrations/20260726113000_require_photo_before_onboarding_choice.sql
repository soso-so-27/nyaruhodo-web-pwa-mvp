alter table public.onboarding_submissions
  drop constraint if exists onboarding_choice_requires_own_photo;

alter table public.onboarding_submissions
  add constraint onboarding_choice_requires_own_photo
  check (
    delivery_choice_outcome is null
    or (
      own_photo_id is not null
      and stage in ('submitted', 'delivered', 'opened', 'completed')
    )
  )
  not valid;

alter table public.onboarding_submissions
  validate constraint onboarding_choice_requires_own_photo;

comment on constraint onboarding_choice_requires_own_photo
  on public.onboarding_submissions is
  'An onboarding preview remains provisional until the participant saves an own-cat photo.';

create or replace function public.enforce_onboarding_choice_shared_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.delivery_choice_outcome is not null
    and (
      old.delivery_choice_outcome is distinct from new.delivery_choice_outcome
      or old.own_photo_id is distinct from new.own_photo_id
    )
    and not exists (
      select 1
      from public.cat_moments as moment
      where moment.local_moment_id = new.own_photo_id
        and moment.metadata ->> 'onboarding_submission_id' = new.submission_id
        and moment.visibility = 'shared'
        and moment.delivery_status = 'available'
        and (
          (new.user_id is not null and moment.user_id = new.user_id)
          or (
            new.user_id is null
            and moment.user_id is null
            and moment.anonymous_id = new.anonymous_id
          )
        )
    )
  then
    raise exception using
      errcode = '23514',
      message = 'onboarding_choice_requires_shared_photo';
  end if;

  return new;
end;
$$;

drop trigger if exists onboarding_choice_shared_photo_guard
  on public.onboarding_submissions;

create trigger onboarding_choice_shared_photo_guard
before update of delivery_choice_outcome, own_photo_id
on public.onboarding_submissions
for each row
execute function public.enforce_onboarding_choice_shared_photo();

revoke all on function public.enforce_onboarding_choice_shared_photo()
  from public, anon, authenticated;

comment on function public.enforce_onboarding_choice_shared_photo() is
  'Prevents an onboarding delivery choice from resolving without the matching shared cat moment.';
