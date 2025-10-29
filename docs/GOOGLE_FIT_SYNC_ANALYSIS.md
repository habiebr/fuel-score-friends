# Google Fit Sync Functions - Duplication Analysis

## Overview
Analysis of Google Fit sync functions to identify duplications and recommend consolidation.

## Current Functions

### 1. **fetch-google-fit-data** (614 lines)
- **Purpose**: User-initiated sync via frontend
- **Usage**: Called from `src/hooks/useGoogleFitSync.ts`
- **Functionality**: 
  - Fetches Google Fit data for a specific user
  - Returns steps, calories, active minutes, distance, sessions
  - Includes comprehensive activity filtering
- **CORS**: ✅ Fixed (cache-control, expires, pragma)
- **Status**: ✅ **KEEP** - Primary user-facing sync function

### 2. **sync-historical-google-fit-data** (476 lines)
- **Purpose**: Backfill historical data for a user
- **Usage**: Called from `src/hooks/useGoogleFitSync.ts` 
- **Functionality**:
  - Syncs multiple days of historical data
  - User-initiated for catching up on past data
  - Similar activity filtering as fetch-google-fit-data
- **CORS**: ✅ Fixed via shared cors.ts
- **Status**: ✅ **KEEP** - Needed for initial setup and backfills

### 3. **auto-sync-google-fit** (273 lines)
- **Purpose**: Background cron job to auto-sync all users
- **Usage**: Intended for cron scheduling (every 5 minutes)
- **Functionality**:
  - Loops through all users with valid Google tokens
  - Syncs recent data automatically
  - Requires CRON_SECRET or service role authentication
- **CORS**: ⚠️ Needs updating (missing cache-control, expires, pragma)
- **Status**: ⚠️ **EVALUATE** - NOT currently scheduled in database

### 4. **sync-all-users-direct** (419 lines)
- **Purpose**: Batch sync all users (daily cron job)
- **Usage**: Scheduled via pg_cron in migration `20251008010000_schedule_google_fit_sync.sql`
- **Schedule**: Daily at 01:15 UTC
- **Functionality**:
  - Syncs last 30 days for all users
  - Includes activity filtering and normalization
  - Direct database operations
- **CORS**: ⚠️ Needs updating (missing cache-control, expires, pragma)
- **Status**: ✅ **KEEP** - Active cron job

## Token Refresh Functions

### 5. **refresh-google-fit-token** (Individual)
- Purpose: Refresh a single user's token
- Status: ✅ KEEP

### 6. **refresh-all-google-tokens** (Batch)
- Purpose: Refresh all users' tokens
- Called from: `src/hooks/useAuth.tsx`
- Status: ✅ KEEP

### 7. **refresh-expiring-google-tokens** (Cron)
- Purpose: Background job to refresh expiring tokens
- Status: ⚠️ Check if scheduled

### 8. **store-google-token** (Initial Auth)
- Purpose: Store initial OAuth tokens
- Called from: `src/hooks/useAuth.tsx`
- CORS: ✅ Fixed
- Status: ✅ KEEP

## Duplication Issues Found

### ⚠️ Issue #1: Two Background Sync Functions
**Problem**: Both `auto-sync-google-fit` and `sync-all-users-direct` do similar things:
- Loop through all users
- Fetch Google Fit data
- Store in database

**Difference**:
- `auto-sync-google-fit`: Meant for frequent (5 min) syncs, not currently scheduled
- `sync-all-users-direct`: Scheduled daily, syncs 30 days back

**Recommendation**: 
- ✅ **KEEP** `sync-all-users-direct` (already scheduled and working)
- ❌ **DELETE** `auto-sync-google-fit` (redundant, not scheduled)

### ⚠️ Issue #2: Duplicate Activity Type Mappings
All sync functions have the same activity type mapping logic duplicated across files.

**Recommendation**: 
- Extract to `supabase/functions/_shared/google-fit-activities.ts`
- Share across all functions

### ⚠️ Issue #3: Old Supabase URL in Cron Job
Migration file has hardcoded URL: `https://qiwndzsrmtxmgngnupml.supabase.co`
Current URL should be: `https://eecdbddpzwedficnpenm.supabase.co`

**Recommendation**:
- Create new migration to update the cron job URL
- Use environment variable or pg_settings instead

## Action Items

### Priority 1: Delete Redundant Function
```bash
# Delete auto-sync-google-fit (not scheduled, redundant)
npx supabase functions delete auto-sync-google-fit
rm -rf supabase/functions/auto-sync-google-fit
```

### Priority 2: Fix Cron Job URL
Create migration: `20251011120000_fix_google_fit_cron_url.sql`

### Priority 3: Update CORS Headers
Update `sync-all-users-direct/index.ts` CORS headers

### Priority 4: Extract Shared Code
Create `_shared/google-fit-activities.ts` with:
- Activity type mappings
- Activity filtering logic
- Normalization functions

## Final Function List (After Cleanup)

**User-Facing Sync:**
1. `fetch-google-fit-data` - Real-time user sync
2. `sync-historical-google-fit-data` - Backfill historical data

**Background Jobs:**
3. `sync-all-users-direct` - Daily batch sync (cron)

**Token Management:**
4. `store-google-token` - Initial OAuth storage
5. `refresh-google-fit-token` - Individual token refresh
6. `refresh-all-google-tokens` - Batch token refresh
7. `refresh-expiring-google-tokens` - Cron token refresh (if scheduled)

**Total**: 6-7 functions (down from 8)
