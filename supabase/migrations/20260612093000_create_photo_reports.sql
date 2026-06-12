create table if not exists public.photo_reports (
  id uuid primary key default gen_random_uuid(),
  photo_id text not null,
  source_photo_id text,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_anonymous_id text,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint photo_reports_reason_check
    check (reason in ('not_cat', 'uncomfortable', 'other')),
  constraint photo_reports_reporter_check
    check (reporter_user_id is not null or reporter_anonymous_id is not null)
);

create index if not exists photo_reports_photo_id_idx
on public.photo_reports(photo_id, created_at desc);

create index if not exists photo_reports_source_photo_id_idx
on public.photo_reports(source_photo_id, created_at desc)
where source_photo_id is not null;

alter table public.photo_reports enable row level security;

revoke all on public.photo_reports from anon;
revoke all on public.photo_reports from authenticated;

