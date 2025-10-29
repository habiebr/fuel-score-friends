# Meal Score Display Bug Fix

**Date:** October 13, 2025  
**Issue:** Today's meal score showing 0% in Dashboard  
**Status:** ✅ FIXED

## Problem

The Dashboard's "Today's Nutrition Score" card was showing 0% even when users had logged meals and had a valid nutrition score.

### Root Cause

**Bug Location:** `src/components/Dashboard.tsx` line 1081-1082

**Incorrect Code:**
```typescript
<TodayMealScoreCard
  score={todayScore?.score || 0}  // ❌ todayScore is a number, not an object!
  rating={todayScore?.rating || 'Needs Improvement'}  // ❌ undefined, defaults to 'Needs Improvement'
/>
```

**Why it failed:**
1. `todayScore` is defined as a `number` (line 98): `const [todayScore, setTodayScore] = useState(0);`
2. `todayScore` is set to a number (line 750): `setTodayScore(unifiedScoreResult?.score || 0);`
3. But the component tries to access `todayScore.score` and `todayScore.rating` → undefined → 0%

**The correct object exists but wasn't used:**
```typescript
// Lines 928-933 - This object was created but never used!
const mealScore = {
  score: hasMainMeals ? nutritionScore : 0,
  rating: !hasMainMeals ? 'Needs Improvement' as const :
          nutritionScore >= 80 ? 'Excellent' as const :
          nutritionScore >= 65 ? 'Good' as const :
          nutritionScore >= 50 ? 'Fair' as const :
          'Needs Improvement' as const
};
```

## Solution

**Fixed Code:**
```typescript
<TodayMealScoreCard
  score={mealScore.score}  // ✅ Use the mealScore object
  rating={mealScore.rating}  // ✅ Get proper rating
/>
```

**File Changed:** `src/components/Dashboard.tsx` lines 1081-1082

## How It Works Now

### Meal Score Calculation (lines 926-933)

1. **Get nutrition score from unified scoring:**
   ```typescript
   const nutritionScore = todayBreakdown.nutrition || 0;
   ```

2. **Check if user logged main meals:**
   ```typescript
   const hasMainMeals = mainMeals.length > 0;  // breakfast, lunch, or dinner
   ```

3. **Create mealScore object with proper logic:**
   ```typescript
   const mealScore = {
     score: hasMainMeals ? nutritionScore : 0,  // Show 0 if only snacks
     rating: !hasMainMeals ? 'Needs Improvement' :
             nutritionScore >= 80 ? 'Excellent' :
             nutritionScore >= 65 ? 'Good' :
             nutritionScore >= 50 ? 'Fair' :
             'Needs Improvement'
   };
   ```

### Score Display Logic

| Condition | Score | Rating |
|-----------|-------|--------|
| No meals logged | 0% | Needs Improvement |
| Only snacks logged | 0% | Needs Improvement |
| Main meals logged, score 0-49 | 0-49% | Needs Improvement |
| Main meals logged, score 50-64 | 50-64% | Fair |
| Main meals logged, score 65-79 | 65-79% | Good |
| Main meals logged, score 80-100 | 80-100% | Excellent |

## Test Scenarios

### Scenario 1: User with Main Meals (Now Fixed ✅)

**Setup:**
- User logs breakfast: 400 kcal
- User logs lunch: 600 kcal
- Nutrition score: 75

**Before Fix:**
- Display: 0% (undefined.score → 0)
- Rating: "Needs Improvement" (undefined.rating → default)
- ❌ Wrong!

**After Fix:**
- Display: 75% (mealScore.score)
- Rating: "Good" (mealScore.rating)
- ✅ Correct!

### Scenario 2: User with Only Snacks (Still Works ✅)

**Setup:**
- User logs only snack: 150 kcal
- No main meals

**Both Before and After:**
- Display: 0% (intentional, no main meals)
- Rating: "Needs Improvement"
- ✅ Correct behavior!

### Scenario 3: No Meals Logged (Still Works ✅)

**Setup:**
- No food logged

**Both Before and After:**
- Display: 0%
- Rating: "Needs Improvement"
- ✅ Correct!

## Related Code

### Where todayScore is Used (Correctly)

`todayScore` as a number is correctly used in other places:

1. **Weekly Score Card** - Shows overall score number
2. **Score calculations** - Numeric comparisons
3. **Analytics** - Tracking score trends

These all work fine because they expect a number.

### Where mealScore is Used (Fixed)

`mealScore` object with `.score` and `.rating` properties is used in:

1. **TodayMealScoreCard** - The main meal score display (NOW FIXED ✅)
2. **Meal score logic** - Proper rating calculation

## Impact

### Before Fix:
- ❌ Meal score always shows 0% even with good nutrition
- ❌ User sees "Needs Improvement" even when eating well
- ❌ Demotivating for users who are actually doing well
- ❌ Dashboard data doesn't match reality

### After Fix:
- ✅ Meal score shows actual nutrition score (e.g., 75%)
- ✅ Proper rating displayed ("Good", "Excellent", etc.)
- ✅ Users see accurate feedback
- ✅ Dashboard reflects real performance

## Testing

**To verify the fix works:**

1. **Log some main meals** (breakfast, lunch, or dinner)
2. **Check Dashboard**
3. **Verify:**
   - Meal score shows a percentage > 0%
   - Rating matches score (Good for 65-79%, Excellent for 80+)
   - Card displays properly

**Example:**
- Log breakfast with good macros → Score shows 70%, rating "Good" ✅
- Log only a snack → Score shows 0%, rating "Needs Improvement" ✅

## Prevention

To prevent similar bugs in the future:

1. **Use TypeScript properly:**
   ```typescript
   // Define proper type for score objects
   type MealScore = {
     score: number;
     rating: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement';
   };
   
   const [mealScore, setMealScore] = useState<MealScore>({
     score: 0,
     rating: 'Needs Improvement'
   });
   ```

2. **Consistent naming:**
   - `todayScore` → number
   - `mealScore` → object with score and rating
   - Don't mix the two!

3. **Better variable names:**
   - `todayScoreNumber` or `overallScore` for numbers
   - `mealScoreData` or `nutritionScoreCard` for objects

## Summary

**Issue:** Meal score showing 0% due to accessing `.score` on a number  
**Fix:** Use the correct `mealScore` object that was already created  
**Impact:** Meal score now displays properly for all users  
**Testing:** Verify with real meal data that score shows correctly  

---

**Status:** ✅ Fixed and ready for testing  
**Files Changed:** `src/components/Dashboard.tsx` (1 line fix)
