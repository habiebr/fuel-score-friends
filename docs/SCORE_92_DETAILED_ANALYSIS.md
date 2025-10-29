# Score 92 Baseline - Detailed Analysis of Scoring System & Science Layer

## Executive Summary

The baseline score of **92** (or similar high scores like 85-96) for users with no plan, meals, or input metrics is caused by **a fundamental design flaw in the scoring logic** where:

1. **Zero targets return perfect scores (100)** - When there's no meal plan (target = 0), the system assumes "perfection"
2. **Default assumptions favor high scores** - Timing windows and training completion default to 100 when not applicable
3. **Structure is the only penalty** - Only meal structure (0-25 points) penalizes missing data

This results in users with **NO DATA** getting scores between **85-96** depending on bonuses and meal count.

---

## 🔍 Root Cause Analysis

### The Critical Flaw

**File:** `src/lib/unified-scoring.ts` (Line 168)

```typescript
function calculateMacroScore(actual: number, target: number): number {
  if (target <= 0) return 100;  // ⚠️ PROBLEM: Zero target = Perfect score!
  
  const errorPercent = Math.abs(actual - target) / target;
  
  if (errorPercent <= 0.05) return 100;  // ±5% = perfect
  if (errorPercent <= 0.10) return 60;   // ±10% = good
  if (errorPercent <= 0.20) return 20;   // ±20% = poor
  return 0;  // >20% = fail
}
```

**The Problem:**
- When a user has **no meal plan** → `target = 0`
- The function returns `100` (perfect score) for all macros
- Even with **zero food logged**, you get a perfect macro score!

---

## 📊 Score Calculation Breakdown (No Data Scenario)

### Scenario: User with NO meal plan, NO food logs, NO training

```javascript
// 1. MACRO SCORES (all return 100 because target = 0)
calorieScore = calculateMacroScore(0, 0) = 100  ✅ Perfect!
proteinScore = calculateMacroScore(0, 0) = 100  ✅ Perfect!
carbsScore = calculateMacroScore(0, 0) = 100    ✅ Perfect!
fatScore = calculateMacroScore(0, 0) = 100      ✅ Perfect!

// 2. WEIGHTED MACRO SCORE (runner-focused strategy)
macrosScore = (100 × 0.3) + (100 × 0.4) + (100 × 0.2) + (100 × 0.1)
            = 30 + 40 + 20 + 10
            = 100  ✅ Perfect macros!

// 3. TIMING SCORE (all windows default to 100 when not applicable)
timingPre = 100     // Not applicable on rest day
timingDuring = 100  // Not applicable on rest day
timingPost = 100    // Not applicable on rest day
timingScore = (100 × 0.4) + (100 × 0.4) + (100 × 0.2)
            = 40 + 40 + 20
            = 100  ✅ Perfect timing!

// 4. STRUCTURE SCORE (only component that penalizes missing data)
structureScore = 0  // No meals logged ❌
hasBreakfast = false → 0
hasLunch = false → 0
hasDinner = false → 0
hasSnack = false → 0
Total = 0

// 5. NUTRITION TOTAL (weighted combination)
nutritionScore = (macrosScore × 0.50) + (timingScore × 0.35) + (structureScore × 0.15)
               = (100 × 0.50) + (100 × 0.35) + (0 × 0.15)
               = 50 + 35 + 0
               = 85  ⭐ Base score for zero data!

// 6. TRAINING SCORE (defaults to 100 when no plan and no actual)
completionScore = 100  // planned=0, actual=0 → considered "complete"
typeMatchScore = 0
intensityScore = 0
trainingScore = (100 × 0.60) + (0 × 0.25) + (0 × 0.15)
              = 60

// 7. LOAD-BASED WEIGHTING (rest day)
nutritionWeight = 1.0  // 100% nutrition on rest days
trainingWeight = 0.0   // 0% training on rest days

// 8. FINAL SCORE
baseScore = (nutritionScore × 1.0) + (trainingScore × 0.0)
          = 85 + 0
          = 85  ⭐ Base daily score with zero data!

// 9. WITH BONUSES (where 92 comes from)
bonuses = 7 (e.g., 5 for window sync + 2 for hydration)
finalScore = 85 + 7 = 92  ⭐⭐⭐ The infamous "92"!
```

---

## 🎯 Different Scenarios Leading to High Scores

| Scenario | Nutrition | Training | Final Score |
|----------|-----------|----------|-------------|
| **No data at all** | 85 | 60 | **85** (rest day) |
| **No data + bonuses (7pts)** | 85 | 60 | **92** ⭐ |
| **No data + max bonuses (10pts)** | 85 | 60 | **95** |
| **1 meal logged, no plan** | 88.75 | 60 | **89** |
| **2 meals logged, no plan** | 92.5 | 60 | **93** |
| **3 meals logged, no plan** | 96.25 | 60 | **96** |

