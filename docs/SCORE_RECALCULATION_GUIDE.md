# Score Recalculation Guide

## Overview

This guide explains how to recalculate daily and weekly scores based on food logs and activity data.

## 🎯 What Gets Recalculated

### Daily Scores (0-100)
Calculated from:
- **Food intake** vs meal plan targets (calories, protein, carbs, fat)
- **Training activity** from `training_activities` table
- **Google Fit data** (steps, active minutes, heart rate)
- **Meal structure** (breakfast, lunch, dinner, snacks)
- **Training load** (rest, easy, moderate, long, quality)

Formula:
```
Daily Score = (Nutrition × Load Weight) + (Training × Load Weight) + Bonuses - Penalties
```

Load weights:
- **Rest day**: 100% nutrition, 0% training
- **Easy run**: 70% nutrition, 30% training
- **Moderate**: 60% nutrition, 40% training
- **Long run**: 55% nutrition, 45% training
- **Quality workout**: 60% nutrition, 40% training

### Weekly Scores (0-100)
Calculated as:
```
Weekly Score = Average of all daily scores in the week (Sunday-Saturday)
```

**Not** summed (0-700) like the old system!

---

## 🚀 Quick Start

### Recalculate Last 7 Days (Default)
```bash
cd /Users/habiebraharjo/fuel-score-friends
node scripts/recalculate-all-scores.js
```

### Recalculate Last 30 Days
```bash
node scripts/recalculate-all-scores.js 30
```

### Recalculate Last 90 Days
```bash
node scripts/recalculate-all-scores.js 90
```

---

## 📊 Expected Output

```
🚀 Starting comprehensive score recalculation...

Configuration:
  - Days to recalculate: 7
  - Supabase URL: https://xxxxx.supabase.co

📋 Found 5 users to process

[1/5]
👤 Processing user: user-abc-123
   Days to recalculate: 7
   📊 Recalculating daily scores...
      ✓ 2025-10-05: 85 (easy)
      ✓ 2025-10-06: 92 (rest)
      ✓ 2025-10-07: 78 (quality)
      ✓ 2025-10-08: 88 (rest)
      ✓ 2025-10-09: 91 (easy)
      ✓ 2025-10-10: 76 (long)
      ✓ 2025-10-11: 89 (rest)
   📅 Recalculating weekly scores...
      ✓ Week 2025-10-06: 85 (7 days)

============================================================
✅ RECALCULATION COMPLETE
============================================================

Users processed: 5
  ✓ Success: 5
  ✗ Failed: 0

Scores recalculated:
  📊 Daily scores: 35
  📅 Weekly scores: 5

👋 Exiting...
```

---

## 🔍 How Training Load is Determined

The script uses this logic to classify workouts:

```javascript
// From training_activities table
const distance_km = activity.distance_km
const duration_minutes = activity.duration_minutes
const intensity = activity.intensity  // 'low', 'moderate', 'high'

// Classification:
if (duration >= 90 OR distance >= 15)     → 'long'
if (intensity === 'high')                  → 'quality'
if (30 <= duration < 90 OR 5 <= distance < 15) → 'easy'
if (duration >= 20 OR distance >= 3)       → 'moderate'
else                                       → 'rest'
```

---

## 📋 Data Sources

### Nutrition Data
- **Targets**: `daily_meal_plans` table
  - `recommended_calories`
  - `recommended_protein_grams`
  - `recommended_carbs_grams`
  - `recommended_fat_grams`

- **Actuals**: `food_logs` table
  - `calories`
  - `protein_grams`
  - `carbs_grams`
  - `fat_grams`
  - `meal_type` (breakfast, lunch, dinner, snack)

### Training Data
- **Planned**: `training_activities` table
  - `activity_type` (e.g., "5km run", "Long run")
  - `duration_minutes`
  - `distance_km`
  - `intensity` (low, moderate, high)

- **Actual**: `google_fit_data` table
  - `active_minutes`
  - `heart_rate_avg`
  - `steps`
  - `distance_meters`

### Score Storage
- **Output**: `nutrition_scores` table
  - `daily_score` (0-100)
  - `calories_consumed`
  - `protein_grams`
  - `carbs_grams`
  - `fat_grams`
  - `meals_logged`
  - `planned_calories`
  - `planned_protein_grams`
  - `planned_carbs_grams`
  - `planned_fat_grams`

