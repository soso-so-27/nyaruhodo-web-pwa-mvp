create table if not exists public.account_local_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  state_key text not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, state_key),
  constraint account_local_state_key_check check (char_length(state_key) > 0),
  constraint account_local_state_value_object check (value is not null)
);

create index if not exists account_local_state_user_updated_at_idx
on public.account_local_state(user_id, updated_at desc);

drop trigger if exists set_account_local_state_updated_at on public.account_local_state;
create trigger set_account_local_state_updated_at
before update on public.account_local_state
for each row
execute function public.set_updated_at();

alter table public.account_local_state enable row level security;

drop policy if exists "account_local_state_select_own" on public.account_local_state;
create policy "account_local_state_select_own"
on public.account_local_state
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "account_local_state_insert_own" on public.account_local_state;
create policy "account_local_state_insert_own"
on public.account_local_state
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "account_local_state_update_own" on public.account_local_state;
create policy "account_local_state_update_own"
on public.account_local_state
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "account_local_state_delete_own" on public.account_local_state;
create policy "account_local_state_delete_own"
on public.account_local_state
for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.account_local_state to authenticated;
