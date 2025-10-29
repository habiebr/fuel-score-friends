# Migration Application Guide

## Issue with `supabase db push`

The `supabase db push` command detected conflicts with existing migrations and wants to apply old migrations that are already in the database. This causes duplicate key errors.

## Migration to Apply

**File:** `supabase/migrations/20251013000000_add_user_activity_label.sql`

This migration:
- Adds `user_activity_label` column to `training_activities` table
- Backfills existing records with inferred labels
- Adds index for performance

## Option 1: Manual Application via Dashboard (RECOMMENDED)

**Steps:**
1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/sql/new
2. Copy the SQL from: `supabase/migrations/20251013000000_add_user_activity_label.sql`
3. Paste into SQL Editor
4. Click "Run"

**SQL to Execute:**
```sql
-- Add user_activity_label column to training_activities table
ALTER TABLE public.training_activities 
ADD COLUMN IF NOT EXISTS user_activity_label TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN public.training_activities.user_activity_label IS 
'User-selected activity type label: long_run, interval, regular_run, strength, rest. Used to respect user intent over automatic classification.';

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_training_activities_user_activity_label 
ON public.training_activities(user_activity_label);

-- Update existing records with inferred labels based on parameters
UPDATE public.training_activities
SET user_activity_label = 
  CASE 
    WHEN activity_type = 'rest' THEN 'rest'
    WHEN activity_type = 'strength' THEN 'strength'
    WHEN activity_type = 'run' AND distance_km >= 15 THEN 'long_run'
    WHEN activity_type = 'run' AND intensity = 'high' THEN 'interval'
    WHEN activity_type = 'run' THEN 'regular_run'
    WHEN activity_type = 'cardio' THEN 'cardio'
    ELSE 'other'
  END
WHERE user_activity_label IS NULL;
```

## Option 2: Using psql (If you have it installed)

**Prerequisites:**
- Install PostgreSQL client: `brew install postgresql` (macOS)
- Get database password from Supabase Dashboard > Settings > Database

**Run:**
```bash
export SUPABASE_DB_PASSWORD='your-password-here'
./apply-migration.sh
```

## Option 3: Via Node.js Script (Fallback)

If you have the service role key:

```bash
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
node apply-user-activity-label.mjs
```

## Verification

After applying the migration, verify it worked:

```sql
-- Check column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'training_activities' 
AND column_name = 'user_activity_label';

-- Check backfilled data
SELECT 
  date,
  activity_type,
  user_activity_label,
  distance_km,
  intensity
FROM training_activities
ORDER BY date DESC
LIMIT 10;
```

Expected: You should see `user_activity_label` populated for existing records.

## Why supabase db push Failed

The CLI detects that some local migration files were created after migrations already in the database, causing timeline conflicts:

```
Found local migration files to be inserted before the last migration on remote database.
Rerun the command with --include-all flag to apply these migrations:
  supabase/migrations/20251007_add_training_activities.sql
  supabase/migrations/20251009_weekly_activity_metrics.sql
  ...
```

When running with `--include-all`, it tries to apply migrations that already exist in the database:
```
ERROR: duplicate key value violates unique constraint "schema_migrations_pkey"
Key (version)=(20251010000007) already exists.
```

This is a known issue with Supabase CLI when migrations are applied outside the CLI (e.g., via Dashboard).

## Solution: Manual Application

The cleanest solution is to apply the migration manually via Dashboard SQL Editor. This:
- ✅ Avoids CLI migration tracking issues
- ✅ Direct database modification
- ✅ Immediate verification
- ✅ No conflicts with existing migrations

## After Migration Success

1. ✅ Column added
2. ✅ Existing data backfilled
3. ✅ Index created
4. ✅ Frontend code ready (Goals.tsx updated)
5. ✅ Dashboard code ready (classification updated)
6. ✅ Edge function deployed (daily-meal-generation)

**Next:** Test by creating a new training activity with "Long Run" label!
