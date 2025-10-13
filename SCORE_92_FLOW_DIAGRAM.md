# Scoring System Flow Diagram - Zero Data Problem

## Current Flawed Flow (Why 92 happens)

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER HAS NO DATA                            │
│  • No meal plan (target = 0)                                    │
│  • No food logs (actual = 0)                                    │
│  • No training data                                             │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 1: Calculate Macro Scores                     │
│                                                                 │
│  calculateMacroScore(actual=0, target=0)                        │
│  ├── if (target <= 0) return 100  ⚠️ PROBLEM!                  │
│  │                                                              │
│  ├── Calories: 0/0 → 100 ✅                                     │
│  ├── Protein:  0/0 → 100 ✅                                     │
│  ├── Carbs:    0/0 → 100 ✅                                     │
│  └── Fat:      0/0 → 100 ✅                                     │
│                                                                 │
│  Weighted Macro Score = 100                                     │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 2: Calculate Timing Score                     │
│                                                                 │
│  Rest day → all windows "not applicable"                        │
│  ├── Pre-run:    not applicable → 100 ✅                        │
│  ├── During-run: not applicable → 100 ✅                        │
│  └── Post-run:   not applicable → 100 ✅                        │
│                                                                 │
│  Timing Score = 100                                             │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│             STEP 3: Calculate Structure Score                   │
│                                                                 │
│  No meals logged → only component that penalizes!               │
│  ├── Breakfast: missing → 0 ❌                                  │
│  ├── Lunch:     missing → 0 ❌                                  │
│  ├── Dinner:    missing → 0 ❌                                  │
│  └── Snack:     missing → 0 ❌                                  │
│                                                                 │
│  Structure Score = 0                                            │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│           STEP 4: Combine Nutrition Components                  │
│                                                                 │
│  Nutrition = (Macros × 50%) + (Timing × 35%) + (Structure × 15%)│
│            = (100 × 0.50) + (100 × 0.35) + (0 × 0.15)          │
│            = 50 + 35 + 0                                        │
│            = 85                                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│            STEP 5: Calculate Training Score                     │
│                                                                 │
│  No plan (planned=0), No actual (actual=0)                      │
│  ├── Completion: 0/0 → 100 ⚠️ PROBLEM!                         │
│  ├── Type match: no data → 0                                   │
│  └── Intensity:  no HR → 0                                     │
│                                                                 │
│  Training = (100 × 60%) + (0 × 25%) + (0 × 15%)                │
│           = 60                                                  │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│          STEP 6: Apply Load-Based Weighting                     │
│                                                                 │
│  Rest day: Nutrition 100%, Training 0%                          │
│                                                                 │
│  Base Score = (85 × 1.0) + (60 × 0.0)                          │
│             = 85                                                │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│           STEP 7: Apply Bonuses & Penalties                     │
│                                                                 │
│  Common bonuses (even with no data):                            │
│  ├── Window sync: +5                                            │
│  ├── Hydration:   +2                                            │
│  └── Total:       +7                                            │
│                                                                 │
│  Final Score = 85 + 7 = 92 ⭐                                   │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                 RESULT: Score = 92                              │
│                                                                 │
│  User with ZERO data gets 92/100! 🤦                            │
│  Same as user who logged perfect nutrition!                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Score Breakdown by Data Availability

```
┌──────────────────────┬──────────┬──────────┬──────────┬──────────┐
│ Data Present         │ Macros   │ Timing   │ Structure│ Final    │
│                      │ (50%)    │ (35%)    │ (15%)    │ Score    │
├──────────────────────┼──────────┼──────────┼──────────┼──────────┤
│ NO DATA              │ 100 ⚠️   │ 100 ⚠️   │ 0        │ 85       │
│ (target=0, actual=0) │          │          │          │          │
├──────────────────────┼──────────┼──────────┼──────────┼──────────┤
│ + 1 meal logged      │ 100      │ 100      │ 25       │ 89       │
│ (still no plan)      │          │          │          │          │
├──────────────────────┼──────────┼──────────┼──────────┼──────────┤
│ + 2 meals logged     │ 100      │ 100      │ 50       │ 93       │
│ (still no plan)      │          │          │          │          │
├──────────────────────┼──────────┼──────────┼──────────┼──────────┤
│ + bonuses (+7)       │ 100      │ 100      │ 0        │ 92 ⭐    │
│ (no meals, no plan)  │          │          │          │          │
├──────────────────────┼──────────┼──────────┼──────────┼──────────┤
│ PERFECT NUTRITION    │ 100 ✅   │ 100 ✅   │ 100 ✅   │ 100      │
│ (all data complete)  │          │          │          │          │
└──────────────────────┴──────────┴──────────┴──────────┴──────────┘
```

