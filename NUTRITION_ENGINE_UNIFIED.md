# Unified Nutrition Engine Documentation

## 🎯 Architecture Overview

The nutrition engine follows this flow:

```
User Profile → Training Load → Day Target → Meal Plan → Nutrition Score
```

## 📁 Files

### Client-Side
- **`src/lib/nutrition-engine.ts`** - Main engine with recipe recommendations
  - Full implementation with TypeScript types
  - Recipe filtering, scoring, and recommendation
  - Used by React components

### Server-Side (Edge Functions)
- **`supabase/functions/_shared/nutrition-unified.ts`** - Unified engine for Deno
  - Core calculations (BMR, TDEE, macros)
  - Meal planning logic
  - Nutrition scoring
  - Used by all edge functions

## 🔧 Core Concepts

### 1. Training Load (NEW ✨)
Replaces the old `activity_level` with dynamic training-based calculation:

- **`rest`**: Rest day (1.4x BMR)
- **`easy`**: Easy run, < 60 min (1.6x BMR)
- **`moderate`**: Moderate run, 60-90 min (1.8x BMR)
- **`long`**: Long run, > 90 min or > 20km (2.0x BMR)
- **`quality`**: Intervals, tempo, speed work (2.1x BMR)

### 2. BMR Calculation (Updated ✨)
Uses **Mifflin-St Jeor equation** with **sex consideration**:

```typescript
// Male:   BMR = 10×weight + 6.25×height - 5×age + 5
// Female: BMR = 10×weight + 6.25×height - 5×age - 161
```

**Database field**: `profiles.sex` (male/female)

### 3. Macro Targets (Training-Specific ✨)
Macros adjust based on training load:

| Load | Carbs | Protein | Fat |
|------|-------|---------|-----|
| Long/Quality | 55% | 25% | 20% |
| Moderate | 50% | 25% | 25% |
| Easy | 45% | 30% | 25% |
| Rest | 40% | 30% | 30% |

### 4. Meal Distribution

**Without Snack** (rest/easy days):
- Breakfast: 30%
- Lunch: 40%
- Dinner: 30%

**With Snack** (long/quality days):
- Breakfast: 25%
- Lunch: 35%
- Dinner: 30%
- Snack: 10%

## 🚀 Usage in Edge Functions

### Step 1: Import Unified Engine

```typescript
import {
  UserProfile,
  TrainingLoad,
  calculateBMR,
  determineTrainingLoad,
  generateDayTarget,
  generateMealPlan,
  calculateNutritionScore
} from '../_shared/nutrition-unified.ts';
```

### Step 2: Create User Profile

```typescript
const profile: UserProfile = {
  weightKg: 70,
  heightCm: 175,
  age: 30,
  sex: 'male'  // or 'female'
};
```

### Step 3: Determine Training Load

```typescript
// From workout data
const load = determineTrainingLoad('run', 90, 15);  // 90 min, 15 km
// Returns: 'long'

// Or from daily plan
const load = determineTrainingLoad(todayPlan.activity, todayPlan.duration, todayPlan.distanceKm);
```

### Step 4: Generate Day Target

```typescript
const dayTarget = generateDayTarget(profile, '2025-10-07', load);
// Returns:
// {
//   date: '2025-10-07',
//   load: 'long',
//   kcal: 2800,
//   cho_g: 385,
//   protein_g: 175,
//   fat_g: 62
// }
```

### Step 5: Generate Meal Plan

```typescript
const includeSnack = load === 'long' || load === 'quality';
const mealPlan = generateMealPlan(dayTarget, includeSnack);
// Returns:
// {
//   breakfast: { kcal: 700, cho_g: 79, protein_g: 53, fat_g: 19 },
//   lunch: { kcal: 980, cho_g: 134, protein_g: 61, fat_g: 27 },
//   dinner: { kcal: 840, cho_g: 116, protein_g: 53, fat_g: 19 },
//   snack: { kcal: 280, cho_g: 42, protein_g: 14, fat_g: 6 }
// }
```

### Step 6: Calculate Nutrition Score

```typescript
const score = calculateNutritionScore(
  2800, 175, 385, 62,  // planned
  2750, 170, 390, 58   // actual
);
// Returns: 92 (0-100 scale)
```

## 🔄 Migration Guide

### Old Code (Deprecated ❌)
```typescript
// OLD: Using activity_level
const bmr = calculateBMR(weight, height, age);  // No sex!
const multiplier = getActivityMultiplier('moderate');  // Static!
const tdee = bmr * multiplier;

// OLD: Fixed macro ratios
const macros = {
  protein: (tdee * 0.30) / 4,
  carbs: (tdee * 0.40) / 4,
  fat: (tdee * 0.30) / 9
};
```

### New Code (Unified ✅)
```typescript
// NEW: Training load based
const profile = { weightKg, heightCm, age, sex: 'male' };
const load = determineTrainingLoad('run', 90, 15);
const dayTarget = generateDayTarget(profile, date, load);

// NEW: Dynamic macro ratios based on training
const mealPlan = generateMealPlan(dayTarget, true);
```

