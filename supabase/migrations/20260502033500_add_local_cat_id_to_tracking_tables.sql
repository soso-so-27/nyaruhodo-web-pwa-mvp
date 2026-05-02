-- Add local_cat_id for MVP localStorage-based multi-cat separation.
-- This does not modify the existing cat_id uuid columns and does not change RLS.

alter table events
  add column if not exists local_cat_id text;

alter table diagnoses
  add column if not exists local_cat_id text;

alter table feedbacks
  add column if not exists local_cat_id text;

create index if not exists events_local_cat_id_occurred_at_idx
  on events (local_cat_id, occurred_at desc);

create index if not exists diagnoses_local_cat_id_created_at_idx
  on diagnoses (local_cat_id, created_at desc);

create index if not exists feedbacks_local_cat_id_created_at_idx
  on feedbacks (local_cat_id, created_at desc);
