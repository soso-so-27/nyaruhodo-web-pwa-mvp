create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_codes_code_format_check check (
    code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$'
  )
);

create table if not exists public.referral_claims (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.referral_codes(code) on update cascade on delete restrict,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  anonymous_id text null,
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint referral_claims_no_self_referral_check check (
    referrer_user_id <> referred_user_id
  )
);

create unique index if not exists referral_claims_referred_user_id_idx
  on public.referral_claims (referred_user_id);

create index if not exists referral_claims_referrer_claimed_at_idx
  on public.referral_claims (referrer_user_id, claimed_at desc);

create index if not exists referral_claims_code_claimed_at_idx
  on public.referral_claims (code, claimed_at desc);

create or replace function public.set_referral_codes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_referral_codes_updated_at on public.referral_codes;
create trigger set_referral_codes_updated_at
before update on public.referral_codes
for each row
execute function public.set_referral_codes_updated_at();

alter table public.referral_codes enable row level security;
alter table public.referral_claims enable row level security;

drop policy if exists "referral_codes_select_own" on public.referral_codes;
create policy "referral_codes_select_own"
on public.referral_codes
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "referral_codes_insert_own" on public.referral_codes;
create policy "referral_codes_insert_own"
on public.referral_codes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "referral_codes_update_own" on public.referral_codes;
create policy "referral_codes_update_own"
on public.referral_codes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "referral_claims_select_related" on public.referral_claims;
create policy "referral_claims_select_related"
on public.referral_claims
for select
to authenticated
using (referrer_user_id = auth.uid() or referred_user_id = auth.uid());

grant select, insert, update on table public.referral_codes to authenticated;
grant select on table public.referral_claims to authenticated;
