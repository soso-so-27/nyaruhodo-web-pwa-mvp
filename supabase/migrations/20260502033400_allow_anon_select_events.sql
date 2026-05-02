-- Allow anon read access to events for MVP context calculation.
-- RLS remains enabled.
-- Only events select is allowed here.
-- No select policies are added for diagnoses or feedbacks.
-- No update or delete policies are added.

grant select on table public.events to anon;

create policy "anon can select events"
  on public.events
  for select
  to anon
  using (true);