**Why structure helps even with no plan:**
- Each meal logged adds 25 points to structure
- Structure is weighted at 15% of nutrition score
- 25 × 0.15 = 3.75 points per meal
- This pushes the score from 85 → 89 → 93 → 96

---

## 🧪 Science Layer Components

### 1. Macro Scoring (Piecewise Function)

**Location:** `src/lib/unified-scoring.ts` & `src/science/dailyScore.ts`

```typescript
function piecewiseScore(errorPctAbs: number): number {
  if (errorPctAbs <= 0.05) return 100;  // ±5% tolerance
  if (errorPctAbs <= 0.10) return 60;   // ±10% tolerance
  if (errorPctAbs <= 0.20) return 20;   // ±20% tolerance
  return 0;  // >20% error
}
```

**Weights (Runner-Focused):**
- Calories: 30%
- Carbs: 40% (most important for runners)
- Protein: 20%
- Fat: 10%

### 2. Timing Scoring (Fueling Windows)

**Weights:**
- Pre-run: 40%
- During-run: 40%
- Post-run: 20%

**Logic:**
- If window not applicable → defaults to 100
- If applicable but missed → 0
- All-or-nothing scoring

### 3. Structure Scoring (Meal Distribution)

**Points:**
- Breakfast: 25 points
- Lunch: 25 points
- Dinner: 25 points
- Snack: 25 points (only on training days)

**Penalties:**
- Single meal >60% calories → cap at 70 points

### 4. Training Scoring

**Components:**
- Completion (60-75%): Duration vs plan
- Type match (25%): Activity type alignment
- Intensity (0-15%): Heart rate zones (if available)

**Completion Logic:**
```typescript
if (planned === 0 && actual === 0) return 100;  // ⚠️ No plan = perfect!
if (planned === 0) return 100;  // ⚠️ Any activity without plan = perfect!
```

### 5. Load-Based Weighting

| Training Load | Nutrition Weight | Training Weight |
|---------------|------------------|-----------------|
| **Rest** | 100% | 0% |
| **Easy** | 70% | 30% |
| **Moderate** | 60% | 40% |
| **Long** | 55% | 45% |
| **Quality** | 60% | 40% |

### 6. Bonuses & Penalties

**Bonuses (max +10):**
- All windows synced: +5
- Streak days: +1 to +5
- Hydration OK: +2

**Penalties (max -15):**
- Hard day underfueling: -5
- Big calorie deficit on long run: -10
- Missed post-run window: -3

---

## 🐛 Why This Is Problematic

### 1. **False Positives**
- Users with NO DATA get scores of 85-96
- Appears they're doing great when they're doing nothing
- Misleading feedback loop

### 2. **No Motivation to Log Data**
- Why log food if you already have 85+ score?
- Users are rewarded for inactivity

### 3. **Undermines Trust**
- When users discover the truth, they lose confidence
- "The app said I had 92/100 but I didn't eat anything"

### 4. **Masks Real Issues**
- Can't distinguish between:
  - User with excellent nutrition (real 92)
  - User with no data (fake 92)

---

## ✅ Proposed Solutions

### Solution 1: **Require Minimum Data** (Recommended)

```typescript
function calculateMacroScore(actual: number, target: number): number {
  // If no target AND no actual, return 0 (not 100)
  if (target <= 0 && actual <= 0) return 0;
  
  // If no target but has actual, score based on reasonable defaults
  if (target <= 0) {
    // Use population averages as fallback
    const avgTarget = getDefaultTarget(macroType); // e.g., 2000 cal, 150g protein
    return piecewiseScore(actual, avgTarget);
  }
  
  // Normal scoring
  const errorPercent = Math.abs(actual - target) / target;
  if (errorPercent <= 0.05) return 100;
  if (errorPercent <= 0.10) return 60;
  if (errorPercent <= 0.20) return 20;
  return 0;
}
```

### Solution 2: **Incomplete Data Penalty**

```typescript
export function calculateUnifiedScore(context: ScoringContext): ScoreBreakdown {
  // ... existing calculation ...
  
  // Apply incomplete data penalty
  const hasMealPlan = context.nutrition.target.calories > 0;
  const hasFoodLogs = context.nutrition.actual.calories > 0;
  const hasTrainingData = context.training.plan || context.training.actual;
  
  let incompletePenalty = 0;
  if (!hasMealPlan) incompletePenalty -= 30;
  if (!hasFoodLogs) incompletePenalty -= 30;
  if (!hasTrainingData && context.load !== 'rest') incompletePenalty -= 20;
  
  // Apply penalty
  const total = Math.max(0, Math.min(100, Math.round(
    baseScore + modifiers.bonuses + modifiers.penalties + incompletePenalty
  )));
  
  return { total, ... };
}
```

