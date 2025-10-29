# 🔍 Google Token & Sync Integration Audit

**Date:** October 17, 2025  
**Goal:** Check integration between token management, data sync, and recovery widget

---

## 📊 Current Architecture

### 1. Token Management

#### Cron Job (Every 10 minutes)
```sql
-- supabase/migrations/20251008000000_schedule_google_token_refresh.sql

SELECT cron.schedule(
  'refresh-google-fit-tokens',
  '*/10 * * * *',  -- Every 10 minutes
  $$
    SELECT net.http_post(
      url := '.../refresh-expiring-google-tokens',  -- ⚠️ EMPTY FUNCTION!
      ...
    );
  $$
);
```

**Status:** ❌ **BROKEN**
- Calls `refresh-expiring-google-tokens` which is **0 bytes (EMPTY)**
- Should call `refresh-all-google-tokens` instead

---

### 2. Data Sync

#### Cron Job (Daily at 01:15 UTC)
```sql
-- supabase/migrations/20251008010000_schedule_google_fit_sync.sql

SELECT cron.schedule(
  'sync-google-fit-daily',
  '15 1 * * *',  -- Daily at 01:15 UTC
  $$
    SELECT net.http_post(
      url := '.../sync-all-users-direct',
      body := jsonb_build_object('daysBack', 30)
    );
  $$
);
```

**Status:** ✅ **WORKS** but ⚠️ **TOO INFREQUENT**
- Only runs once per day
- Not ideal for instant recovery (should be more frequent)

#### Frontend Auto-Sync (Every 5 minutes)
```typescript
// src/hooks/useGoogleFitSync.ts (line 91-144)

// Auto-sync every 5 minutes if connected
const interval = setInterval(() => {
  debouncedSync();
}, 5 * 60 * 1000);  // 5 minutes

// Also syncs on:
- App focus (window.addEventListener('focus'))
- Back online (window.addEventListener('online'))
- If last sync > 5 minutes ago
```

**Status:** ✅ **WORKS**
- Syncs every 5 minutes when app is open
- Syncs on app resume
- Good for foreground detection

---

### 3. Recovery Widget Detection

#### Dashboard Integration (line 790-803)
```typescript
// src/components/Dashboard.tsx

// Gets cached Google Fit data
const exerciseData = cachedTodayData || await getTodayData();

// Extracts sessions
const sessions = exerciseData.sessions || [];
sessions.sort((a, b) => parseInt(b.endTimeMillis) - parseInt(a.endTimeMillis));
const latest = sessions[0];

if (latest) {
  const ended = parseInt(latest.endTimeMillis);
  const isRecent = Date.now() - ended < 6 * 60 * 60 * 1000; // 6 hours
  
  if (isRecent && id !== lastAck) {
    setNewActivity({ actual: activityType, sessionId: id });
  }
}
```

**Status:** ✅ **WORKS** but ⚠️ **CACHE DEPENDENCY**
- Relies on cached Google Fit data
- Doesn't trigger fresh sync before checking
- May miss recent workouts if cache is stale

---

## ❌ Integration Issues

### Issue 1: Broken Token Refresh Cron ⚠️ CRITICAL

**Problem:**
```
Cron Job (every 10 min)
  ↓
Calls: refresh-expiring-google-tokens
  ↓
❌ FUNCTION IS EMPTY (0 bytes)
  ↓
Tokens don't get refreshed automatically
  ↓
⚠️ API calls fail when tokens expire
```

**Impact:**
- Tokens expire without refresh
- Sync fails for users with expired tokens
- Recovery detection breaks

**Fix:**
```sql
-- Update cron to call correct function
SELECT cron.schedule(
  'refresh-google-fit-tokens',
  '*/15 * * * *',  -- Every 15 minutes
  $$
    SELECT net.http_post(
      url := '.../refresh-all-google-tokens',  -- ✅ Use working function
      ...
    );
  $$
);
```

---

### Issue 2: Sync Frequency Mismatch

**Problem:**
```
Backend Sync: Daily (01:15 UTC)
  ↓
Recovery Window: 30 minutes
  ↓
❌ MISMATCH: 24 hours vs 30 minutes
```