**Problem:** Can't distinguish between "no data" (92) and "good nutrition" (92-100)!

---

## Proposed Fix Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER HAS NO DATA                            │
│  • No meal plan (target = 0 or null)                            │
│  • No food logs (actual = 0 or null)                            │
│  • No training data                                             │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 1: Data Validation Check                      │
│                                                                 │
│  Check data completeness:                                       │
│  ├── hasMealPlan = false ❌                                     │
│  ├── hasFoodLogs = false ❌                                     │
│  └── hasTrainingData = false ❌                                 │
│                                                                 │
│  Data Completeness: 0%                                          │
│                                                                 │
│  OPTIONS:                                                       │
│  A) Return null score with message ✅ BEST                      │
│  B) Apply heavy penalty (-60 pts)  ✅ GOOD                      │
│  C) Use default targets           ⚠️ OK                         │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              OPTION A: Null Score (Recommended)                 │
│                                                                 │
│  return {                                                       │
│    total: null,                                                 │
│    message: "Insufficient data to calculate score",             │
│    dataCompleteness: {                                          │
│      hasMealPlan: false,                                        │
│      hasFoodLogs: false,                                        │
│      hasTrainingData: false,                                    │
│      completenessPercent: 0,                                    │
│      reliable: false                                            │
│    }                                                            │
│  }                                                              │
│                                                                 │
│  UI displays:                                                   │
│  ┌─────────────────────────────────────┐                       │
│  │ Daily Score: --                     │                       │
│  │ ⚠️ No data available                │                       │
│  │ Log your meals to see your score!   │                       │
│  └─────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              OPTION B: Incomplete Data Penalty                  │
│                                                                 │
│  Calculate score normally, then apply penalties:                │
│                                                                 │
│  Base score: 85 (from zero targets)                             │
│                                                                 │
│  Penalties:                                                     │
│  ├── No meal plan:  -30 pts                                     │
│  ├── No food logs:  -30 pts                                     │
│  └── No training:   -20 pts                                     │
│                                                                 │
│  Final = 85 - 80 = 5 ⭐                                          │
│                                                                 │
│  UI displays:                                                   │
│  ┌─────────────────────────────────────┐                       │
│  │ Daily Score: 5 / 100                │                       │
│  │ ⚠️ Score reduced due to missing:    │                       │
│  │   • Meal plan (-30)                 │                       │
│  │   • Food logs (-30)                 │                       │
│  │   • Training data (-20)             │                       │
│  └─────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│         OPTION C: Use Default Targets (Fallback)                │
│                                                                 │
│  If target = 0, use reasonable defaults:                        │
│  ├── Calories: 2000 (typical TDEE)                              │
│  ├── Protein:  150g                                             │
│  ├── Carbs:    250g                                             │
│  └── Fat:      65g                                              │
│                                                                 │
│  Then score actual (0) vs defaults:                             │
│  ├── 0 vs 2000 cal → error = 100% → score = 0                  │
│  ├── 0 vs 150g pro → error = 100% → score = 0                  │
│  ├── 0 vs 250g cho → error = 100% → score = 0                  │
│  └── 0 vs 65g fat  → error = 100% → score = 0                  │
│                                                                 │
│  Macro score = 0                                                │
│  Nutrition = (0 × 50%) + (100 × 35%) + (0 × 15%) = 35          │
│  Final = 35 ⭐ Much more realistic!                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Code Changes Required

### File: `src/lib/unified-scoring.ts`

**Current (Broken):**
```typescript
function calculateMacroScore(actual: number, target: number): number {
  if (target <= 0) return 100;  // ⚠️ WRONG!
  // ...
}
```