### Solution 3: **Show Data Completeness**

```typescript
interface ScoreBreakdown {
  total: number;
  dataCompleteness: {
    hasMealPlan: boolean;
    hasFoodLogs: boolean;
    hasTrainingData: boolean;
    completenessPercent: number;
    reliable: boolean;  // false if missing critical data
  };
  // ... rest
}
```

Display in UI:
```
Daily Score: 92 ⚠️
Data Completeness: 25% (Missing meal plan and food logs)
This score may not be accurate. Please log your meals.
```

### Solution 4: **Null State vs Zero State**

```typescript
function calculateMacroScore(actual: number | null, target: number | null): number {
  // Distinguish between "no data" (null) and "zero consumed" (0)
  if (target === null || target <= 0) {
    return null;  // Cannot score without target
  }
  
  if (actual === null) {
    return null;  // Cannot score without actual
  }
  
  // Normal scoring
  const errorPercent = Math.abs(actual - target) / target;
  if (errorPercent <= 0.05) return 100;
  if (errorPercent <= 0.10) return 60;
  if (errorPercent <= 0.20) return 20;
  return 0;
}

// Then handle null scores
const macrosScore = [calorieScore, proteinScore, carbsScore, fatScore]
  .filter(score => score !== null);
  
if (macrosScore.length === 0) {
  return { total: null, message: "Insufficient data to calculate score" };
}
```

---

## 📁 Key Files

### Scoring Logic
- `src/lib/unified-scoring.ts` - Main scoring system
- `src/science/dailyScore.ts` - Legacy science layer
- `src/services/unified-score.service.ts` - Service layer

### Database
- `nutrition_scores` table - Cached scores
- `daily_meal_plans` table - Meal plan targets
- `food_logs` table - Actual consumption
- `training_activities` table - Training data

---

## 🔗 Related Issues

1. **Stale Cache** - Documented in `SCORE_92_ROOT_CAUSE.md`
   - Old scores persist in `nutrition_scores` table
   - No cache invalidation strategy
   
2. **Automatic Meal Generation** - Works correctly
   - Runs daily at midnight UTC
   - Generates plans for all users
   - The issue is NOT missing meal plans

3. **Zero Data Scoring** - THIS DOCUMENT
   - Fundamental flaw in scoring logic
   - Zero targets return perfect scores
   - Needs architectural fix

---

## 🎯 Recommendations

### Immediate (Priority 1)
1. **Add data completeness indicator** to UI
2. **Show warning** when score is based on incomplete data
3. **Document the limitation** in user-facing help

### Short-term (Priority 2)
1. **Implement incomplete data penalty**
2. **Require minimum data** for scoring
3. **Add cache invalidation** strategy

### Long-term (Priority 3)
1. **Redesign scoring logic** with proper null handling
2. **Add data quality metrics** to score breakdown
3. **Implement progressive scoring** (better scores require more data)

---

## 📊 Testing Commands

```bash
# Test zero data scenario
node -e "
const { calculateUnifiedScore, createScoringContext } = require('./src/lib/unified-scoring.ts');
const context = createScoringContext(
  { calories: 0, protein: 0, carbs: 0, fat: 0 },
  { calories: 0, protein: 0, carbs: 0, fat: 0 },
  undefined,
  undefined,
  { load: 'rest', strategy: 'runner-focused' }
);
console.log('Score with zero data:', calculateUnifiedScore(context).total);
"

# Check cached scores
psql $DATABASE_URL -c "
SELECT user_id, date, daily_score, 
       calories_consumed, meals_logged, updated_at
FROM nutrition_scores 
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC, user_id;
"

# Clear cache for testing
psql $DATABASE_URL -c "DELETE FROM nutrition_scores;"
```

---

## 📝 Conclusion

The **92 baseline score** is NOT from stale cache alone - it's a **fundamental design flaw** where:

- **Zero targets = Perfect scores** (100 for all macros)
- **Missing data defaults to high scores** (timing, training = 100)
- **Only structure penalizes** missing meals (max -15 points)

This creates a perverse incentive where users get **85-96 scores with NO DATA**.

**The fix requires:**
1. Changing the scoring logic to handle missing data properly
2. Adding data completeness requirements
3. Showing users when scores are unreliable

The existing documentation (`DEBUG_SCORE_92.md`, `SCORE_92_ROOT_CAUSE.md`) identified the cache issue, but **missed the deeper problem** in the scoring algorithm itself.
