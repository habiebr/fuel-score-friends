-- Weekly activity metrics (session-linked) per user per ISO week
-- Stores pre-aggregated distances/calories to speed up leaderboard/widgets

create table if not exists public.weekly_activity_metrics (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null, -- Monday of the ISO week (local or UTC policy)
  session_distance_m numeric default 0 not null, -- sum of google_fit_data.distance_meters where sessions is not null
  session_calories numeric default 0 not null, -- sum of google_fit_data.calories_burned where sessions is not null
  session_count integer default 0 not null,
  weekly_score integer, -- optional: cached unified weekly score
  updated_at timestamptz not null default now(),
  inserted_at timestamptz not null default now(),
  primary key (user_id, week_start_date)
);

create index if not exists idx_weekly_activity_metrics_week on public.weekly_activity_metrics(week_start_date);
create index if not exists idx_weekly_activity_metrics_user on public.weekly_activity_metrics(user_id);

comment on table public.weekly_activity_metrics is 'Aggregated, session-linked weekly activity metrics for leaderboard and widgets.';
comment on column public.weekly_activity_metrics.week_start_date is 'Monday of the ISO week (aligned to app week).';
comment on column public.weekly_activity_metrics.session_distance_m is 'Sum of distance_meters from google_fit_data where sessions is not null for the week.';
comment on column public.weekly_activity_metrics.session_calories is 'Sum of calories_burned from google_fit_data where sessions is not null for the week.';

