create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  message text not null,
  kind text not null default 'beta_feedback',
  page text,
  user_agent text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  constraint beta_feedback_category_check check (
    category in ('good', 'confusing', 'bug', 'request', 'other')
  ),
  constraint beta_feedback_kind_check check (
    kind in ('beta_feedback', 'supporter_voice')
  ),
  constraint beta_feedback_message_check check (
    char_length(btrim(message)) between 1 and 2000
  ),
  constraint beta_feedback_status_check check (
    status in ('new', 'reviewed', 'archived')
  )
);

create index if not exists beta_feedback_user_id_created_at_idx
  on public.beta_feedback (user_id, created_at desc);

create index if not exists beta_feedback_kind_category_created_at_idx
  on public.beta_feedback (kind, category, created_at desc);

alter table public.beta_feedback enable row level security;

drop policy if exists "users can insert own beta feedback"
  on public.beta_feedback;

create policy "users can insert own beta feedback"
  on public.beta_feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

grant insert on table public.beta_feedback to authenticated;
