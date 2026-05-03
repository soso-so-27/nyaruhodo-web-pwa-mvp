-- Prepare storage for reactions to the "いまの{猫名}" hypothesis card.
-- This table is separate from feedbacks because these hints do not have a diagnosis_id.
-- RLS allows anon inserts only; no select, update, or delete policies are created.

create table if not exists hint_feedbacks (
  id uuid primary key default gen_random_uuid(),
  local_cat_id text null,
  hint_type text not null default 'current_cat',
  shown_category text null,
  shown_signal text null,
  feedback text not null,
  understanding_percent int null,
  source_event_ids jsonb null,
  calendar_context jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hint_feedbacks_local_cat_id_created_at_idx
  on hint_feedbacks (local_cat_id, created_at desc);

create index if not exists hint_feedbacks_shown_category_created_at_idx
  on hint_feedbacks (shown_category, created_at desc);

alter table hint_feedbacks enable row level security;

create policy "anon can insert hint_feedbacks"
  on hint_feedbacks
  for insert
  to anon
  with check (true);

grant usage on schema public to anon;
grant insert on table public.hint_feedbacks to anon;
