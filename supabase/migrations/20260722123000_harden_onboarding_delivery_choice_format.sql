drop index if exists public.cat_moment_deliveries_onboarding_single_submission_uidx;
drop index if exists public.cat_moment_deliveries_onboarding_choice_slot_uidx;

create unique index if not exists cat_moment_deliveries_onboarding_submission_slot_uidx
  on public.cat_moment_deliveries (
    (metadata ->> 'onboarding_submission_id'),
    (coalesce(metadata ->> 'delivery_position', '1'))
  )
  where metadata ->> 'onboarding_submission_id' is not null;

comment on index public.cat_moment_deliveries_onboarding_submission_slot_uidx is
  'Allows either one legacy onboarding delivery or one four-photo bundle per submission, never both.';
