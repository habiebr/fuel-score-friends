-- Enable RLS and add policies for weekly_activity_metrics

alter table if exists public.weekly_activity_metrics enable row level security;

-- Allow users to see their own rows
do $$ begin
  create policy weekly_activity_metrics_select on public.weekly_activity_metrics
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Allow users to insert their own rows
do $$ begin
  create policy weekly_activity_metrics_insert on public.weekly_activity_metrics
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Allow users to update their own rows
do $$ begin
  create policy weekly_activity_metrics_update on public.weekly_activity_metrics
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Allow users to delete their own rows
do $$ begin
  create policy weekly_activity_metrics_delete on public.weekly_activity_metrics
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;



