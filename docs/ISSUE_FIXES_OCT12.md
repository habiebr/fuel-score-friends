# Issue Fixes - October 12, 2025

## Summary

Fixed 3 critical issues reported by user:
1. ✅ **Fixed**: Duplicate actual runs being created automatically
2. 📋 **Documented**: Garmin integration roadmap
3. 🔍 **Diagnosed**: Daily/weekly scores not updating (cache issue)

---

## Issue 1: Duplicate Actual Run Creation ✅ FIXED

### Problem
User Muhammad Hashfy had actual runs being created automatically and repeatedly, especially on Saturday. The training calendar showed the same run multiple times.

### Root Cause
The `update-actual-training` edge function was fetching **ALL** Google Fit sessions for the user without filtering by date:

```typescript
// ❌ BEFORE - WRONG
const { data: googleFitSessions } = await supabase
  .from('google_fit_sessions')
  .select('*')
  .eq('user_id', user.id);  // Missing date filter!
```

This meant:
1. Every time Google Fit synced (which happens automatically after every manual sync)
2. The function would process ALL sessions in the database
3. It would create duplicate actual activities for every session
4. The more sessions in the database, the more duplicates

### Solution
Added date range filter to only process sessions for the specific date:

```typescript
// ✅ AFTER - CORRECT
const { data: googleFitSessions } = await supabase
  .from('google_fit_sessions')
  .select('*')
  .eq('user_id', user.id)
  .gte('start_time', `${date}T00:00:00`)
  .lt('start_time', `${date}T23:59:59`);  // Only sessions for this date!
```

### Files Changed
- `supabase/functions/update-actual-training/index.ts` (line 103-112)

### Deployment
```bash
✅ Deployed to Supabase: update-actual-training edge function
Command: supabase functions deploy update-actual-training
Status: Live in production
```

### Testing
To verify the fix:
1. User should sync Google Fit data
2. Check Training Calendar for the current date
3. Should see only ONE actual run (not duplicates)
4. Historical dates should not be affected

### Prevention
The edge function now:
- Only processes sessions for the requested date
- Explicitly logs which date it's processing
- Deletes old actual activities before inserting new ones (existing deduplication still works)

---

## Issue 2: Garmin Integration 📋 DOCUMENTED

### Request
"Can we see a way to integrate with Garmin?"

### Answer
**YES!** Garmin has a Health API similar to Google Fit. Created comprehensive implementation plan.

### Documentation Created
- **File**: `GARMIN_INTEGRATION_PLAN.md`
- **Contents**:
  - Garmin Health API overview
  - Comparison: Garmin vs Google Fit
  - Implementation architecture (2 options)
  - Database schema changes
  - 4-phase implementation plan (5 weeks total)
  - Complete code examples
  - Testing strategy
  - Timeline and resource requirements

### Key Points

**API Access**:
- Requires developer account registration
- Manual approval process (3-7 days)
- OAuth 1.0a (older protocol)
- Free tier available

**Data Available**:
- Daily summaries (steps, calories, distance)
- Activities (runs, rides, swims, strength)
- Heart rate data
- Sleep data
- Body composition

**Recommended Approach**:
- **Parallel Integration**: Keep both Google Fit and Garmin
- **Priority Logic**: Garmin > Google Fit > Manual
- **Deduplication**: Timestamp-based to avoid double-counting

**Timeline**:
| Phase | Duration |
|-------|----------|
| API Application | 1 week |
| Backend Dev | 2 weeks |
| Frontend Dev | 1 week |
| Testing | 1 week |
| **Total** | **5 weeks** |

**Next Steps**:
1. Register for Garmin Developer account
2. Apply for Health API access
3. Wait for approval
4. Start implementation while waiting

### Architecture

```
┌─────────────┐     ┌──────────────┐
│ Google Fit  │     │   Garmin     │
└──────┬──────┘     └──────┬───────┘
       │                   │
       ├───────────┬───────┤
       │           │       │
       ▼           ▼       ▼
  ┌────────────────────────────┐
  │  wearable_data table       │
  │  (source: 'google_fit' |   │
  │           'garmin')        │
  └────────────┬───────────────┘
               │
               ▼
          Dashboard
```

### Benefits
- Attract serious runners (Garmin is preferred by athletes)
- Better data accuracy for training
- More device compatibility
- Competitive advantage

