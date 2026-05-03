-- Prepare calendar_context for MVP lifestyle context tracking.
-- This only adds nullable jsonb columns and does not change RLS or existing data.

alter table events
  add column if not exists calendar_context jsonb;

alter table diagnoses
  add column if not exists calendar_context jsonb;
