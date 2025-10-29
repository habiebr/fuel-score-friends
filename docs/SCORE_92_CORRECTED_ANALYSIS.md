# Score 92 Issue - Corrected Root Cause Analysis

## 🎯 User's Correct Insight

**The foundational data is body metrics (weight, height, age, sex)**, NOT meal plans!

### The Proper Data Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│  LEVEL 1: Body Metrics (FOUNDATIONAL)                   │
│  ├── weight_kg                                          │
│  ├── height_cm                                          │
│  ├── age                                                │
│  └── sex                                                │
│                                                         │
│  → Used to calculate BMR/TDEE                          │
│  → Used to generate meal plans automatically           │
└─────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  LEVEL 2: Meal Plans (DERIVED from body metrics)       │
│  ├── Auto-generated daily at midnight                  │
│  ├── Based on BMR/TDEE calculation                     │
│  └── Should ALWAYS exist if body metrics exist         │
└─────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  LEVEL 3: Food Logs (USER INPUT)                       │
│  ├── User manually logs meals                          │
│  ├── Compared against meal plan targets                │
│  └── Determines the actual score                       │
└─────────────────────────────────────────────────────────┘
```

## ✅ What SHOULD Happen

### Scenario 1: User with Body Metrics, No Food Logs
```
User Profile:
- Weight: 70kg
- Height: 170cm
- Age: 30
- Sex: male

Expected Flow:
1. BMR calculated: ~1,650 kcal
2. TDEE calculated: ~2,300 kcal (with moderate activity)
3. Meal plan auto-generated:
   - Breakfast: 575 kcal, 35g protein, 72g carbs, 19g fat
   - Lunch: 690 kcal, 42g protein, 86g carbs, 23g fat
   - Dinner: 690 kcal, 42g protein, 86g carbs, 23g fat
   - Snack: 345 kcal, 21g protein, 43g carbs, 12g fat
   - TOTAL: 2,300 kcal, 140g protein, 287g carbs, 77g fat

4. User eats nothing (0 consumed)
5. Score calculation:
   - Calories: 0/2300 → error = 100% → score = 0
   - Protein: 0/140g → error = 100% → score = 0
   - Carbs: 0/287g → error = 100% → score = 0
   - Fat: 0/77g → error = 100% → score = 0
   
   Macros score = 0 ✅ CORRECT!
   Final score = ~15-20 (only timing/structure defaults)
```

### Scenario 2: User WITHOUT Body Metrics
```
User Profile:
- Weight: NULL ❌
- Height: NULL ❌
- Age: NULL ❌
- Sex: NULL ❌

Expected Flow:
1. BMR cannot be calculated → use defaults OR return null
2. Options:
   A) Use population defaults (70kg, 170cm, 30, male)
   B) Return null score with message
   C) Apply heavy penalty

RECOMMENDED: Option B (null score)
Return: {
  score: null,
  message: "Please complete your profile to get a score",
  missingData: ["weight", "height", "age", "sex"]
}
```

## ❌ What's CURRENTLY Happening (The Bug)

### Current Code Flow
```typescript
// src/services/unified-score.service.ts line 69-77
const nutritionTargets = (mealPlans || []).reduce((acc, plan) => ({
  calories: acc.calories + (plan.recommended_calories || 0),
  protein: acc.protein + (plan.recommended_protein_grams || 0),
  carbs: acc.carbs + (plan.recommended_carbs_grams || 0),
  fat: acc.fat + (plan.recommended_fat_grams || 0),
}), { calories: 0, protein: 0, carbs: 0, fat: 0 });
// ⚠️ If mealPlans is empty → all targets = 0
```

**The Problem:**
1. If meal plans don't exist (cron job failed, new user, etc.)
2. `nutritionTargets` becomes `{ calories: 0, protein: 0, carbs: 0, fat: 0 }`
3. Scoring function sees target = 0 → returns 100 (perfect!)
4. User gets 85-92 score with NO DATA

**But this SHOULDN'T happen if:**
- User has body metrics → automatic meal generation should create plans
- User has NO body metrics → we should detect this and return null/warning

## 🔍 The Real Root Cause

The scoring system has **TWO separate issues**:

### Issue 1: Missing Body Metrics Check ⚠️
```typescript
// Current code (src/services/unified-score.service.ts)
const { data: profile } = await supabase
  .from('profiles')
  .select('weight_kg, height_cm, age, sex')
  .eq('user_id', userId)
  .maybeSingle();

