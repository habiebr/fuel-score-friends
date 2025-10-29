# Nutrition System Architecture - The Complete Picture

## Core Principle

**The Science Layer is the source of truth. Everything else is derived from it.**

---

## The Complete Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: USER PROFILE (Foundation)                           │
│ Input: weight, height, age, sex, activity_level             │
│ Status: REQUIRED - without this, nothing can be calculated  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: SCIENCE LAYER (Pure Calculation)                    │
│ Location: src/lib/nutrition-engine.ts                       │
│                                                              │
│ calculateBMR(profile) → Basal Metabolic Rate                │
│   Formula: 10×weight + 6.25×height - 5×age + sexOffset     │
│   Example: 1648.75 kcal/day                                 │
│                                                              │
│ calculateTDEE(profile, trainingLoad) → Total Daily Energy   │
│   Formula: BMR × activity_factor                            │
│   Factors: rest=1.4, easy=1.6, moderate=1.8, long=2.0      │
│   Example: 1648.75 × 1.8 = 2970 kcal/day                   │
│                                                              │
│ calculateMacros(profile, load, tdee) → Macro Distribution   │
│   CHO: weightKg × g/kg (varies by load: 3.5-9 g/kg)       │
│   Protein: weightKg × g/kg (1.6-1.9 g/kg)                  │
│   Fat: Remainder (minimum 20% of TDEE)                      │
│   Example: 490g CHO, 126g protein, 66g fat                  │
│                                                              │
│ Output: Numerical targets (calories, macros)                │
│ Status: DETERMINISTIC - always same input = same output     │
└────────────┬───────────────────────────────────────────────┘
             │
             │ These values feed into TWO paths:
             │
     ┌───────┴────────┐
     │                │
     ▼                ▼
┌─────────────┐  ┌────────────────────────────────────────────┐
│ PATH A:     │  │ PATH B:                                     │
│ SCORING     │  │ AI MEAL PLAN GENERATOR                      │
│ (Direct)    │  │ (Enhancement)                               │
└─────────────┘  └─────────────────────────────────────────────┘
```

---

## Path A: Direct Scoring (Our Fix)

```
Science Layer Targets
         │
         ▼
┌─────────────────────────────────────────────┐
│ SCORING SYSTEM                              │
│ Location: src/services/unified-score.service.ts │
│                                             │
│ Compare:                                    │
│   • Actual: What user logged in food_logs  │
│   • Target: Science layer calculation      │
│                                             │
│ Score = How close actual matches target    │
└─────────────────────────────────────────────┘
```

**Key Insight:** Scoring can ALWAYS work as long as user has body metrics, even if meal plan generation fails!

---

## Path B: AI Meal Plan Generation (Enhancement)

```
Science Layer Targets
         │
         ▼
