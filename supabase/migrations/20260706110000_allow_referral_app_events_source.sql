alter table public.app_events
  drop constraint if exists app_events_source_check;

alter table public.app_events
  add constraint app_events_source_check
  check (
    source in (
      'instagram',
      'instagram_story',
      'instagram_bio',
      'instagram_dm',
      'referral',
      'direct',
      'unknown'
    )
  );
