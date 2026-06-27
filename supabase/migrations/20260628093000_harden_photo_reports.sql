with ranked_user_reports as (
  select
    id,
    row_number() over (
      partition by source_photo_id, reporter_user_id
      order by created_at asc, id asc
    ) as row_number
  from public.photo_reports
  where source_photo_id is not null
    and reporter_user_id is not null
),
ranked_anonymous_reports as (
  select
    id,
    row_number() over (
      partition by source_photo_id, reporter_anonymous_id
      order by created_at asc, id asc
    ) as row_number
  from public.photo_reports
  where source_photo_id is not null
    and reporter_anonymous_id is not null
)
delete from public.photo_reports
where id in (
  select id from ranked_user_reports where row_number > 1
  union
  select id from ranked_anonymous_reports where row_number > 1
);

update public.photo_reports
set reporter_anonymous_id = null
where reporter_user_id is not null
  and reporter_anonymous_id is not null;

create unique index if not exists photo_reports_source_user_uidx
on public.photo_reports(source_photo_id, reporter_user_id)
where source_photo_id is not null
  and reporter_user_id is not null;

create unique index if not exists photo_reports_source_anonymous_uidx
on public.photo_reports(source_photo_id, reporter_anonymous_id)
where source_photo_id is not null
  and reporter_anonymous_id is not null;

alter table public.photo_reports
  drop constraint if exists photo_reports_single_reporter_check;

alter table public.photo_reports
  add constraint photo_reports_single_reporter_check
  check (
    (
      reporter_user_id is not null
      and reporter_anonymous_id is null
    )
    or
    (
      reporter_user_id is null
      and reporter_anonymous_id is not null
    )
  );
