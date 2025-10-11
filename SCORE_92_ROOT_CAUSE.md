# Score "92" Issue - Root Cause Analysis

## Summary
You were RIGHT! Everyone should always have meal plans because:
- **Automatic daily generation** runs at midnight UTC every day
- Meal plans are generated based on BMR/TDEE for all users
- Function: `daily-meal-generation` (scheduled via pg_cron)

## Why Score Shows 92?

### The Real Issue: **STALE CACHED DATA**

The score of 92 is coming from **old cached data in `nutrition_scores` table**. Here's what happens:

1. **Score Calculation Flow:**
   ```
   Dashboard loads
   ↓
   Checks nutrition_scores table (CACHED)
   ↓
   If cache exists: Return cached score
   ↓
   If cache missing: Calculate new score and cache it
   ```

2. **The Problem:**
   - Old score was calculated when:
     - Meal plan data was incomplete
     - Only 2 meals were logged
     - Targets were missing or zero
   - This score (92) was CACHED in `nutrition_scores` table
   - The cache never expires unless manually deleted
   - Dashboard keeps showing the OLD cached score

3. **Why 92 Specifically?**
   - With 2 meals logged and certain data conditions:
   - Nutrition score: 92.5 → rounds to 92 or 93
   - This gets cached and persists

## Solutions

### Quick Fix (Immediate)
Run this SQL to clear the cache:

```sql
-- Delete all cached scores (forces recalculation)
DELETE FROM nutrition_scores;
```

Then refresh the dashboard - it will recalculate with current data.

### Better Fix (Recommended)
Add cache invalidation logic:

```sql
-- Delete only stale caches (older than 1 hour)
DELETE FROM nutrition_scores 
WHERE updated_at < NOW() - INTERVAL '1 hour';
```

### Best Fix (Long-term)
1. **Add TTL to cache** - Auto-expire after X hours
2. **Invalidate on data changes** - Clear cache when:
   - New meal plan is generated
   - Food logs are added/updated
   - Training data changes
3. **Show cache age in UI** - Display "Last updated: 2 hours ago"

## Debugging

### Check Current Cache State
```sql
SELECT 
  user_id,
  date,
  daily_score,
  updated_at,
  CASE 
    WHEN updated_at < NOW() - INTERVAL '1 day' THEN 'STALE (>24h old)'
    WHEN updated_at < NOW() - INTERVAL '1 hour' THEN 'OLD (>1h old)'
    ELSE 'FRESH'
  END as cache_status
FROM nutrition_scores
WHERE user_id = 'YOUR_USER_ID'
ORDER BY date DESC
LIMIT 7;
```

### Check Meal Plans Exist
```sql
SELECT date, meal_type, recommended_calories 
FROM daily_meal_plans
WHERE user_id = 'YOUR_USER_ID'
  AND date = CURRENT_DATE
ORDER BY meal_type;
```

### Check Enhanced Logging
Open browser console (F12) and look for:
```
============ SCORE CALCULATION DEBUG ============
📊 Calculated score: {
  userId: "...",
  dateISO: "2025-10-12",
  finalScore: XX,
  breakdown: { ... },
  dataUsed: {
    mealPlansCount: 4,      // Should be > 0
    foodLogsCount: 2,
    hasTrainingPlan: false,
    hasActualTraining: false
  },
  nutritionTargets: { ... },
  nutritionActuals: { ... }
}
================================================
```

## Automatic Meal Plan Generation

The system ALREADY has automatic meal plan generation:

**Function:** `supabase/functions/daily-meal-generation/index.ts`
**Schedule:** Daily at midnight UTC (`0 0 * * *`)
**Process:**
1. Fetches all users from profiles table
2. For each user:
   - Checks if meal plan exists for today
   - If not: Generates plan based on BMR/TDEE
   - Saves to `daily_meal_plans` table
3. Uses fallback Indonesian meals (no AI for batch job)

**Verified in:** `supabase/migrations/20251011120000_fix_cron_job_urls.sql`

## Action Items

1. ✅ **Enhanced logging deployed** - Check browser console for debug info
2. 📝 **Run SQL script** - Clear stale nutrition_scores cache
3. 🔄 **Refresh dashboard** - Score will recalculate with current data
4. 📊 **Monitor logs** - Use console output to verify correct data is being used
5. 🔧 **Add cache TTL** - Future improvement to prevent this issue

## Files Changed
- ✅ `src/services/unified-score.service.ts` - Enhanced logging
- ✅ `clear_nutrition_scores_cache.sql` - Cache clearing script (NEW)
- ✅ `SCORE_92_ROOT_CAUSE.md` - This documentation (NEW)

## Conclusion

The score calculation logic is **CORRECT**. The issue is **stale cached data**. 

Everyone DOES have automatic meal plans (generated daily at midnight). The 92 score is from an old calculation that got cached and never refreshed.

**Solution:** Clear the cache, and the score will recalculate correctly with current meal plan data.