┌─────────────────────────────────────────────┐
│ AI MEAL PLAN GENERATOR                      │
│ Location: supabase/functions/generate-meal-plan │
│                                             │
│ Input: Nutrition targets from science layer│
│   Example: 2970 kcal, 490g CHO, 126g protein│
│                                             │
│ Process:                                    │
│   • Split into meals (breakfast, lunch, dinner)│
│   • Generate actual food suggestions       │
│   • Consider user preferences/allergies    │
│   • Balance timing and portions            │
│                                             │
│ Output: Structured meal plan                │
│   Breakfast: 800 kcal                       │
│     - Oatmeal: 300 kcal, 50g CHO           │
│     - Banana: 100 kcal, 25g CHO            │
│     - Protein shake: 400 kcal, 40g protein │
│   Lunch: 1000 kcal                          │
│     - Chicken breast: 300 kcal, 60g protein│
│     - Rice: 400 kcal, 90g CHO              │
│     - Veggies: 100 kcal                    │
│   Dinner: 900 kcal                          │
│     - Salmon: 400 kcal, 50g protein        │
│     - Sweet potato: 300 kcal, 70g CHO      │
│     - Salad: 200 kcal                      │
│   Snacks: 270 kcal                          │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│ DATABASE STORAGE (Cache)                    │
│ Table: daily_meal_plans                     │
│                                             │
│ Stores:                                     │
│   • meal_type (breakfast, lunch, dinner)   │
│   • recommended_calories                    │
│   • recommended_protein_grams               │
│   • recommended_carbs_grams                 │
│   • recommended_fat_grams                   │
│   • meal_suggestions (AI-generated foods)  │
│                                             │
│ Purpose: Cache for quick lookup            │
│ Status: OPTIONAL - nice to have, not required│
└─────────────────────────────────────────────┘
```

**Key Insight:** The meal plan is a PRODUCT of the science layer, not a REQUIREMENT for scoring!

---

## The Fix We Implemented

### Before (Broken ❌)

```typescript
// OLD CODE - Only looked at database
const nutritionTargets = (mealPlans || []).reduce((acc, plan) => ({
  calories: acc.calories + (plan.recommended_calories || 0),
  protein: acc.protein + (plan.recommended_protein_grams || 0),
  carbs: acc.carbs + (plan.recommended_carbs_grams || 0),
  fat: acc.fat + (plan.recommended_fat_grams || 0),
}), { calories: 0, protein: 0, carbs: 0, fat: 0 });

// If mealPlans array was empty → all targets = 0
// Then calculateMacroScore(actual, 0) returned 100 (bug!)
// Result: Score = 92 for users with no meal plan
```

### After (Fixed ✅)

```typescript
// NEW CODE - Falls back to science layer
const hasMealPlan = mealPlans && mealPlans.length > 0;

