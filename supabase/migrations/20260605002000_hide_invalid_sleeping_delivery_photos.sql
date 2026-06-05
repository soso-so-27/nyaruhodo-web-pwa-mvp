update public.cat_moments
set
  delivery_status = 'hidden',
  metadata = jsonb_set(
    jsonb_set(
      coalesce(metadata, '{}'::jsonb),
      '{hidden_reason}',
      '"invalid_photo_url"',
      true
    ),
    '{hidden_at}',
    to_jsonb(now()::text),
    true
  )
where visibility = 'shared'
  and delivery_status = 'available'
  and (
    photo_url is null
    or btrim(photo_url) = ''
    or (
      photo_url like 'data:image/%'
      and length(photo_url) < 200
    )
  );
