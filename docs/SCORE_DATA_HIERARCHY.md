# Scoring System - Correct Data Hierarchy

## 🎯 The Foundation: Body Metrics

```
┌─────────────────────────────────────────────────────────────────┐
│                    LEVEL 1: BODY METRICS                        │
│                      (FOUNDATIONAL DATA)                        │
│                                                                 │
│  Required Fields:                                               │
│  ✅ weight_kg      (e.g., 70)                                   │
│  ✅ height_cm      (e.g., 170)                                  │
│  ✅ age            (e.g., 30)                                   │
│  ✅ sex            (male/female)                                │
│                                                                 │
│  Purpose: Calculate BMR (Basal Metabolic Rate)                  │
│  Formula: Mifflin-St Jeor                                       │
│    Male:   BMR = 10×weight + 6.25×height - 5×age + 5          │
│    Female: BMR = 10×weight + 6.25×height - 5×age - 161        │
│                                                                 │
│  Example: 70kg, 170cm, 30yo male                               │
│  BMR = 10×70 + 6.25×170 - 5×30 + 5 = 1,618 kcal               │
│  TDEE = BMR × 1.55 (moderate activity) = 2,508 kcal           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LEVEL 2: MEAL PLANS                            │
│                  (DERIVED FROM BMR/TDEE)                        │
│                                                                 │
│  Auto-Generated Daily at Midnight (via cron)                    │
│                                                                 │
│  Based on TDEE = 2,508 kcal:                                   │
│  ├─ Breakfast: 627 kcal (25%)                                  │
│  ├─ Lunch:     752 kcal (30%)                                  │
│  ├─ Dinner:    752 kcal (30%)                                  │
│  └─ Snack:     377 kcal (15%)                                  │
│     ────────────────────                                        │
│     TOTAL:   2,508 kcal                                        │
│                                                                 │
│  Macros Distribution:                                           │
│  ├─ Protein: 157g (25% × 2508 ÷ 4 = 25% calories)             │
│  ├─ Carbs:   282g (45% × 2508 ÷ 4 = 45% calories)             │
│  └─ Fat:      84g (30% × 2508 ÷ 9 = 30% calories)             │
│                                                                 │
│  Status: SHOULD ALWAYS EXIST if body metrics exist              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LEVEL 3: FOOD LOGS                             │
│                  (USER INPUT - ACTUAL CONSUMPTION)              │
│                                                                 │
│  User Logs:                                                     │
│  ├─ Breakfast: Oatmeal + banana (450 kcal)                     │
│  ├─ Lunch:     Chicken rice (680 kcal)                         │
│  ├─ Dinner:    Salmon + veggies (720 kcal)                     │
│  └─ Snack:     Protein bar (200 kcal)                          │
│     ──────────────────────────                                  │
│     TOTAL:   2,050 kcal consumed                               │
│                                                                 │
│  Comparison:                                                    │
│  Target:  2,508 kcal                                           │
│  Actual:  2,050 kcal                                           │
│  Error:   18% under target                                     │
│  Score:   20 (per piecewise function)                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FINAL DAILY SCORE                            │
│                                                                 │
│  Score calculated based on:                                     │
│  1. Macros (50%): Calories, protein, carbs, fat adherence      │
│  2. Timing (35%): Pre/during/post workout fueling              │
│  3. Structure (15%): Meal distribution throughout day          │
│                                                                 │
│  Result: 65/100 (needs improvement)                            │
└─────────────────────────────────────────────────────────────────┘
```

## 🚨 Problem Scenarios

### Scenario A: Missing Body Metrics (CURRENT BUG)
```
User State:
├─ Body Metrics: ❌ NULL (weight, height, age missing)
├─ Meal Plans:   ❌ Cannot generate (no BMR to calculate)
└─ Food Logs:    ❌ None

Current Behavior (WRONG):
├─ Meal plan targets = 0
├─ Food consumed = 0
├─ calculateMacroScore(0, 0) = 100 ⚠️
└─ Final score = 85-92 ⚠️ HIGH SCORE WITH NO DATA!

Expected Behavior (CORRECT):
├─ Check: Does user have body metrics? NO
├─ Return: { score: null, error: "INCOMPLETE_PROFILE" }
└─ UI shows: "--" with "Complete your profile to get a score"
```

