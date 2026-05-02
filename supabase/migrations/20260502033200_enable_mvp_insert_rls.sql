-- MVP insert-only RLS.
-- Allows anon inserts for events, diagnoses, and feedbacks.
-- No select, update, or delete policies are created.

alter table events enable row level security;
alter table diagnoses enable row level security;
alter table feedbacks enable row level security;

create policy "anon can insert events"
  on events
  for insert
  to anon
  with check (true);

create policy "anon can insert diagnoses"
  on diagnoses
  for insert
  to anon
  with check (true);

create policy "anon can insert feedbacks"
  on feedbacks
  for insert
  to anon
  with check (true);
