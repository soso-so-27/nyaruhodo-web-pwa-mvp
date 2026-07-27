create index if not exists evening_choice_selected_delivery_idx
on public.evening_delivery_choice_resolutions (selected_local_delivery_id)
where outcome = 'kept'
  and selected_local_delivery_id is not null;

create index if not exists onboarding_selected_delivery_idx
on public.onboarding_submissions (delivery_id)
where delivery_choice_outcome = 'kept'
  and delivery_id is not null;