### Scenario B: Has Metrics, No Food Logs (SHOULD BE LOW)
```
User State:
├─ Body Metrics: ✅ 70kg, 170cm, 30yo, male
├─ Meal Plans:   ✅ Auto-generated (2,508 kcal target)
└─ Food Logs:    ❌ None (0 consumed)

Current Behavior (WRONG):
├─ Target = 2,508 kcal (from meal plan)
├─ Actual = 0 kcal (no food logged)
├─ But if target somehow = 0, returns 100 ⚠️
└─ Score = 85-92 ⚠️

Expected Behavior (CORRECT):
├─ Target = 2,508 kcal ✅
├─ Actual = 0 kcal ✅
├─ Error = 100% (0/2508)
├─ calculateMacroScore(0, 2508) = 0 ✅
└─ Score = 15-20 (very low) ✅ CORRECT!
```

### Scenario C: Complete Data (ALREADY WORKING)
```
User State:
├─ Body Metrics: ✅ 70kg, 170cm, 30yo, male
├─ Meal Plans:   ✅ 2,508 kcal target
└─ Food Logs:    ✅ 2,400 kcal consumed

Behavior (CORRECT):
├─ Target = 2,508 kcal
├─ Actual = 2,400 kcal
├─ Error = 4.3% (within 5% tolerance)
├─ calculateMacroScore(2400, 2508) = 100 ✅
└─ Score = 95-100 ✅ CORRECT!
```

## 🔧 Fix Implementation

### Fix 1: Validate Body Metrics FIRST
```typescript
// Before doing ANYTHING, check body metrics
const hasBodyMetrics = profile && 
                      profile.weight_kg > 0 && 
                      profile.height_cm > 0 && 
                      profile.age > 0;

if (!hasBodyMetrics) {
  return {
    score: null,
    message: "Please complete your profile to get a score"
  };
}
```

### Fix 2: Never Allow target = 0
```typescript
// If meal plans somehow missing, calculate from BMR/TDEE
if (nutritionTargets.calories === 0) {
  const bmr = calculateBMR(profile);
  const tdee = bmr * 1.55;  // Moderate activity
  
  nutritionTargets = {
    calories: tdee,
    protein: tdee * 0.25 / 4,
    carbs: tdee * 0.45 / 4,
    fat: tdee * 0.30 / 9
  };
}
```

### Fix 3: Proper Zero Handling
```typescript
function calculateMacroScore(actual: number, target: number): number | null {
  if (target <= 0) {
    // This should never happen after Fix 2
    return null;  // Cannot score
  }
  
  // User ate 0, has target → very low score
  const errorPercent = Math.abs(actual - target) / target;
  if (errorPercent <= 0.05) return 100;
  if (errorPercent <= 0.10) return 60;
  if (errorPercent <= 0.20) return 20;
  return 0;
}
```

## 📊 Decision Matrix

| Body Metrics | Meal Plan | Food Logs | Expected Score | Current Score | Status |
|--------------|-----------|-----------|----------------|---------------|--------|
| ❌ Missing | ❌ Missing | ❌ None | **null** | 85-92 | 🔴 BUG |
| ❌ Missing | ❌ Missing | ✅ Some | **null** | 85-92 | 🔴 BUG |
| ✅ Present | ❌ Missing* | ❌ None | **15-20** | 85-92 | 🔴 BUG |
| ✅ Present | ✅ Present | ❌ None | **15-20** | 85-92 | 🔴 BUG |
| ✅ Present | ✅ Present | ✅ Low | **20-60** | 20-60 | ✅ OK |
| ✅ Present | ✅ Present | ✅ Perfect | **95-100** | 95-100 | ✅ OK |

*Should auto-generate from BMR/TDEE as fallback

## 🎯 Key Insight

### You Are 100% Correct!

**Body metrics (weight, height, age) are the FOUNDATION**, not meal plans.

**Proper Logic:**
```
1. Check body metrics exist
   ├─ NO  → Return null score
   └─ YES → Continue

2. Check/generate meal plan
   ├─ Exists → Use it
   └─ Missing → Calculate from BMR/TDEE

3. Compare food logs vs targets
   ├─ 0 consumed vs 2500 target → Score = 0-20 (very low)
   └─ 2400 consumed vs 2500 target → Score = 95-100 (excellent)
```

**Current Bug:**
```
1. Skip body metrics check ❌
2. If meal plan missing → targets = 0 ❌
3. If consumed = 0, targets = 0 → Score = 100 ❌
4. Return 85-92 ❌ WRONG!
```

## ✅ Summary

The scoring system should:
1. **Require body metrics** as foundation
2. **Auto-generate meal plans** from BMR/TDEE
3. **Score low** when user doesn't eat (0 vs target)
4. **Score high** when user eats well (actual ≈ target)

It should NOT:
1. ❌ Give high scores when data is missing
2. ❌ Return 100 when target = 0
3. ❌ Skip body metrics validation

**The fix: Add body metrics validation as the first check!**
