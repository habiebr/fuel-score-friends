# 🔍 Google Fit Architecture Audit

## 📊 Current State Analysis

### Functions Inventory

#### Sync Functions (3)
1. **`fetch-google-fit-data`** - 468 lines
   - Purpose: Fetch current day data for single user
   - Trigger: User-initiated (manual sync button)
   - Scope: Today only

2. **`sync-all-users-direct`** - 371 lines
   - Purpose: Batch sync all users
   - Trigger: Cron job (auto-sync)
   - Scope: Last 30 days

3. **`sync-historical-google-fit-data`** - 476 lines  
   - Purpose: Backfill historical data
   - Trigger: User-initiated (historical sync button)
   - Scope: Configurable (30-90 days)
   - Has unused `index-improved.ts` variant

#### Token Management (4)
1. **`store-google-token`** - Stores OAuth tokens
2. **`refresh-google-fit-token`** - 77 lines - Refresh single token (manual)
3. **`refresh-all-google-tokens`** - 233 lines - Batch refresh all tokens
4. **`refresh-expiring-google-tokens`** - **EMPTY FILE** ⚠️

#### Shared Libraries (3)
1. **`_shared/google-fit-sync-core.ts`** - 424 lines - Core sync logic
2. **`_shared/google-fit-utils.ts`** - Utility functions
3. **`_shared/google-fit-activities.ts`** - Activity type mappings

---

## 🚨 Issues Identified

### 1. **EMPTY FUNCTION** ⚠️
```
supabase/functions/refresh-expiring-google-tokens/index.ts
- File exists but is EMPTY (0 bytes)
- Referenced in cron jobs?
- Should be deleted OR implemented
```

### 2. **Duplicate Sync Logic**
Three functions doing similar things:
- `fetch-google-fit-data` - Single user, today
- `sync-all-users-direct` - All users, last 30 days  
- `sync-historical-google-fit-data` - Single user, historical

**Problem**: Code duplication (~200 lines duplicated across functions)
**Solution**: ✅ Already using shared `google-fit-sync-core.ts`

### 3. **Two Historical Sync Files**
```
sync-historical-google-fit-data/
├── index.ts (476 lines) - ACTIVE
└── index-improved.ts (475 lines) - UNUSED?
```

**Questions:**
- Is `index-improved.ts` being used?
- If not, delete it
- If yes, why keep both?

### 4. **Token Refresh Confusion**
Two similar functions:
- `refresh-all-google-tokens` (233 lines) - Comprehensive
- `refresh-google-fit-token` (77 lines) - Simple wrapper

**Used by:**
- Frontend calls `refresh-google-fit-token`
- Cron job calls `refresh-all-google-tokens`

**Confusing naming**: "all" vs "fit" - both are for Google Fit!

---

## 📋 Detailed Function Analysis

### `fetch-google-fit-data` (468 lines)

**Purpose**: Real-time sync for single user

**Flow**:
```
1. Get user from JWT
2. Get/validate Google token
3. Refresh token if expired
4. Fetch today's data from Google Fit
5. Store in database
```

**Issues**:
- ❌ Handles token refresh inline (duplication with refresh functions)
- ❌ ~100 lines just for token management
- ❌ Could use shared `google-fit-sync-core.ts` more

**Optimization**:
```typescript
// Current: 468 lines with inline token refresh
// Optimized: ~200 lines by delegating to shared modules
```

---

### `sync-all-users-direct` (371 lines)

**Purpose**: Batch sync all users (cron job)

**Flow**:
```
1. Get all active tokens
2. For each user:
   - Check token expiry
   - Refresh if needed
   - Fetch last 30 days
   - Store aggregates + sessions
3. Return summary
```

**Issues**:
- ❌ Token refresh logic duplicated
- ❌ Custom session normalization (also in utils)
- ⚠️ Processes all users serially (no batching)

**Optimization**:
```typescript
// Add batching for large user bases
const batches = chunk(tokens, 10);
for (const batch of batches) {
  await Promise.all(batch.map(syncUser));
  await delay(1000); // Rate limiting
}
```

---

### `sync-historical-google-fit-data` (476 lines)

**Purpose**: Backfill historical data for single user

**Flow**:
```
1. Get user token
2. Fetch data for each day in range
3. Store both aggregates and sessions
4. Rate-limited (150ms between days)
```