console.log('Profile data:', profile);

// ⚠️ NO CHECK if profile has required fields!
// Continues even if weight/height/age/sex are NULL
```

**Fix:**
```typescript
// Check if user has body metrics
if (!profile || !profile.weight_kg || !profile.height_cm || !profile.age) {
  return {
    score: null,
    breakdown: null,
    context: null,
    error: 'INCOMPLETE_PROFILE',
    message: 'Please complete your profile (weight, height, age) to get a daily score',
    missingFields: [
      !profile?.weight_kg && 'weight',
      !profile?.height_cm && 'height',
      !profile?.age && 'age'
    ].filter(Boolean)
  };
}
```

### Issue 2: Zero Target Handling ⚠️
```typescript
// Current code (src/lib/unified-scoring.ts line 168)
function calculateMacroScore(actual: number, target: number): number {
  if (target <= 0) return 100;  // ⚠️ WRONG!
  // ...
}
```

**Fix:**
```typescript
function calculateMacroScore(actual: number, target: number): number {
  // If target is 0, something is wrong - meal plan missing
  if (target <= 0) {
    // If both are 0, insufficient data
    if (actual === 0) return null;  // Cannot score
    // If target is 0 but actual > 0, use default
    return 0;  // Eating without a plan = poor score
  }
  
  const errorPercent = Math.abs(actual - target) / target;
  if (errorPercent <= 0.05) return 100;
  if (errorPercent <= 0.10) return 60;
  if (errorPercent <= 0.20) return 20;
  return 0;
}
```

## 📊 Correct Scoring Logic

### Decision Tree
```
User opens app
    │
    ├─> Has body metrics? ────────────────────────┐
    │   (weight, height, age)                     │
    │                                             NO
    ├─> YES                                        │
    │                                              ▼
    │                                    Return null score
    ▼                                    "Complete your profile"
Has meal plan for today?
    │
    ├─> NO ──────────────────────────────┐
    │   (cron failed or new user)        │
    │                                    │
    ├─> YES                              │
    │                                    ▼
    │                         Generate plan now from BMR/TDEE
    │                         (fallback generation)
    ▼
Has food logs?
    │
    ├─> NO ─────────────────────────────────┐
    │   (0 calories consumed)                │
    │                                        │
    ├─> YES                                  │
    │                                        ▼
    ▼                                 Score = LOW (0-20)
Calculate score                       Because 0/2300 cal = 100% error
(compare consumed vs target)
    │
    ▼
Return score (0-100)
```

## 🛠️ Required Fixes

### Fix 1: Add Body Metrics Validation
```typescript
// src/services/unified-score.service.ts
export async function getDailyUnifiedScore(
  userId: string,
  dateISO: string,
  strategy: ScoringStrategy = 'runner-focused'
): Promise<ScoreResult> {
  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('weight_kg, height_cm, age, sex')
    .eq('user_id', userId)
    .maybeSingle();

  // ✅ NEW: Validate body metrics exist
  const hasBodyMetrics = profile && 
                        profile.weight_kg > 0 && 
                        profile.height_cm > 0 && 
                        profile.age > 0;

  if (!hasBodyMetrics) {
    console.warn('User missing body metrics:', userId);
    return {
      score: null,
      breakdown: {
        total: null,
        nutrition: { total: null, macros: null, timing: null, structure: null },
        training: { total: null, completion: null, typeMatch: null, intensity: null },
        bonuses: 0,
        penalties: 0,
        weights: { nutrition: 1, training: 0 }
      },
      context: null,
      error: 'INCOMPLETE_PROFILE',
      message: 'Please complete your profile (weight, height, age) to calculate your daily score',
      missingFields: [
        (!profile?.weight_kg || profile.weight_kg <= 0) && 'weight',
        (!profile?.height_cm || profile.height_cm <= 0) && 'height',
        (!profile?.age || profile.age <= 0) && 'age'
      ].filter(Boolean)
    };
  }

  // Continue with normal flow...
}
```

### Fix 2: Fallback Meal Plan Generation
```typescript
// If meal plans don't exist but user HAS body metrics
let nutritionTargets = (mealPlans || []).reduce((acc, plan) => ({
  calories: acc.calories + (plan.recommended_calories || 0),
  protein: acc.protein + (plan.recommended_protein_grams || 0),
  carbs: acc.carbs + (plan.recommended_carbs_grams || 0),
  fat: acc.fat + (plan.recommended_fat_grams || 0),
}), { calories: 0, protein: 0, carbs: 0, fat: 0 });

