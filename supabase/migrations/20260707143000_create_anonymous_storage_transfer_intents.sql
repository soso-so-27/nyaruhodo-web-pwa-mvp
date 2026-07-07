create table if not exists public.anonymous_storage_transfer_intents (
  transfer_token text primary key,
  anonymous_user_id uuid not null,
  paths jsonb not null default '[]'::jsonb,
  target_user_id uuid,
  mappings jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  used_at timestamptz
);

alter table public.anonymous_storage_transfer_intents enable row level security;

revoke all on public.anonymous_storage_transfer_intents from anon, authenticated;
grant select, insert, update, delete on public.anonymous_storage_transfer_intents to service_role;

create index if not exists anonymous_storage_transfer_intents_expires_at_idx
  on public.anonymous_storage_transfer_intents (expires_at);

create index if not exists anonymous_storage_transfer_intents_anonymous_user_idx
  on public.anonymous_storage_transfer_intents (anonymous_user_id);
