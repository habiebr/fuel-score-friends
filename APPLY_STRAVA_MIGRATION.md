# Apply Strava Database Migration

Since automated database connections are blocked, please apply the migration manually:

## Steps:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/eecdbddpzwedficnpenm
   - Or: https://eecdbddpzwedficnpenm.supabase.co

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy Migration SQL**
   - Open file: `supabase/migrations/20251011084938_add_strava_integration.sql`
   - Copy ALL contents (10,725 characters)

4. **Paste and Run**
   - Paste into the SQL Editor
   - Click "Run" or press `Cmd+Enter`
   - Wait for completion (should take ~5 seconds)

5. **Verify Success**
   - You should see: "Success. No rows returned"
   - Check Database → Tables → you should see 4 new tables:
     - `strava_tokens`
     - `strava_activities`
     - `strava_webhook_subscriptions`
     - `strava_webhook_events`

## What Gets Created:

### Tables:
- ✅ `strava_tokens` - OAuth tokens with auto-refresh
- ✅ `strava_activities` - Synced activities with GPS, power, HR data
- ✅ `strava_webhook_subscriptions` - Webhook registrations
- ✅ `strava_webhook_events` - Real-time event queue

### Security:
- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Users can only access their own data
- ✅ Service role has full access (for edge functions)

### Helper Functions:
- ✅ `has_valid_strava_token(user_id)` - Check token validity
- ✅ `get_strava_athlete_id(user_id)` - Get athlete ID
- ✅ `cleanup_old_strava_webhook_events()` - Cleanup old events (30+ days)

### Indexes:
- ✅ Fast user lookups
- ✅ Date-based queries optimized
- ✅ Activity type filtering

## After Migration:

Once the migration is applied, come back here and I'll create the edge functions! ✨
