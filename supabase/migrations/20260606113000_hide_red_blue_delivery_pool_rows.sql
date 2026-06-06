with blocked_photo_urls as (
  select distinct photo_url
  from public.cat_moments
  where local_moment_id in (
    'own-sleeping-1780670253932',
    'own-sleeping-1780669954498',
    'own-sleeping-1780668154273',
    'own-sleeping-1780668121905',
    'own-sleeping-1780667901727',
    'own-sleeping-1780667802425'
  )
)
update public.cat_moments
set
  delivery_status = 'hidden',
  metadata = jsonb_set(
    jsonb_set(
      jsonb_set(
        coalesce(metadata, '{}'::jsonb),
        '{hidden_reason}',
        '"red_blue_test_photo"',
        true
      ),
      '{hidden_at}',
      to_jsonb(now()::text),
      true
    ),
    '{blocked_by_migration}',
    '"20260606113000_hide_red_blue_delivery_pool_rows"',
    true
  )
where local_moment_id in (
    'own-sleeping-1780670253932',
    'own-sleeping-1780669954498',
    'own-sleeping-1780668154273',
    'own-sleeping-1780668121905',
    'own-sleeping-1780667901727',
    'own-sleeping-1780667802425'
  )
  or photo_url in (select photo_url from blocked_photo_urls);

-- Verification query:
-- select local_moment_id, delivery_status, metadata->>'hidden_reason' as hidden_reason, created_at
-- from public.cat_moments
-- where local_moment_id in (
--   'own-sleeping-1780670253932',
--   'own-sleeping-1780669954498',
--   'own-sleeping-1780668154273',
--   'own-sleeping-1780668121905',
--   'own-sleeping-1780667901727',
--   'own-sleeping-1780667802425'
-- )
-- or photo_url in (
--   select photo_url
--   from public.cat_moments
--   where local_moment_id = 'own-sleeping-1780670253932'
-- );
