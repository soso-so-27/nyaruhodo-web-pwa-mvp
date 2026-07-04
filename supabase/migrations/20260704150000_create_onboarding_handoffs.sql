create table if not exists public.onboarding_handoffs (
  id uuid primary key default gen_random_uuid(),
  handoff_token text not null unique,
  payload jsonb not null,
  source text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  redeemed_at timestamptz,
  last_redeemed_at timestamptz,
  redeem_count integer not null default 0
);

alter table public.onboarding_handoffs enable row level security;

revoke all on public.onboarding_handoffs from anon, authenticated;
grant select, insert, update on public.onboarding_handoffs to service_role;

create index if not exists onboarding_handoffs_token_idx
  on public.onboarding_handoffs (handoff_token);

create index if not exists onboarding_handoffs_expires_at_idx
  on public.onboarding_handoffs (expires_at);
