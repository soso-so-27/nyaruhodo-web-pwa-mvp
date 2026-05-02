-- Grant insert-only table privileges for MVP anon writes.
-- RLS policies remain unchanged.
-- No select, update, or delete grants are included.

grant usage on schema public to anon;

grant insert on table public.events to anon;
grant insert on table public.diagnoses to anon;
grant insert on table public.feedbacks to anon;