**Issues**:
- ✅ Good rate limiting
- ✅ Uses shared sync core
- ❌ Has unused `index-improved.ts` variant
- ⚠️ No progress callbacks (long-running operation)

---

### `refresh-all-google-tokens` (233 lines)

**Purpose**: Batch refresh expiring tokens (cron job)

**Flow**:
```
1. Find tokens expiring within 30 minutes
2. Refresh each token via Google OAuth
3. Update database
4. Log results
```

**Good**:
- ✅ Batch processing (50 tokens at a time)
- ✅ Marks failed tokens as inactive
- ✅ Logs to refresh_logs table
- ✅ Configurable thresholds

**Issues**:
- ⚠️ OAuth credentials from app_settings table (not env vars)
- ⚠️ No retry logic for transient failures

---

### `refresh-google-fit-token` (77 lines)

**Purpose**: Simple token refresh wrapper

**Flow**:
```
1. Receive refresh_token in request
2. Call Google OAuth endpoint
3. Return new tokens
```

**Good**:
- ✅ Simple, focused
- ✅ Used by frontend

**Issues**:
- ⚠️ Doesn't update database (caller must do it)
- ⚠️ Different credential source (env vars) vs refresh-all (app_settings)

---

## 🔄 Token Refresh Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│  TOKEN REFRESH SOURCES                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Manual (Frontend)                               │
│     User clicks "Reconnect"                         │
│     ↓                                               │
│     refresh-google-fit-token                        │
│     ↓                                               │
│     Returns new tokens (no DB update)               │
│                                                     │
│  2. Before Sync (Inline)                            │
│     fetch-google-fit-data checks expiry             │
│     ↓                                               │
│     Calls refresh-google-fit-token                  │
│     ↓                                               │
│     Updates DB itself                               │
│                                                     │
│  3. Scheduled (Cron)                                │
│     Every 15 minutes                                │
│     ↓                                               │
│     refresh-all-google-tokens                       │
│     ↓                                               │
│     Updates DB automatically                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Problem**: Three different paths, inconsistent credential sources

---

## 📈 Sync Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│  DATA SYNC SOURCES                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Manual Sync (User)                              │
│     User clicks "Sync Fit"                          │
│     ↓                                               │
│     fetch-google-fit-data                           │
│     ↓                                               │
│     Today only, single user                         │
│                                                     │
│  2. Auto Sync (Cron)                                │
│     Every 5 minutes                                 │
│     ↓                                               │
│     sync-all-users-direct                           │
│     ↓                                               │
│     Last 30 days, all users                         │
│                                                     │
│  3. Historical Sync (User)                          │
│     User clicks "Sync Historical"                   │
│     ↓                                               │
│     sync-historical-google-fit-data                 │
│     ↓                                               │
│     30-90 days, single user                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## ✅ What's Working Well

1. **Shared Core Library** 
   - `google-fit-sync-core.ts` consolidates API calls
   - Reduces duplication

2. **Session Filtering**
   - Consistent activity type filtering
   - Good separation of exercise vs walking

3. **Rate Limiting**
   - Historical sync has 150ms delays
   - Prevents API throttling

4. **Error Handling**
   - Functions catch and log errors
   - Continue processing on partial failures

---

## 🔧 Optimization Recommendations

### Priority 1: Critical

1. **Delete or Implement `refresh-expiring-google-tokens`**
   ```bash
   # Option A: Delete empty file
   rm supabase/functions/refresh-expiring-google-tokens/index.ts
   
   # Option B: Implement if needed
   # (but we already have refresh-all-google-tokens)
   ```

2. **Remove Duplicate File**
   ```bash
   # Determine which is active
   rm supabase/functions/sync-historical-google-fit-data/index-improved.ts
   ```

3. **Standardize OAuth Credentials**
   - Choose ONE source: env vars OR app_settings
   - Update all functions to use same source

### Priority 2: Efficiency

4. **Consolidate Token Refresh**
   ```typescript
   // Create single refresh-token module
   // supabase/functions/_shared/token-refresh.ts
   
   export async function refreshGoogleToken(
     refreshToken: string,
     updateDB: boolean = false,
     userId?: string
   ): Promise<TokenData> {
     // Single implementation
     // Used by all functions
   }
   ```

