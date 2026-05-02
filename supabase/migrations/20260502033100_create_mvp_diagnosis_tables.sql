-- MVP diagnosis schema.
-- Creates only events, diagnoses, and feedbacks.
-- RLS is intentionally not enabled in this migration.
-- Do not run this migration until the schema and ownership model are confirmed.

create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  cat_id uuid null,
  event_type text not null,
  signal text not null,
  label text null,
  source text not null default 'home',
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint events_event_type_check
    check (event_type in ('current_state', 'concern'))
);

create table diagnoses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid null,
  cat_id uuid null,
  input_signal text not null,
  scores jsonb not null,
  selected_categories text[] not null,
  primary_category text not null,
  secondary_category text null,
  context jsonb not null default '{}'::jsonb,
  reason_codes text[] not null default '{}',
  logic_version text not null default 'mvp-0.1',
  created_at timestamptz not null default now()
);

create table feedbacks (
  id uuid primary key default gen_random_uuid(),
  diagnosis_id uuid not null references diagnoses(id) on delete cascade,
  user_id uuid null,
  cat_id uuid null,
  feedback text not null,
  category text null,
  next_candidate_shown text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint feedbacks_feedback_check
    check (feedback in ('resolved', 'unresolved'))
);

create index events_created_at_idx
  on events (created_at desc);

create index events_event_type_created_at_idx
  on events (event_type, created_at desc);

create index events_signal_created_at_idx
  on events (signal, created_at desc);

create index events_user_id_created_at_idx
  on events (user_id, created_at desc);

create index diagnoses_event_id_idx
  on diagnoses (event_id);

create index diagnoses_primary_category_created_at_idx
  on diagnoses (primary_category, created_at desc);

create index diagnoses_input_signal_created_at_idx
  on diagnoses (input_signal, created_at desc);

create index diagnoses_user_id_created_at_idx
  on diagnoses (user_id, created_at desc);

create index feedbacks_diagnosis_id_idx
  on feedbacks (diagnosis_id);

create index feedbacks_feedback_created_at_idx
  on feedbacks (feedback, created_at desc);

create index feedbacks_user_id_created_at_idx
  on feedbacks (user_id, created_at desc);
