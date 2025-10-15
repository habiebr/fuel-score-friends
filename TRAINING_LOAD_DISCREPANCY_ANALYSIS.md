# Training Load & Calorie Target Discrepancy Analysis
**Date:** October 13, 2025  
**User:** Muhammad Habieb

## 🔍 Issue
Dashboard shows **2580 kcal** target, but meal plan shows **2260 kcal** - a difference of **320 kcal**.

## ✅ Root Cause Found

### Training Load Determination

**Dashboard Logic (from Dashboard.tsx):**
1. **FIRST**: Check `training_activities` table for PLANNED training
2. **FALLBACK**: If no planned training, infer from Google Fit actual activity

**Today's Data (Oct 13, 2025):**
- ✅ **Planned Training Found**: 40min run, 5km, moderate intensity
- ❌ **Google Fit Data**: 0 active minutes (hasn't run yet)

**Training Load Classification Rules:**
```
Planned Training (40min, 5km, moderate):
- Total duration: 40 min (< 45 min)
- Total distance: 5 km (< 8 km)
- Not rest, not long (< 15km), not quality (< 60min & 10km)
→ Classification: EASY
```

### TDEE Calculations (Science Layer)

**BMR (Mifflin-St Jeor):** 1,613 kcal
- Male, 72kg, 166cm, 30yo

**Activity Multipliers (from marathon-nutrition.ts):**
```typescript
const factors: Record<TrainingLoad, number> = {
  rest: 1.4,      // 1613 × 1.4 = 2258 → 2260 kcal (rounded)
  easy: 1.6,      // 1613 × 1.6 = 2581 → 2580 kcal (rounded) ✅
  moderate: 1.8,  // 1613 × 1.8 = 2903 → 2900 kcal (rounded)
  long: 2.0,      // 1613 × 2.0 = 3226 → 3230 kcal (rounded)
  quality: 2.1,   // 1613 × 2.1 = 3387 → 3390 kcal (rounded)
};
```

### Why the Discrepancy?

| Component | Training Load | Calculation | Result |
|-----------|--------------|-------------|---------|
| **Dashboard** | EASY (from planned training) | 1613 × 1.6 = 2581 → **2580 kcal** | ✅ |
| **Meal Plan** | REST (default at generation) | 1613 × 1.4 = 2258 → **2260 kcal** | ⚠️ |

## 📊 Analysis

### Dashboard (CORRECT ✅)
1. Checks `training_activities` table
2. Finds planned 40min/5km run → Classifies as **EASY**
3. Calculates: 1613 × 1.6 = **2580 kcal**
4. Displays 2580 kcal target

### Meal Plan Generation (OUTDATED ⚠️)
1. Runs daily at 6am (before user logs planned training)
2. No training data available at generation time
3. Defaults to **REST** day
4. Calculates: 1613 × 1.4 = **2260 kcal**
5. Saves 2260 kcal meal plan

## 🎯 Which is Correct?

**The Dashboard (2580 kcal) is CORRECT** ✅

### Why?
1. **Planned training exists**: 40min run, 5km, moderate intensity
2. **Classification**: EASY load (per science layer rules)
3. **TDEE calculation**: BMR × 1.6 = 2580 kcal
4. **User should eat**: 2580 kcal to fuel the planned run

The meal plan (2260 kcal) is **outdated** because:
- It was generated at 6am when no training was scheduled
- User added/updated training plan AFTER meal generation
- Meal plan defaults to REST day (1.4 multiplier)

## 🔧 The Real Issue

**Meal plan generation doesn't account for planned training!**

The `daily-meal-generation` edge function should:
1. Check `training_activities` table for planned training
2. Determine correct training load
3. Calculate TDEE with appropriate multiplier
4. Generate meal plan with correct calorie target

Currently it just uses **REST** as default, which is why meal plans are always lower than dashboard targets when training is planned.

## 💡 Solution Options

### Option 1: Fix Meal Plan Generation (Recommended)
Update `daily-meal-generation/index.ts` to:
- Query `training_activities` table for each user
- Determine training load from planned activities
- Pass correct `trainingLoad` to meal plan generator
- This ensures meal plan matches dashboard from the start

### Option 2: Regenerate After Training Update
- Add a trigger/webhook when user updates training
- Regenerate meal plan with new training load
- More complex, requires real-time updates

### Option 3: Show Warning in UI
- Display notice when meal plan doesn't match training
- Suggest manual regeneration
- User-initiated fix via "🤖 AI Menu" button

## 📋 Summary

**Question:** Why does dashboard show 2580 but meal plan shows 2260?

**Answer:** 
- Dashboard uses **EASY** training load (planned 40min/5km run) → 2580 kcal ✅
- Meal plan uses **REST** (no training at generation time) → 2260 kcal ⚠️
- **Dashboard is correct** - user should eat 2580 kcal today
- **Meal plan is outdated** - generated before training was added

**Fix:** Update meal plan generation to check planned training and use correct training load multiplier.