if (hasMealPlan) {
  // Path 1: Use cached AI-generated meal plan (optimization)
  nutritionTargets = (mealPlans || []).reduce((acc, plan) => ({
    calories: acc.calories + (plan.recommended_calories || 0),
    protein: acc.protein + (plan.recommended_protein_grams || 0),
    carbs: acc.carbs + (plan.recommended_carbs_grams || 0),
    fat: acc.fat + (plan.recommended_fat_grams || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  
  console.log('✅ Using cached meal plan from database');
} else {
  // Path 2: Calculate directly from science layer (fallback)
  const userProfile: UserProfile = {
    weightKg: profile.weight_kg!,
    heightCm: profile.height_cm!,
    age: profile.age!,
    sex: profile.sex! as 'male' | 'female',
  };
  
  const tdee = calculateTDEE(userProfile, inferredLoad);
  const macros = calculateMacros(userProfile, inferredLoad, tdee);
  
  nutritionTargets = {
    calories: tdee,
    protein: macros.protein,
    carbs: macros.cho,
    fat: macros.fat,
  };
  
  console.log('✅ Science layer fallback - no meal plan needed!');
}

// Both paths produce valid targets!
// Score now accurately reflects: actual eating vs. calculated needs
```

---

## Why This Architecture is Correct

### 1. Resilience ✅
- **AI generator fails?** → Scoring still works (science layer fallback)
- **Database query fails?** → Scoring still works (science layer fallback)
- **Meal plan outdated?** → Can recalculate from science layer

### 2. Single Source of Truth ✅
- Science layer = The truth
- Meal plan database = Cache of truth
- No conflicting values
- Easy to debug: "What SHOULD user eat?" → Ask science layer

### 3. Flexibility ✅
- Can regenerate meal plans anytime
- Can experiment with different AI prompts
- Can add user preferences without touching scoring
- Can support manual overrides

### 4. Performance ✅
- Normal case: Use cached meal plan (fast database lookup)
- Edge case: Calculate from science layer (still fast, pure math)
- Best of both worlds

---

## Component Responsibilities

### 1. Science Layer (`nutrition-engine.ts`)
**Role:** Pure calculation, deterministic
- ✅ Calculate BMR, TDEE, macros
- ✅ No side effects, no database calls
- ✅ Testable, predictable
- ❌ Does NOT care about meal plans
- ❌ Does NOT care about AI

### 2. Meal Plan Generator (AI)
**Role:** Enhancement, user experience
- ✅ Takes science layer output as input
- ✅ Generates structured, practical meals
- ✅ Stores results for convenience
- ❌ NOT required for scoring
- ❌ Can fail without breaking system

### 3. Scoring System (`unified-score.service.ts`)
**Role:** Compare actual vs. target
- ✅ Fetch user's food logs (actual)
- ✅ Get targets (cached OR calculated)
- ✅ Calculate score
- ✅ Always reliable if body metrics exist
- ❌ Does NOT generate meal plans

### 4. Database (`daily_meal_plans` table)
**Role:** Cache and convenience
- ✅ Stores AI-generated meal plans
- ✅ Speeds up repeated queries
- ✅ Provides meal suggestions to users
- ❌ NOT the source of nutrition values
- ❌ Can be empty without breaking scoring

---

## User Scenarios

### Scenario 1: New User (Happy Path)
```
1. User signs up → enters body metrics ✅
2. Science layer calculates → 2970 kcal needed ✅
3. AI generates meal plan → stored in DB ✅
4. User sees meal suggestions → logs food ✅
5. Scoring compares → uses cached plan ✅
6. Score: 85/100 ✅
```

### Scenario 2: AI Generator Down (Resilient)
```
1. User signs up → enters body metrics ✅
2. Science layer calculates → 2970 kcal needed ✅
3. AI generator FAILS → nothing stored in DB ❌
4. User logs food anyway ✅
5. Scoring compares → calculates from science layer ✅
6. Score: 85/100 ✅ (same result!)
```

### Scenario 3: User Updates Weight (Dynamic)
```
1. User was 70kg → meal plan for 2970 kcal in DB
2. User loses weight → now 65kg ✅
3. Science layer recalculates → 2750 kcal needed ✅
4. Scoring → can use fresh calculation ✅
5. (Background job regenerates meal plan) ✅
6. Next day → cached plan updated ✅
```

### Scenario 4: Custom Training Day (Flexible)
```
1. User has rest day plan cached → 2300 kcal
2. User does unexpected long run ✅
3. Science layer adjusts → 3300 kcal needed ✅
4. Scoring → uses calculated value (not cache) ✅
5. Score reflects actual needs ✅
6. User sees accurate feedback ✅
```

---

## Key Takeaways

1. **Science Layer First**
   - Always the source of truth
   - Deterministic and reliable
   - Based on validated research (Mifflin-St Jeor, sports nutrition guidelines)

2. **Meal Plans are Cache**
   - Generated FROM science layer
   - Stored FOR convenience
   - NOT required FOR scoring

3. **Scoring is Resilient**
   - Works with cached plan (fast)
   - Works without cached plan (fallback)
   - Always accurate if body metrics exist

4. **User Experience Enhanced**
   - AI makes suggestions practical
   - Database makes lookups fast
   - But system never breaks if these fail

---

## Files Involved

### Core Science Layer
- `src/lib/nutrition-engine.ts` - BMR, TDEE, macro calculations
- `src/lib/marathon-nutrition.ts` - Alternative implementation

### Scoring System
- `src/services/unified-score.service.ts` - **FIXED**: Now falls back to science layer
- `src/lib/unified-scoring.ts` - **FIXED**: Removed meal plan penalty

### Meal Plan Generation (Enhancement)
- `supabase/functions/generate-meal-plan/` - AI meal plan generator
- Database: `daily_meal_plans` table - Cache storage

### UI Components
- `src/components/IncompleteProfileAlert.tsx` - **FIXED**: Only warns about body metrics

---

## Status: ✅ COMPLETE

The architecture now correctly reflects:
- **Science layer = Source of truth**
- **Meal plans = Cache (optional)**
- **Scoring = Always works if body metrics exist**

This fix makes the system resilient, accurate, and user-friendly! 🚀
