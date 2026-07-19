create unique index if not exists cat_moments_onboarding_submission_uidx
  on public.cat_moments ((metadata ->> 'onboarding_submission_id'))
  where metadata ->> 'onboarding_submission_id' is not null;

create unique index if not exists cat_moment_deliveries_onboarding_submission_uidx
  on public.cat_moment_deliveries ((metadata ->> 'onboarding_submission_id'))
  where metadata ->> 'onboarding_submission_id' is not null;

comment on index public.cat_moments_onboarding_submission_uidx is
  'Prevents one onboarding journey from adding its own photo more than once across browser identities.';

comment on index public.cat_moment_deliveries_onboarding_submission_uidx is
  'Prevents one onboarding journey from receiving more than one first delivery across browser identities.';