// ✅ NEW: If no meal plans, calculate from BMR/TDEE
if (nutritionTargets.calories === 0) {
  console.warn('No meal plans found, calculating from BMR/TDEE');
  
  const bmr = calculateBMR({
    weightKg: profile.weight_kg,
    heightCm: profile.height_cm,
    age: profile.age,
    sex: profile.sex
  });
  
  const activityMultiplier = 1.55; // Moderate activity default
  const tdee = Math.round(bmr * activityMultiplier);
  
  nutritionTargets = {
    calories: tdee,
    protein: Math.round(tdee * 0.25 / 4),  // 25% from protein
    carbs: Math.round(tdee * 0.45 / 4),    // 45% from carbs
    fat: Math.round(tdee * 0.30 / 9),      // 30% from fat
  };
  
  console.log('Calculated targets from BMR/TDEE:', nutritionTargets);
}
```

### Fix 3: Update calculateMacroScore
```typescript
// src/lib/unified-scoring.ts
function calculateMacroScore(actual: number, target: number): number | null {
  // If no target, cannot calculate meaningful score
  if (target <= 0) {
    // Both zero = insufficient data
    if (actual <= 0) return null;
    // Target is 0 but user ate something = shouldn't happen, but score it low
    return 0;
  }
  
  // Normal scoring
  const errorPercent = Math.abs(actual - target) / target;
  if (errorPercent <= 0.05) return 100;
  if (errorPercent <= 0.10) return 60;
  if (errorPercent <= 0.20) return 20;
  return 0;
}
```

## 📈 Expected Outcomes After Fix

### Test Case 1: User with Body Metrics, No Food Logs
```javascript
Input:
- Profile: 70kg, 170cm, 30yo, male ✅
- Meal Plan: Auto-generated (2300 kcal) ✅
- Food Logs: None (0 consumed) ❌

Output:
- Score: 15-20 (very low)
- Macros: 0 (0/2300 = 100% error)
- Message: "You haven't logged any meals today"
```

### Test Case 2: User WITHOUT Body Metrics
```javascript
Input:
- Profile: weight=null, height=null, age=null ❌
- Meal Plan: Cannot generate (no BMR) ❌
- Food Logs: None ❌

Output:
- Score: null
- Error: "INCOMPLETE_PROFILE"
- Message: "Please complete your profile (weight, height, age)"
- UI shows: "--" with warning
```

### Test Case 3: User with Everything
```javascript
Input:
- Profile: 70kg, 170cm, 30yo, male ✅
- Meal Plan: 2300 kcal target ✅
- Food Logs: 2250 kcal consumed ✅

Output:
- Score: 95-100 (excellent)
- Macros: 100 (2250/2300 = 2% error)
- Message: "Great job!"
```

## 🎯 Summary: You Are Correct!

### The Proper Hierarchy:
1. **Body Metrics = Foundation** (weight, height, age, sex)
   - Without this → Cannot calculate BMR/TDEE
   - Cannot generate meal plans
   - **Should return NULL score**

2. **Meal Plans = Derived** (auto-generated from body metrics)
   - Generated daily at midnight via cron
   - Fallback: Calculate on-demand from BMR/TDEE
   - **Should ALWAYS exist if body metrics exist**

3. **Food Logs = User Input** (what they actually ate)
   - Compared against meal plan targets
   - **If missing → Score should be LOW (0-20), not high (92)**

### The Bug:
The system currently:
- ❌ Doesn't validate body metrics exist
- ❌ Doesn't handle missing meal plans gracefully
- ❌ Returns perfect scores (100) when target = 0
- ❌ Gives 85-92 to users with NO data

### The Fix:
1. ✅ Validate body metrics first
2. ✅ Return null if metrics missing
3. ✅ Fallback to BMR/TDEE if meal plans missing
4. ✅ Score 0 consumed vs targets = LOW score (0-20)

**You're absolutely right: Body metrics are the foundation. Without them, we should return null, not a high score!**
