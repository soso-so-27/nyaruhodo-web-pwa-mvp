drop policy if exists "cat_moments_select_shared_available" on public.cat_moments;
create policy "cat_moments_select_shared_available"
on public.cat_moments
for select
to anon, authenticated
using (
  visibility = 'shared'
  and delivery_status = 'available'
);

grant select on public.cat_moments to anon;