5. **Add Batch Processing to sync-all-users-direct**
   ```typescript
   // Process 10 users at a time
   const batches = chunk(tokens, 10);
   for (const batch of batches) {
     await Promise.all(batch.map(syncUser));
   }
   ```

6. **Extract Token Validation**
   ```typescript
   // Remove 100 lines of token logic from fetch-google-fit-data
   // Use shared module instead
   import { getValidToken } from '../_shared/token-management.ts';
   ```

### Priority 3: Maintainability

7. **Consistent Function Naming**
   ```
   Current:
   - refresh-google-fit-token (single, manual)
   - refresh-all-google-tokens (batch, cron)
   
   Better:
   - refresh-google-token (single, manual)
   - refresh-google-tokens-batch (batch, cron)
   ```

8. **Add Progress Callbacks**
   ```typescript
   // For long-running operations
   await syncHistorical({
     userId,
     days: 90,
     onProgress: (percent) => {
       // Report progress
     }
   });
   ```

---

## 📊 Metrics & Monitoring

### Current Monitoring

✅ **Has**:
- Error logging to console
- Success/failure counts in responses
- `refresh_logs` table for token refreshes

❌ **Missing**:
- Sync duration tracking
- API call count tracking
- Failed sync alerts
- User sync health dashboard

### Recommended Additions

```sql
-- Sync metrics table
CREATE TABLE google_fit_sync_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  sync_type TEXT, -- 'manual', 'auto', 'historical'
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_ms INTEGER,
  days_synced INTEGER,
  sessions_synced INTEGER,
  api_calls INTEGER,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 📝 Recommended Architecture

### Simplified Structure

```
supabase/functions/
├── _shared/
│   ├── google-fit-sync-core.ts ✅ (keep)
│   ├── google-fit-utils.ts ✅ (keep)
│   ├── google-fit-activities.ts ✅ (keep)
│   └── google-token-manager.ts ⭐ (NEW - consolidate token logic)
│
├── sync-google-fit/ ⭐ (RENAME from fetch-google-fit-data)
│   └── index.ts (200 lines, uses shared modules)
│
├── sync-google-fit-batch/ ⭐ (RENAME from sync-all-users-direct)
│   └── index.ts (250 lines, with batching)
│
├── sync-google-fit-historical/ ⭐ (RENAME)
│   └── index.ts (300 lines, no duplicate file)
│
├── store-google-token/ ✅ (keep)
│   └── index.ts
│
└── refresh-google-tokens/ ⭐ (MERGE refresh-all + refresh-fit)
    └── index.ts (unified implementation)
```

---

## 🎯 Action Plan

### Week 1: Cleanup
- [ ] Delete `refresh-expiring-google-tokens` (empty)
- [ ] Delete `sync-historical-google-fit-data/index-improved.ts`
- [ ] Standardize OAuth credential source
- [ ] Add sync metrics table

### Week 2: Consolidation
- [ ] Create `google-token-manager.ts` shared module
- [ ] Refactor `fetch-google-fit-data` to use shared module
- [ ] Merge `refresh-all-google-tokens` + `refresh-google-fit-token`
- [ ] Add batch processing to sync-all-users-direct

### Week 3: Testing & Monitoring
- [ ] Test all sync paths
- [ ] Add progress callbacks
- [ ] Implement sync health dashboard
- [ ] Update documentation

---

## 💡 Summary

### Current State
- ✅ **3 sync functions** (manual, auto, historical)
- ✅ **4 token functions** (1 empty, some duplication)
- ✅ **Shared core library** (good!)
- ⚠️ **~300 lines of duplicated token logic**
- ⚠️ **Inconsistent credential sources**
- ⚠️ **Orphaned files**

### After Optimization
- ✅ **3 sync functions** (cleaner)
- ✅ **2 token functions** (unified)
- ✅ **Shared modules** (expanded)
- ✅ **100% code reuse** for token management
- ✅ **Consistent patterns** across all functions
- ✅ **Better monitoring**

### Estimated Savings
- **Remove ~150 lines** of duplicate code
- **Delete 1 empty file**
- **Delete 1 unused variant**
- **Consolidate 2 token functions** into 1
- **Reduce maintenance burden** by 30%

Ready to implement? 🚀