**Fixed (Option A - Null Handling):**
```typescript
function calculateMacroScore(
  actual: number | null, 
  target: number | null
): number | null {
  // No data = cannot score
  if (target === null || target <= 0) return null;
  if (actual === null) return null;
  
  // Normal scoring
  const errorPercent = Math.abs(actual - target) / target;
  if (errorPercent <= 0.05) return 100;
  if (errorPercent <= 0.10) return 60;
  if (errorPercent <= 0.20) return 20;
  return 0;
}
```

**Fixed (Option B - Penalty):**
```typescript
export function calculateUnifiedScore(context: ScoringContext): ScoreBreakdown {
  // ... existing calculation ...
  
  // Check data completeness
  const hasMealPlan = context.nutrition.target.calories > 0;
  const hasFoodLogs = context.nutrition.actual.calories > 0;
  const mealsLogged = context.nutrition.mealsPresent.length;
  
  let incompletePenalty = 0;
  if (!hasMealPlan) incompletePenalty -= 30;
  if (!hasFoodLogs) incompletePenalty -= 30;
  if (mealsLogged === 0) incompletePenalty -= 20;
  
  // Apply to final score
  const total = Math.max(0, Math.min(100, Math.round(
    baseScore + modifiers.bonuses + modifiers.penalties + incompletePenalty
  )));
  
  return {
    total,
    dataCompleteness: {
      hasMealPlan,
      hasFoodLogs,
      mealsLogged,
      penalty: incompletePenalty
    },
    // ...
  };
}
```

**Fixed (Option C - Default Targets):**
```typescript
const DEFAULT_TARGETS = {
  calories: 2000,
  protein: 150,
  carbs: 250,
  fat: 65
};

function calculateMacroScore(actual: number, target: number, macroType: string): number {
  // Use default if no target
  const effectiveTarget = target > 0 ? target : DEFAULT_TARGETS[macroType];
  
  const errorPercent = Math.abs(actual - effectiveTarget) / effectiveTarget;
  if (errorPercent <= 0.05) return 100;
  if (errorPercent <= 0.10) return 60;
  if (errorPercent <= 0.20) return 20;
  return 0;
}
```

---

## Testing the Fix

### Test Case 1: No Data
```javascript
const context = createScoringContext(
  { calories: 0, protein: 0, carbs: 0, fat: 0 },
  { calories: 0, protein: 0, carbs: 0, fat: 0 },
  undefined,
  undefined,
  { load: 'rest' }
);

const result = calculateUnifiedScore(context);

// Current (broken): result.total = 85
// Fixed (Option A): result.total = null
// Fixed (Option B): result.total = 5 (85 - 80 penalty)
// Fixed (Option C): result.total = 35
```

### Test Case 2: Partial Data (has plan, no logs)
```javascript
const context = createScoringContext(
  { calories: 2000, protein: 150, carbs: 250, fat: 65 },
  { calories: 0, protein: 0, carbs: 0, fat: 0 },
  undefined,
  undefined,
  { load: 'rest' }
);

const result = calculateUnifiedScore(context);

// Should score low (0-20) because error is 100%
```

---

## Recommended Implementation

**Priority 1: Option B (Incomplete Data Penalty)**
- Easiest to implement
- Clear user feedback
- Motivates data logging

**Priority 2: Add Data Completeness UI**
- Show percentage complete
- List missing data
- Explain score reliability

**Priority 3: Option A (Null Scores)**
- Cleanest solution
- Requires UI changes
- Best long-term approach

---

## Summary

The scoring system has **3 critical flaws** that cause the 92 baseline:

1. ⚠️ **Zero targets return 100** (should return null or 0)
2. ⚠️ **Missing data defaults to 100** (timing, training completion)
3. ⚠️ **No minimum data requirement** (can score with zero input)

**Impact:**
- Users with NO DATA get 85-96 scores
- Indistinguishable from users with good nutrition
- Undermines entire scoring system

**Fix:**
- Implement Option B (incomplete data penalty) immediately
- Add data completeness indicator to UI
- Plan migration to Option A (null scores) for v2