---

## 🧮 Scoring Breakdown

### 1. Macro Scoring (Piecewise)
```
±5%  = 100 points
±10% = 60 points
±20% = 20 points
>20% = 0 points
```

Example: If target is 2,500 kcal
- 2,375 - 2,625 kcal (±5%) = 100 pts
- 2,250 - 2,750 kcal (±10%) = 60 pts
- 2,000 - 3,000 kcal (±20%) = 20 pts
- < 2,000 or > 3,000 kcal = 0 pts

### 2. Nutrition Components
```
Nutrition Score = 
  (Macros × 50%) + 
  (Timing × 35%) + 
  (Structure × 15%)
```

Where:
- **Macros**: Weighted average of calorie/protein/carbs/fat scores
- **Timing**: Pre/post-workout fueling windows
- **Structure**: Meal distribution (breakfast, lunch, dinner, snacks)

### 3. Training Components
```
Training Score = 
  (Completion × 60%) + 
  (Type Match × 25%) + 
  (Intensity × 15%)
```

### 4. Final Score
```
Final Score = 
  (Nutrition × Load Weight) + 
  (Training × Load Weight) + 
  Bonuses - 
  Penalties
```

Bonuses:
- All fueling windows met: +5
- Streak days: +1 to +5
- Hydration OK: +2
- Max bonus: +10

Penalties:
- Hard workout + carb underfuel: -5
- Big calorie deficit on long run: -10
- Missed post-workout window: -3
- Max penalty: -15

---

## 🛠️ Troubleshooting

### "Missing Supabase configuration"
**Solution**: Set environment variables
```bash
export VITE_SUPABASE_URL="https://xxxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### Scores seem incorrect
**Check**:
1. Are meal plans created? (`daily_meal_plans` table)
2. Are food logs present? (`food_logs` table)
3. Are training activities logged? (`training_activities` table)

### No weekly scores calculated
**Reason**: Weekly scores need at least 1 daily score in the week
**Solution**: Ensure daily scores are calculated first

### Some days show 0 score
**Possible reasons**:
- No food logged
- No meal plan targets
- All macros >20% off target
- Check the `nutrition_scores` table for that date

---

## 🔄 When to Recalculate

Run this script when:

1. ✅ After fixing scoring logic bugs
2. ✅ After adding historical food logs
3. ✅ After importing Google Fit data
4. ✅ After updating training plans
5. ✅ When scores seem incorrect
6. ✅ After database migrations

---

## 📝 Technical Details

### Script Location
```
/Users/habiebraharjo/fuel-score-friends/scripts/recalculate-all-scores.js
```

### Dependencies
- `@supabase/supabase-js`
- Node.js 16+

### Processing Order
1. Get all users from `profiles` table
2. For each user:
   - For each day in range:
     - Get meal plan targets
     - Get food logs
     - Get training activity
     - Get Google Fit data
     - Calculate training load
     - Calculate unified score
     - Save to `nutrition_scores`
   - For each week in range:
     - Get all daily scores
     - Average them
     - Return weekly score

### Performance
- Processes ~1-2 days per second per user
- 7 days × 100 users ≈ 5-10 minutes
- 30 days × 100 users ≈ 20-30 minutes

---

## 💡 Tips

1. **Start small**: Test with 7 days before running 90 days
2. **Check one user**: Verify scores look correct before processing all users
3. **Backup first**: Consider backing up `nutrition_scores` table
4. **Monitor logs**: Watch for errors during recalculation
5. **Compare**: Check a few scores manually vs the script output

---

## 🔗 Related Files

- **Scoring logic**: `src/lib/unified-scoring.ts`
- **Score service**: `src/services/unified-score.service.ts`
- **Edge function**: `supabase/functions/recalculate-scores/index.ts`
- **Database schema**: `supabase/migrations/*`
- **Tests**: `tests/calorie-training-adjustment.test.ts`

---

## 📞 Support

If scores still seem incorrect after recalculation:

1. Check the console output for errors
2. Verify data exists in source tables
3. Review the scoring breakdown in the app
4. Compare with manual calculation
5. Check for recent changes to scoring formulas