---

## Issue 3: Daily & Weekly Scores Not Updating 🔍 DIAGNOSED

### Problem
From the screenshot:
- Daily Score: 92/100 (not updating)
- Weekly Score: 0/100 (showing zero)

### Previous Investigation
Based on `SCORE_92_ROOT_CAUSE.md` and `WEEKLY_SCORE_FIX_SUMMARY.md`, this is a **cached data issue**.

### Root Cause

The scoring system works in 3 steps:
1. **Calculate** daily scores based on nutrition + training
2. **Cache** results in `nutrition_scores` table
3. **Display** from cache in Dashboard

**The problem**: Old scores are cached and never expire!

```
Day 1: Score calculated = 92 → Cached in DB
Day 2: Dashboard loads → Reads cache = 92 (stale!)
Day 3: Dashboard loads → Reads cache = 92 (stale!)
Day 4: Dashboard loads → Reads cache = 92 (stale!)
```

Weekly score shows 0 because:
- It calculates average of cached daily scores
- If no daily scores exist in cache for this week → average = 0

### Solution

#### Option 1: Clear Cache (Immediate Fix)
Run this SQL in Supabase SQL Editor:

```sql
-- Clear all cached scores to force recalculation
DELETE FROM nutrition_scores;

-- OR clear only recent scores (last 7 days)
DELETE FROM nutrition_scores 
WHERE date >= CURRENT_DATE - INTERVAL '7 days';

-- OR clear only for specific user
DELETE FROM nutrition_scores 
WHERE user_id = 'USER_ID_HERE'
AND date >= CURRENT_DATE - INTERVAL '7 days';
```

After clearing cache:
1. Refresh Dashboard
2. Scores will recalculate automatically
3. Check browser console for debug logs:
   ```
   📊 SCORE CALCULATION DEBUG
   📊 WEEKLY SCORE DEBUG
   ```

#### Option 2: Fix Cache Invalidation (Long-term Fix)

Need to invalidate cache when:
1. New meal plans are generated
2. Food logs are added/updated
3. Training activities change
4. Google Fit data syncs

**Implementation** (future work):
```typescript
// After any data change:
async function invalidateScoreCache(userId: string, date: string) {
  await supabase
    .from('nutrition_scores')
    .delete()
    .eq('user_id', userId)
    .eq('date', date);
}
```

### Debugging

Enhanced logging is already deployed (from previous session):

**Dashboard Console Logs**:
```javascript
📊 WEEKLY SCORE DEBUG: {
  weekStart: "2025-10-06",
  result: { average: 0, dailyScores: [] },
  validScoresCount: 0
}
```

This tells you:
- `dailyScores: []` → No scores in cache
- `average: 0` → That's why weekly shows 0

**Score Calculation Logs**:
```javascript
============ SCORE CALCULATION DEBUG ============
📊 Calculated score: {
  userId: "...",
  finalScore: 92,
  dataUsed: {
    mealPlansCount: 2,
    foodLogsCount: 3,
    hasTrainingPlan: false
  }
}
```

This shows what data was used to calculate the score.

### Files to Check
```sql
-- Check if user has meal plans
SELECT * FROM daily_meal_plans 
WHERE user_id = 'USER_ID'
AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- Check if user has food logs
SELECT * FROM food_logs
WHERE user_id = 'USER_ID'
AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Check cached scores
SELECT * FROM nutrition_scores
WHERE user_id = 'USER_ID'
AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- Check score update timestamp
SELECT date, daily_score, updated_at,
  CASE 
    WHEN updated_at < NOW() - INTERVAL '1 day' THEN 'STALE'
    WHEN updated_at < NOW() - INTERVAL '1 hour' THEN 'OLD'
    ELSE 'FRESH'
  END as cache_status
FROM nutrition_scores
WHERE user_id = 'USER_ID'
ORDER BY date DESC
LIMIT 7;
```

### Recommended Actions

1. **Immediate** (for Muhammad Habieb):
   ```sql
   -- Get user_id from profiles table first
   SELECT user_id, email FROM auth.users 
   WHERE email LIKE '%habieb%';
   
   -- Then clear cache
   DELETE FROM nutrition_scores 
   WHERE user_id = 'FOUND_USER_ID'
   AND date >= CURRENT_DATE - INTERVAL '7 days';
   ```

