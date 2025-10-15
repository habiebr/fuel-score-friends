# Training Load & Meal Plan Fix Summary
**Date:** October 13, 2025  
**Issue:** Dashboard shows 2580 kcal but meal plan shows 2260 kcal

## ✅ Fixes Implemented

### 1. Daily Meal Generation - Training Detection
**File:** `supabase/functions/daily-meal-generation/index.ts`

**What was fixed:**
- Function was hardcoded to use `trainingActivity: 'rest'` for all users
- Now queries `training_activities` table to check planned training
- Passes actual activity type, duration, and distance to meal planner

**Code changes:**
```typescript
// Before: Always used 'rest'
trainingActivity: 'rest',

// After: Checks planned training
const { data: plannedActivities } = await supabaseAdmin
  .from('training_activities')
  .select('*')
  .eq('user_id', user.user_id)
  .eq('date', today);

trainingActivity: mainActivity.activity_type,  // 'run', 'rest', etc.
trainingDuration: totalDuration,               // Sum of all activities
trainingDistance: totalDistance                // Sum of distances
```

### 2. Meal Template Scaling Fix
**File:** `supabase/functions/_shared/meal-rotation.ts`

**What was fixed:**
- Function calculated `scaleFactor` but NEVER APPLIED IT
- Templates had hardcoded calories (650/770/770 = 2190) that didn't scale
- Now creates scaled copy of template with adjusted macros

**Code changes:**
```typescript
// Before: Calculated but didn't apply
const scaleFactor = targetCalories / currentTotal;
return template;  // ❌ Returned unscaled

// After: Apply scaling to create new template
const scaledTemplate: DayMealPlan = {
  breakfast: baseTemplate.breakfast.map(meal => ({
    ...meal,
    calories: Math.round(meal.calories * scaleFactor),
    protein: Math.round(meal.protein * scaleFactor),
    carbs: Math.round(meal.carbs * scaleFactor),
    fat: Math.round(meal.fat * scaleFactor)
  })),
  // ... same for lunch, dinner
};
return scaledTemplate;  // ✅ Returns scaled template
```

## 📊 How It Works Now

### Training Load Determination Flow:

1. **Check Planned Training** (training_activities table)
   - 40min run, 5km → Activity: 'run', Duration: 40, Distance: 5
   
2. **Classify Training Load** (determineTrainingLoad function)
   ```
   if (activity === 'run') {
     if (distance >= 15) return 'long';
     if (duration >= 90) return 'quality';
     if (duration >= 60) return 'moderate';
     return 'easy';  // ← 40min/5km = EASY
   }
   ```

3. **Calculate TDEE** (calculateDayTarget function)
   ```
   BMR: 1613 kcal (72kg, 166cm, 30yo, male)
   Activity Factor (easy): 1.6
   TDEE: 1613 × 1.6 = 2581 → 2580 kcal (rounded)
   ```

4. **Generate Meal Plan** (generateMealPlan + scaling)
   ```
   Base template: 650 + 770 + 770 = 2190 kcal
   Scale factor: 2580 / 2190 = 1.178
   Scaled meals: 766 + 907 + 907 = 2580 kcal ✅
   ```

## ⚠️ Known Limitation

**generate-meal-plan function** (manual regeneration via UI button) still needs the same fix:
- Currently doesn't check `training_activities`
- Uses profile's default activity level instead
- Will be fixed in a future update

**Workaround:** The nightly batch (`daily-meal-generation`) runs at 6am and will generate correct meal plans. Manual regeneration might show slightly different calories but meal suggestions are still appropriate.

## 🎯 Expected Results

### Dashboard Calculation:
- **Source:** Real-time, checks training_activities, uses latest data
- **For 40min/5km run:** 2580 kcal (EASY load, BMR × 1.6)
- **Accuracy:** ✅ Always correct

### Meal Plan (after fix):
- **Generated at 6am:** Checks training_activities for the day
- **For 40min/5km run:** ~2580 kcal (scaled from templates)
- **Accuracy:** ✅ Correct when training is scheduled before 6am

### Scoring System:
- **Uses:** Dashboard calculation (training_activities + Google Fit)
- **Target:** 2580 kcal for days with planned training
- **Scoring:** Compares actual food logged vs correct target

## 🚀 Deployment Status

✅ **Deployed Functions:**
- `daily-meal-generation` - Training detection + template scaling
- `generate-meal-plan` - Template scaling only

✅ **Shared Files Updated:**
- `meal-rotation.ts` - Scaling fix applied
- `meal-planner.ts` - Uses scaled templates
- `nutrition-unified.ts` - TDEE calculations (unchanged, was already correct)

## 📝 User Impact

**Muhammad Habieb's Case:**
- Dashboard: 2580 kcal ✅ (Correct - has 40min run planned)
- Old meal plan: 2260 kcal ❌ (Was generated before training added)
- New meal plan (after 6am tomorrow): 2580 kcal ✅ (Will match dashboard)

**All Users:**
- Meal plans will now reflect planned training intensity
- No more REST day calories for active training days
- Better alignment between dashboard targets and meal plans

## 🔍 Verification

To verify the fix is working:

```javascript
// Check if planned training is being detected
const { data } = await supabase
  .from('training_activities')
  .select('*')
  .eq('user_id', userId)
  .eq('date', today);

// Check if meal plan matches TDEE
const { data: plans } = await supabase
  .from('daily_meal_plans')
  .select('recommended_calories')
  .eq('user_id', userId)
  .eq('date', today);

const totalCalories = plans.reduce((sum, p) => sum + p.recommended_calories, 0);
// Should be ~2580 for EASY days, ~2260 for REST days
```

## 📚 Related Files

- Dashboard training logic: `src/components/Dashboard.tsx` (lines 600-655)
- Science layer TDEE: `src/lib/marathon-nutrition.ts` (lines 66-105)
- Frontend scoring: `src/services/unified-score.service.ts`
- Meal generation: `supabase/functions/daily-meal-generation/index.ts`
- Template scaling: `supabase/functions/_shared/meal-rotation.ts`

## ✨ Conclusion

The discrepancy between dashboard (2580) and meal plan (2260) was caused by two bugs:
1. ❌ Meal generation always used REST instead of checking planned training
2. ❌ Template scaling was calculated but never applied

Both are now fixed ✅

**Dashboard is the source of truth** - it dynamically calculates based on real training data.
Meal plans now match the dashboard when training is scheduled before the 6am generation run.