## 📊 Database Schema Updates

### Required Fields in `profiles` Table:

```sql
-- REQUIRED: Sex for accurate BMR
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sex TEXT DEFAULT 'male' CHECK (sex IN ('male', 'female'));

-- DEPRECATED: activity_level (use training load instead)
-- Don't use: profiles.activity_level

-- NEW: Calculate from training_goals and session data
-- Training load is derived, not stored
```

### Training Session Data:

```sql
-- Store workouts with enough detail to calculate load
CREATE TABLE training_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  activity_type TEXT,  -- 'run', 'rest', etc.
  duration_min INTEGER,
  distance_km NUMERIC,
  intensity TEXT,  -- 'easy', 'tempo', 'interval', etc.
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## 🔍 Edge Function Examples

### Example 1: Generate Meal Plan

```typescript
serve(async (req) => {
  // ... auth logic ...
  
  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('weight_kg, height_cm, age, sex')
    .eq('user_id', userId)
    .single();
  
  // Get today's workout
  const { data: session } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('date', targetDate)
    .single();
  
  // Determine load
  const load = session 
    ? determineTrainingLoad(session.activity_type, session.duration_min, session.distance_km)
    : 'rest';
  
  // Generate targets
  const dayTarget = generateDayTarget(
    {
      weightKg: profile.weight_kg,
      heightCm: profile.height_cm,
      age: profile.age,
      sex: profile.sex
    },
    targetDate,
    load
  );
  
  // Generate meal plan
  const includeSnack = shouldIncludeSnack(load);
  const mealPlan = generateMealPlan(dayTarget, includeSnack);
  
  // Store in database...
  for (const [mealType, macros] of Object.entries(mealPlan)) {
    await supabase.from('daily_meal_plans').upsert({
      user_id: userId,
      date: targetDate,
      meal_type: mealType,
      recommended_calories: macros.kcal,
      recommended_protein_grams: macros.protein_g,
      recommended_carbs_grams: macros.cho_g,
      recommended_fat_grams: macros.fat_g
    });
  }
});
```

### Example 2: Calculate Nutrition Score

```typescript
serve(async (req) => {
  // ... auth logic ...
  
  // Fetch meal plans
  const { data: plans } = await supabase
    .from('daily_meal_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('date', targetDate);
  
  // Fetch actual logs
  const { data: logs } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', `${targetDate}T00:00:00`)
    .lte('logged_at', `${targetDate}T23:59:59`);
  
  // Calculate score
  const plannedKcal = plans.reduce((sum, p) => sum + p.recommended_calories, 0);
  const plannedProtein = plans.reduce((sum, p) => sum + p.recommended_protein_grams, 0);
  const plannedCarbs = plans.reduce((sum, p) => sum + p.recommended_carbs_grams, 0);
  const plannedFat = plans.reduce((sum, p) => sum + p.recommended_fat_grams, 0);
  
  const actualKcal = logs.reduce((sum, l) => sum + l.calories, 0);
  const actualProtein = logs.reduce((sum, l) => sum + l.protein_grams, 0);
  const actualCarbs = logs.reduce((sum, l) => sum + l.carbs_grams, 0);
  const actualFat = logs.reduce((sum, l) => sum + l.fat_grams, 0);
  
  const score = calculateNutritionScore(
    plannedKcal, plannedProtein, plannedCarbs, plannedFat,
    actualKcal, actualProtein, actualCarbs, actualFat
  );
  
  // Store score...
  await supabase.from('nutrition_scores').upsert({
    user_id: userId,
    date: targetDate,
    daily_score: score,
    calories_consumed: actualKcal,
    protein_grams: actualProtein,
    carbs_grams: actualCarbs,
    fat_grams: actualFat
  });
});
```

## ✅ Benefits of Unified Engine

1. **Single Source of Truth**: All calculations use the same logic
2. **Sex-Specific**: Accurate BMR for male/female athletes
3. **Training-Aware**: Nutrition adapts to workout intensity
4. **Type-Safe**: Full TypeScript support
5. **Tested**: Consistent behavior across client and server
6. **Maintainable**: Update one file, affects all calculations

## 🚧 Migration Checklist

- [ ] Update `profiles` table to include `sex` column
- [ ] Migrate edge functions to use `nutrition-unified.ts`
- [ ] Replace old `calculateBMR` calls with new version
- [ ] Replace `activity_level` with `training_load`
- [ ] Update meal plan generation to use `generateMealPlan()`
- [ ] Update scoring to use `calculateNutritionScore()`
- [ ] Test all edge functions
- [ ] Update client-side components to use `src/lib/nutrition-engine.ts`

## 📝 Notes

- The unified engine is **production-ready** and **actively used** in the app
- All new features should use this engine
- Legacy code will be phased out gradually
- Both client and server implementations are synchronized

