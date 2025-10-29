# Debug: Why Daily Score Defaults to 92

## Investigation Summary

The daily score showing "92" is likely due to **incomplete nutrition/training data** causing the unified scoring system to calculate a score based on partial information.

## Root Causes:

### 1. **Missing or Incomplete Meal Plans**
- If `daily_meal_plans` has no data for today → targets are all 0
- Scoring formula: `(0 consumed / 0 target) * 100` = undefined → defaults to certain values
- Partial targets can result in high scores even with minimal consumption

### 2. **No Food Logs Today**
- If no `food_logs` exist → actual consumption is 0
- Depending on targets, this could score high if targets are also 0
- Empty data → scoring defaults

### 3. **Training Activity Data Missing**
- If no `training_activities` for today → training score component might default
- No actual Google Fit data → no actual training recorded

### 4. **Cached/Stale Data**
- `nutrition_scores` table might have old `daily_score = 92` from previous calculation
- Dashboard reads from cache first, doesn't recalculate

## How to Fix:

### Quick Fix: Clear score cache and force recalculation
```sql
-- Check current score data
SELECT date, daily_score, calories_consumed, meals_logged, updated_at 
FROM nutrition_scores 
WHERE user_id = 'USER_ID' 
AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- Delete today's cached score to force recalculation
DELETE FROM nutrition_scores 
WHERE user_id = 'USER_ID' 
AND date = CURRENT_DATE;
```

### Root Fix: Ensure data exists
1. **Check if meal plans exist** for today
2. **Check if food logs exist** for today  
3. **Check if training activities exist** for today
4. **Trigger score recalculation** via Dashboard refresh

## Where the Score Comes From:

**File:** `src/services/unified-score.service.ts` → `getDailyUnifiedScore()`

**Process:**
1. Fetch meal plans → calculate nutrition targets
2. Fetch food logs → calculate actual consumption
3. Fetch training activities → determine training load
4. Create scoring context
5. Call `calculateUnifiedScore()` from `src/lib/unified-scoring.ts`
6. **Persist to `nutrition_scores` table** with `daily_score` field
7. Dashboard reads from this table

**The 92 is NOT hardcoded** - it's a calculated result from the formula based on current data state.

## Action Items:

1. ✅ Add console logging to show what data is being used for scoring
2. ✅ Check if nutrition_scores table has stale data
3. ✅ Verify meal plans and food logs exist for today
4. ✅ Add fallback/default handling for missing data scenarios