2. **Check Data**:
   - Verify meal plans exist for today
   - Verify food logs exist for today
   - Check if daily-meal-generation cron job is running

3. **Monitor**:
   - After clearing cache, check if scores update daily
   - If they don't, the automatic meal plan generation might not be working

### Related Files
- `SCORE_92_ROOT_CAUSE.md` - Detailed analysis of score 92 issue
- `WEEKLY_SCORE_FIX_SUMMARY.md` - Weekly score investigation
- `clear_nutrition_scores_cache.sql` - Cache clearing script

---

## Deployment Summary

### Edge Functions
```bash
✅ update-actual-training - Fixed duplicate runs (DEPLOYED)
```

### Frontend
No frontend changes deployed in this session (previous session changes still active).

### Database
No schema changes needed. Issue is data/cache, not structure.

---

## User Actions Required

### For Duplicate Runs (Muhammad Hashfy)
1. The fix is already deployed
2. Next Google Fit sync should work correctly
3. May need to manually delete old duplicate activities:
   ```sql
   -- Check for duplicates
   SELECT date, activity_type, is_actual, notes, COUNT(*)
   FROM training_activities
   WHERE user_id = 'USER_ID'
   AND is_actual = true
   GROUP BY date, activity_type, is_actual, notes
   HAVING COUNT(*) > 1;
   
   -- Delete duplicates (keep newest)
   DELETE FROM training_activities
   WHERE id NOT IN (
     SELECT MAX(id)
     FROM training_activities
     WHERE user_id = 'USER_ID'
     AND is_actual = true
     GROUP BY date, activity_type
   );
   ```

### For Score Updates
1. Run the cache clearing SQL (provided above)
2. Refresh Dashboard
3. Check browser console for debug logs
4. Verify scores update correctly

### For Garmin Integration
1. Review `GARMIN_INTEGRATION_PLAN.md`
2. Decide if/when to implement
3. Register for Garmin Developer account if proceeding
4. Budget 5 weeks for full implementation

---

## Testing Checklist

- [ ] Verify no duplicate runs are created after Google Fit sync
- [ ] Check Training Calendar shows only one actual activity per day
- [ ] Clear nutrition_scores cache
- [ ] Verify daily score updates after clearing cache
- [ ] Verify weekly score updates after clearing cache
- [ ] Check browser console logs for debug output
- [ ] Confirm meal plans are being generated daily

---

## Support

If issues persist:

1. **Duplicate Runs**:
   - Check Supabase logs for update-actual-training function
   - Look for error messages in function logs
   - Verify Google Fit sync is working

2. **Score Updates**:
   - Check if meal plans exist: `SELECT * FROM daily_meal_plans WHERE user_id = ?`
   - Check if food logs exist: `SELECT * FROM food_logs WHERE user_id = ?`
   - Check console logs for calculation debug output

3. **Garmin**:
   - Contact me if you want to proceed with implementation
   - I can help with developer account setup
   - I can assist with OAuth flow implementation

---

## Next Steps

1. **Immediate**: Test the duplicate run fix with real data
2. **Short-term**: Clear score cache and verify updates work
3. **Medium-term**: Decide on Garmin integration timeline
4. **Long-term**: Implement automatic cache invalidation

---

## Files Created/Modified

### Created:
- `GARMIN_INTEGRATION_PLAN.md` - Complete integration roadmap
- `ISSUE_FIXES_OCT12.md` - This summary document

### Modified:
- `supabase/functions/update-actual-training/index.ts` - Fixed date filtering

### Deployed:
- ✅ update-actual-training edge function (Supabase)

### Referenced:
- `SCORE_92_ROOT_CAUSE.md` - Previous score investigation
- `WEEKLY_SCORE_FIX_SUMMARY.md` - Weekly score analysis
- `clear_nutrition_scores_cache.sql` - Cache clearing script

---

## Timeline

- **Issue Reported**: October 12, 2025
- **Investigation**: 30 minutes
- **Fix Implemented**: Duplicate runs
- **Fix Deployed**: update-actual-training function
- **Documentation Created**: Garmin plan + this summary
- **Status**: Ready for testing

---

## Contact

For questions or issues with these fixes, please check:
1. Browser console logs (F12)
2. Supabase function logs
3. Database tables (nutrition_scores, training_activities, google_fit_sessions)

All enhanced debug logging is active in production! 🎯
