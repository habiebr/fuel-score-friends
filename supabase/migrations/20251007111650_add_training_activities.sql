-- Create training_activities table to allow multiple activities per day per user
create table if not exists public.training_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  activity_type text not null check (activity_type in ('rest','run','strength','cardio','other')),
  start_time time without time zone,
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  distance_km numeric(6,2),
  intensity text not null default 'moderate' check (intensity in ('low','moderate','high')),
  estimated_calories integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists training_activities_user_date_idx on public.training_activities(user_id, date);

-- Enable RLS and policies
alter table public.training_activities enable row level security;

do $$ begin
  create policy training_activities_select on public.training_activities
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy training_activities_insert on public.training_activities
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy training_activities_update on public.training_activities
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy training_activities_delete on public.training_activities
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Trigger to update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_training_activities_updated_at on public.training_activities;
create trigger set_training_activities_updated_at
before update on public.training_activities
for each row execute function public.set_updated_at();


