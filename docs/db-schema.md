# DB Schema

## Policy

Supabase is the planned backend.

Do not create or run migrations, RLS policies, SQL scripts, or remote Supabase operations without confirming with the user first.

Destructive database operations are prohibited.

Never run:

- `supabase db reset`

## Access Rule

All Supabase access must go through `/lib/supabase`.

UI components must not call Supabase directly.

## Planned Tables

The MVP data model assumes these tables:

- `events`
- `diagnoses`
- `feedbacks`

Future tables, not part of the first MVP SQL:

- `actions`
- `weights`
- `cats`
- `profiles`

The schema below is a planning document, not an executed migration.

## events

Purpose: Store observed cat behavior or concern inputs.

Possible fields:

- `id`
- `user_id`
- `cat_id`
- `event_type`
- `signal`
- `context`
- `created_at`

Notes:

- `signal` should map to core logic inputs such as `meowing`, `following`, or `restless`.
- `context` can hold structured JSON for time, history, and environment inputs.

## diagnoses

Purpose: Store diagnosis outputs from deterministic scoring.

Possible fields:

- `id`
- `user_id`
- `cat_id`
- `event_id`
- `input_signal`
- `scores`
- `selected_categories`
- `primary_category`
- `secondary_category`
- `context`
- `reason_codes`
- `logic_version`
- `created_at`

Notes:

- `scores` should store the computed category scores.
- `selected_categories` should store one or two selected cause categories.
- Diagnosis feedback belongs in `feedbacks`, not in `diagnoses`.

## feedbacks

Purpose: Store post-diagnosis feedback such as resolved or unresolved.

Possible fields:

- `id`
- `diagnosis_id`
- `user_id`
- `cat_id`
- `feedback`
- `category`
- `next_candidate_shown`
- `metadata`
- `created_at`

Notes:

- Feedback is separated from `diagnoses` so repeated or later reactions can be analyzed independently.
- `diagnosis_id` should reference `diagnoses(id)`.

## weights

Purpose: Store configurable scoring weights if the product later needs server-side or admin-adjustable logic.

Possible fields:

- `id`
- `key`
- `category`
- `value`
- `active`
- `created_at`
- `updated_at`

Notes:

- The initial MVP can keep weights in `/core`.
- Moving weights to Supabase is a later decision and must be recorded in `docs/decisions.md`.

## MVP SQL Draft

This SQL is a draft for review only. Do not run it as a migration until explicitly approved.

RLS is intentionally not included yet. Before production use, enable RLS and create policies based on the authentication and ownership model.

```sql
-- Draft only. Do not execute without confirmation.
-- RLS policies are intentionally omitted for now.
-- Later: enable RLS and restrict rows by authenticated user ownership.

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
```

## MVP Index Draft

These indexes are also draft only.

```sql
-- Draft only. Do not execute without confirmation.

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
```

## Design Concerns

- `user_id` and `cat_id` are nullable in the MVP draft. This supports anonymous validation, but production analytics and RLS will be much cleaner once ownership is required.
- `cat_id` has no foreign key yet because `cats` is intentionally out of scope. This is acceptable for MVP, but it should be revisited before multi-cat support.
- `signal`, `primary_category`, `secondary_category`, and `feedback.category` are `text`. This keeps migrations simple, but app-level union types must stay aligned until stricter DB checks or enums are introduced.
- `scores` and `context` are `jsonb`, which is flexible but requires discipline in the app layer. Add shape validation before relying on them heavily for analytics.
- `on delete cascade` means deleting an event deletes its diagnoses and feedbacks. That is convenient, but deletion behavior should be reviewed before any user-facing delete feature.

## RLS

RLS design is required before production use, but it is not part of this first documentation step.

Before implementing RLS:

- Confirm ownership model.
- Confirm authentication model.
- Confirm whether cats are single-user or shared.
- Ask the user before creating policies.
