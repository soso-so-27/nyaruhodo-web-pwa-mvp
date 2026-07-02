drop policy if exists "cat_moments_insert_anonymous_backup" on public.cat_moments;

revoke insert on public.cat_moments from anon;