**Current Flow:**
```
User finishes workout (8:00 AM)
  ↓
Backend sync ran 7 hours ago (1:15 AM)
  ↓
Frontend sync depends on user opening app
  ↓
⚠️ No automatic detection if app closed
```

**Impact:**
- Backend sync too infrequent for instant recovery
- Relies entirely on frontend sync (only when app open)
- Works on iOS (foreground) but not Android background

**Fix:**
```sql
-- Option 1: More frequent backend sync (every 10 minutes)
SELECT cron.schedule(
  'sync-google-fit-frequent',
  '*/10 * * * *',
  $$
    SELECT net.http_post(
      url := '.../sync-all-users-direct',
      body := jsonb_build_object('daysBack', 1)  -- Only today
    );
  $$
);

-- Option 2: Keep daily full sync + frequent recent check
-- (Better for API rate limits)
```

---

### Issue 3: No Sync-to-Detection Pipeline

**Problem:**
```typescript
// Dashboard loads cached data
const cachedTodayData = await readDashboardCache(cacheKey);
const exerciseData = cachedTodayData || await getTodayData();

// Checks for recent workouts in cached data
const sessions = exerciseData.sessions;
// ⚠️ If cache is stale, misses recent workouts
```

**Current Flow:**
```
Dashboard mounts
  ↓
Reads cache (may be stale)
  ↓
Checks for recent workouts in cache
  ↓
❌ Doesn't trigger fresh sync first
  ↓
May miss workouts that just ended
```

**Impact:**
- Recovery widget may not appear immediately
- Depends on:
  1. useGoogleFitSync auto-sync (5 min intervals)
  2. Cache being recent
  3. User opening app after sync completes

**Fix:**
```typescript
// Option 1: Always fresh sync on mount
useEffect(() => {
  syncGoogleFit(true); // Silent sync
  loadDashboardData();
}, []);

// Option 2: Smart cache check
if (!cachedTodayData || cacheAge > 5 * 60 * 1000) {
  await syncGoogleFit(true);
  const freshData = await getTodayData();
  // Check for workouts in fresh data
}
```

---

### Issue 4: Token Refresh Not Integrated with Sync

**Problem:**
```
Token Refresh (every 10 min) → EMPTY function ❌
  ↓ (no connection)
Data Sync (daily) → May fail if token expired
  ↓ (no retry with fresh token)
❌ Sync fails, no sessions, no recovery detection
```

**Better Architecture:**
```
Unified Job (every 10-15 min)
  ↓
1. Refresh expiring tokens
  ↓
2. Sync data for users with recent activity
  ↓
3. Detect recent workouts
  ↓
4. Create notifications
  ↓
✅ Complete pipeline
```

---

## ✅ What Works Well

### Frontend Sync
```typescript
useGoogleFitSync() {
  // ✅ Auto-syncs every 5 minutes when app open
  // ✅ Syncs on app focus/resume
  // ✅ Syncs when back online
  // ✅ Debounced to prevent duplicates
  // ✅ Exponential backoff on errors
}
```

### Recovery Widget Component
```typescript
<RecoverySuggestion
  sessionEnd={...}
  intensity={...}
  // ✅ 30-minute countdown timer
  // ✅ Indonesian meal suggestions
  // ✅ PWA notifications
  // ✅ Dismiss tracking (localStorage)
/>
```

### Data Flow (When Fresh)
```
Google Fit API
  ↓
fetch-google-fit-data
  ↓
google_fit_sessions table
  ↓
google_fit_data.sessions (JSONB)
  ↓
Dashboard cache
  ↓
Recovery detection
  ↓
✅ Widget appears
```

---

## 🔧 Proposed Fixes

### Priority 1: Fix Token Refresh Cron ⚠️ CRITICAL

**Problem:** Calls empty function
**Fix:**

```sql
-- 1. Delete the empty function
DROP FUNCTION IF EXISTS refresh_expiring_google_tokens CASCADE;

-- 2. Update cron job
SELECT cron.unschedule('refresh-google-fit-tokens');

SELECT cron.schedule(
  'refresh-google-tokens',
  '*/15 * * * *',  -- Every 15 minutes
  $$
    SELECT net.http_post(
      url := 'https://qiwndzsrmtxmgngnupml.supabase.co/functions/v1/refresh-all-google-tokens',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      )
    );
  $$
);
```

