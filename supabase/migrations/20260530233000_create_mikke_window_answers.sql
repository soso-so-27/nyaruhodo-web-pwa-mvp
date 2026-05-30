create table if not exists public.mikke_window_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id text not null,
  local_cat_id text not null,
  window_id text not null,
  question_id text not null,
  category text not null,
  answer_id text not null,
  answer_label text not null,
  metadata jsonb not null default '{}'::jsonb,
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint mikke_window_answers_category_check
    check (category in ('place', 'pose', 'sign')),
  constraint mikke_window_answers_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists mikke_window_answers_window_actor_uidx
on public.mikke_window_answers(window_id, question_id, anonymous_id, local_cat_id);

create index if not exists mikke_window_answers_window_question_idx
on public.mikke_window_answers(window_id, question_id, answered_at desc);

create or replace view public.mikke_window_answer_counts as
select
  window_id,
  question_id,
  category,
  answer_id,
  answer_label,
  count(*)::int as answer_count,
  max(answered_at) as latest_answered_at
from public.mikke_window_answers
group by
  window_id,
  question_id,
  category,
  answer_id,
  answer_label;

alter table public.mikke_window_answers enable row level security;

create policy "mikke_window_answers_insert_anyone"
on public.mikke_window_answers
for insert
to anon, authenticated
with check (true);

grant insert on public.mikke_window_answers to anon, authenticated;
grant select on public.mikke_window_answer_counts to anon, authenticated;
