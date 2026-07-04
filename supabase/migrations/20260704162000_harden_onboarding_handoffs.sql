alter table public.onboarding_handoffs
  alter column expires_at set default (now() + interval '24 hours');