**Files to create:**
- `supabase/migrations/YYYYMMDD_fix_token_refresh_cron.sql`

---

### Priority 2: Add Frequent Sync for Recovery Detection

**Problem:** Daily sync too infrequent
**Fix:**

```sql
-- Add frequent sync (every 10 minutes) for recent workouts
SELECT cron.schedule(
  'sync-google-fit-recent',
  '*/10 * * * *',  -- Every 10 minutes
  $$
    SELECT net.http_post(
      url := 'https://qiwndzsrmtxmgngnupml.supabase.co/functions/v1/sync-all-users-direct',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'daysBack', 1  -- Only sync today (more efficient)
      )
    );
  $$
);

-- Keep daily full sync for historical data
-- (rename to avoid confusion)
SELECT cron.unschedule('sync-google-fit-daily');
SELECT cron.schedule(
  'sync-google-fit-full',
  '15 1 * * *',  -- Daily at 01:15 UTC
  $$
    SELECT net.http_post(
      url := 'https://qiwndzsrmtxmgngnupml.supabase.co/functions/v1/sync-all-users-direct',
      body := jsonb_build_object('daysBack', 30)
    );
  $$
);
```

**Files to create:**
- `supabase/migrations/YYYYMMDD_add_frequent_sync.sql`

---

### Priority 3: Enhance Dashboard Detection

**Problem:** Relies on potentially stale cache
**Fix:**

```typescript
// src/components/Dashboard.tsx

// Add fresh sync trigger before recovery detection
useEffect(() => {
  if (!user) return;
  
  const checkForRecentWorkouts = async () => {
    try {
      // 1. Trigger fresh sync (silent)
      await syncGoogleFit(true);
      
      // 2. Wait a moment for sync to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 3. Get fresh data
      const freshData = await getTodayData();
      
      // 4. Check for recent workouts
      const sessions = freshData?.sessions || [];
      sessions.sort((a, b) => parseInt(b.endTimeMillis) - parseInt(a.endTimeMillis));
      const latest = sessions[0];
      
      if (latest) {
        const ended = parseInt(latest.endTimeMillis);
        const isRecent = Date.now() - ended < 6 * 60 * 60 * 1000;
        const lastAck = localStorage.getItem('lastAckSessionId');
        const id = `${latest.startTimeMillis}-${latest.endTimeMillis}`;
        
        if (isRecent && id !== lastAck) {
          setNewActivity({
            actual: `${latest.name} ${latest.distance ? (latest.distance/1000).toFixed(1) + ' km' : ''}`,
            sessionId: id
          });
        }
      }
    } catch (error) {
      console.error('Recent workout check failed:', error);
    }
  };
  
  // Check on mount
  checkForRecentWorkouts();
  
}, [user, syncGoogleFit]);
```

---

### Priority 4: Unified Token + Sync Function

**Problem:** Separate token refresh and sync
**Fix:** Create unified function

