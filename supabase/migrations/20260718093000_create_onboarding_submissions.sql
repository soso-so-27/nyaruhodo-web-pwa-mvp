create table if not exists public.onboarding_submissions (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null unique,
  resume_token_hash text not null,
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_id text,
  source text not null default 'direct',
  date_key date not null,
  stage text not null default 'selected',
  own_photo_id text,
  delivery_id text,
  source_photo_id text,
  stage_updated_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_submissions_submission_id_length
    check (char_length(submission_id) between 1 and 240),
  constraint onboarding_submissions_resume_token_hash_format
    check (resume_token_hash ~ '^[0-9a-f]{64}$'),
  constraint onboarding_submissions_identity_present
    check (user_id is not null or anonymous_id is not null),
  constraint onboarding_submissions_anonymous_id_length
    check (anonymous_id is null or char_length(anonymous_id) between 1 and 128),
  constraint onboarding_submissions_source_check
    check (source in (
      'direct',
      'instagram',
      'instagram_story',
      'instagram_bio',
      'instagram_dm',
      'referral',
      'unknown'
    )),
  constraint onboarding_submissions_stage_check
    check (stage in (
      'selected',
      'uploading',
      'submitted',
      'delivered',
      'opened',
      'completed'
    )),
  constraint onboarding_submissions_own_photo_id_length
    check (own_photo_id is null or char_length(own_photo_id) between 1 and 240),
  constraint onboarding_submissions_delivery_id_length
    check (delivery_id is null or char_length(delivery_id) between 1 and 240),
  constraint onboarding_submissions_source_photo_id_length
    check (source_photo_id is null or char_length(source_photo_id) between 1 and 240)
);

alter table public.onboarding_submissions enable row level security;

revoke all on public.onboarding_submissions from anon, authenticated;
grant select, insert, update, delete on public.onboarding_submissions to service_role;

create index if not exists onboarding_submissions_anonymous_id_idx
  on public.onboarding_submissions (anonymous_id, date_key desc);

create index if not exists onboarding_submissions_user_id_idx
  on public.onboarding_submissions (user_id, date_key desc);

create index if not exists onboarding_submissions_updated_at_idx
  on public.onboarding_submissions (updated_at desc);

drop trigger if exists onboarding_submissions_set_updated_at
  on public.onboarding_submissions;

create trigger onboarding_submissions_set_updated_at
before update on public.onboarding_submissions
for each row
execute function public.set_updated_at();

comment on table public.onboarding_submissions is
  'Minimal server-side onboarding state ledger. Photo bytes and signed URLs are intentionally excluded.';
