alter table public.onboarding_handoffs
  alter column payload drop not null;

grant delete on public.onboarding_handoffs to service_role;