```typescript
// supabase/functions/unified-auto-sync/index.ts

serve(async (req) => {
  console.log('🔄 Unified Auto-Sync Started');
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // 1. Refresh expiring tokens
  console.log('1️⃣ Refreshing expiring tokens...');
  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('is_active', true)
    .lt('expires_at', new Date(Date.now() + 60 * 60 * 1000).toISOString()); // Expiring within 1 hour
  
  for (const token of tokens || []) {
    try {
      await refreshToken(token);
    } catch (error) {
      console.error(`Failed to refresh token for user ${token.user_id}:`, error);
    }
  }
  
  // 2. Sync data for all users (today only)
  console.log('2️⃣ Syncing Google Fit data...');
  const syncResult = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-all-users-direct`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ daysBack: 1 })
  });
  
  // 3. Detect recent workouts (< 30 min) and create notifications
  console.log('3️⃣ Detecting recent workouts...');
  const now = Date.now();
  const thirtyMinutesAgo = now - (30 * 60 * 1000);
  
  const { data: recentSessions } = await supabase
    .from('google_fit_sessions')
    .select('*')
    .gt('end_time', new Date(thirtyMinutesAgo).toISOString())
    .order('end_time', { ascending: false });
  
  // Group by user (take most recent per user)
  const userSessions = new Map();
  for (const session of recentSessions || []) {
    if (!userSessions.has(session.user_id)) {
      userSessions.set(session.user_id, session);
    }
  }
  
  // 4. Create recovery notifications
  let notificationsCreated = 0;
  for (const [userId, session] of userSessions) {
    try {
      const { data: existing } = await supabase
        .from('training_notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'recovery')
        .eq('training_date', new Date().toISOString().split('T')[0])
        .maybeSingle();
      
      if (!existing) {
        await supabase.from('training_notifications').insert({
          user_id: userId,
          type: 'recovery',
          title: 'Recovery Window Active',
          message: `${session.name} completed. Get your recovery nutrition now!`,
          scheduled_for: new Date().toISOString(),
          training_date: new Date().toISOString().split('T')[0],
          activity_type: session.activity_type,
          is_read: false,
          notes: JSON.stringify({
            session_id: session.session_id,
            end_time: session.end_time
          })
        });
        notificationsCreated++;
      }
    } catch (error) {
      console.error(`Failed to create notification for user ${userId}:`, error);
    }
  }
  
  console.log(`✅ Unified sync complete. Notifications created: ${notificationsCreated}`);
  
  return new Response(JSON.stringify({
    success: true,
    tokens_refreshed: tokens?.length || 0,
    sync_completed: true,
    notifications_created: notificationsCreated
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

**Then update cron:**
```sql
SELECT cron.schedule(
  'unified-auto-sync',
  '*/10 * * * *',  -- Every 10 minutes
  $$
    SELECT net.http_post(
      url := '.../unified-auto-sync',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      )
    );
  $$
);
```

---

## 📊 Before vs After

### Current Architecture (BROKEN)

```
Token Refresh Cron (every 10 min)
  ↓
❌ Calls EMPTY function
  ↓
Tokens expire

Data Sync Cron (daily)
  ↓
⚠️ May fail (expired tokens)
  ↓
❌ No sessions data

Dashboard (on open)
  ↓
Reads stale cache
  ↓
⚠️ May miss recent workouts
  ↓
Recovery widget doesn't appear
```

---

### Proposed Architecture (FIXED)

```
Unified Auto-Sync (every 10 min)
  ↓
1. Refresh expiring tokens ✅
  ↓
2. Sync all users (today) ✅
  ↓
3. Detect recent workouts ✅
  ↓
4. Create notifications ✅

Dashboard (on open)
  ↓
Triggers fresh sync ✅
  ↓
Checks fresh sessions data ✅
  ↓
Recovery widget appears ✅
```

---

## ⏱️ Implementation Time

```
Priority 1: Fix token refresh cron
├── Delete empty function
├── Update cron job
└── Test token refresh
Time: 30 minutes ⚠️ URGENT

Priority 2: Add frequent sync
├── Create new cron job (every 10 min)
├── Keep daily full sync
└── Test sync frequency
Time: 30 minutes

Priority 3: Enhance Dashboard detection
├── Add fresh sync on mount
├── Update recovery detection logic
└── Test on iOS/Android
Time: 1 hour

Priority 4: Unified function (optional)
├── Create unified-auto-sync function
├── Update cron job
├── Test complete pipeline
└── Monitor performance
Time: 2 hours

TOTAL: 4 hours (2 hours for critical fixes)
```

---

## 🎯 Recommended Action Plan

### Phase 1: Critical Fixes (TODAY - 1 hour)

1. **Fix token refresh cron** (30 min) ⚠️
   - Update to call `refresh-all-google-tokens`
   - Delete empty function file
   - Test token refresh

2. **Add frequent sync** (30 min)
   - Create 10-minute sync cron
   - Keep daily full sync
   - Test sync frequency

### Phase 2: Enhancement (THIS WEEK - 1 hour)

3. **Enhance Dashboard detection** (1 hour)
   - Fresh sync on mount
   - Better cache handling
   - Test on devices

### Phase 3: Optimization (OPTIONAL - 2 hours)

4. **Unified auto-sync function**
   - Consolidate token + sync + detection
   - Single cron job
   - Complete pipeline

---

## ❓ Questions

1. **Should I implement Phase 1 now?** (Critical fixes)
2. **Want to wait and do all at once?**
3. **Just want documentation for now?**

Let me know and I'll start fixing the integration! 🚀

