create table if not exists public.beta_participants (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text not null default 'active',
  note text,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beta_participants_email_normalized_check check (
    email = lower(btrim(email)) and email <> ''
  ),
  constraint beta_participants_status_check check (
    status in ('active', 'inactive')
  )
);

create or replace function public.normalize_beta_participant_email()
returns trigger
language plpgsql
as $$
begin
  new.email = lower(btrim(new.email));
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'normalize_beta_participant_email_trigger'
  ) then
    execute '
      create trigger normalize_beta_participant_email_trigger
      before insert or update on public.beta_participants
      for each row
      execute function public.normalize_beta_participant_email()
    ';
  end if;
end;
$$;

create unique index if not exists beta_participants_email_idx
  on public.beta_participants (email);

create index if not exists beta_participants_status_created_at_idx
  on public.beta_participants (status, created_at desc);

alter table public.beta_participants enable row level security;
