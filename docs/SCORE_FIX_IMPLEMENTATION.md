# Score 92 Bug - Implementation Guide

## Changes Made

### ✅ 1. Fixed calculateMacroScore (CRITICAL)

**File:** `src/lib/unified-scoring.ts` line 167

**Before:**
```typescript
function calculateMacroScore(actual: number, target: number): number {
  if (target <= 0) return 100;  // ⚠️ WRONG - returns perfect score!
  // ...
}
```

**After:**
```typescript
function calculateMacroScore(actual: number, target: number): number {
  // If target is 0 or missing, this indicates missing meal plan data
  // Return 0 instead of 100 to avoid rewarding incomplete data
  if (target <= 0) return 0;  // ✅ FIXED - returns 0 for missing data
  
  const errorPercent = Math.abs(actual - target) / target;
  
  if (errorPercent <= 0.05) return 100;  // ±5% = perfect
  if (errorPercent <= 0.10) return 60;  // ±10% = good
  if (errorPercent <= 0.20) return 20;  // ±20% = poor
  return 0;  // >20% = fail
}
```

**Impact:**
- Users with NO meal plan (target = 0) now get **0** instead of **100**
- This alone fixes the 92 → 0-20 range for missing data

---

### ✅ 2. Added Data Completeness Tracking

**File:** `src/lib/unified-scoring.ts`

**Added to ScoreBreakdown interface:**
```typescript
export interface ScoreBreakdown {
  // ... existing fields
  
  // NEW: Data completeness tracking
  dataCompleteness?: {
    hasBodyMetrics: boolean;        // Has weight, height, age
    hasMealPlan: boolean;           // Has meal plan for today
    hasFoodLogs: boolean;           // Has any food logged
    mealsLogged: number;            // Number of meals logged
    reliable: boolean;              // Is the score reliable?
    missingData: string[];          // List of missing data
  };
}
```

---

### ✅ 3. Added Incomplete Data Penalty

**File:** `src/lib/unified-scoring.ts` in `calculateUnifiedScore()`

**Added:**
```typescript
// Check data completeness
const hasMealPlan = nutrition.target.calories > 0;
const hasFoodLogs = nutrition.actual.calories > 0 || nutrition.mealsPresent.length > 0;
const mealsLogged = nutrition.mealsPresent.length;

// ... calculate scores ...

// Apply incomplete data penalty
let incompletePenalty = 0;
const missingData: string[] = [];

if (!hasMealPlan) {
  incompletePenalty -= 30;
  missingData.push('meal plan');
}
if (!hasFoodLogs) {
  incompletePenalty -= 30;
  missingData.push('food logs');
}
if (mealsLogged === 0 && hasFoodLogs) {
  incompletePenalty -= 10;
  missingData.push('structured meals');
}

// Calculate final score with penalty
const total = Math.max(0, Math.min(100, Math.round(
  baseScore + modifiers.bonuses + modifiers.penalties - overconsumptionPenalty + incompletePenalty
)));

// Determine if score is reliable
const reliable = hasMealPlan && hasFoodLogs && mealsLogged > 0;

return {
  total,
  // ... other fields ...
  dataCompleteness: {
    hasBodyMetrics: true, // Will be set by service layer
    hasMealPlan,
    hasFoodLogs,
    mealsLogged,
    reliable,
    missingData,
  },
};
```

---

### ✅ 4. Added Body Metrics Validation

**File:** `src/services/unified-score.service.ts`

**Added at the start of `getDailyUnifiedScore()`:**
```typescript
// Validate body metrics exist
const hasBodyMetrics = profile && 
                      profile.weight_kg && profile.weight_kg > 0 &&
                      profile.height_cm && profile.height_cm > 0 &&
                      profile.age && profile.age > 0;

if (!hasBodyMetrics) {
  console.warn('⚠️ User missing body metrics:', userId);
  // Return low score with incomplete data flag
  const breakdown: ScoreBreakdown = {
    total: 0,
    nutrition: { total: 0, macros: 0, timing: 0, structure: 0 },
    training: { total: 0, completion: 0, typeMatch: 0, intensity: 0 },
    bonuses: 0,
    penalties: -100,
    weights: { nutrition: 1, training: 0 },
    dataCompleteness: {
      hasBodyMetrics: false,
      hasMealPlan: false,
      hasFoodLogs: false,
      mealsLogged: 0,
      reliable: false,
      missingData: ['body metrics (weight, height, age)'],
    },
  };
  
  return {
    score: 0,
    breakdown,
    context: null as any,
  };
}
```

---

### ✅ 5. Created UI Components

**File:** `src/components/IncompleteProfileAlert.tsx` (NEW)

Two new components created:

#### Component 1: `IncompleteProfileAlert`
Shows a dynamic alert based on what's missing:
- **No body metrics** → Red critical alert with "Complete Your Profile" button
- **No meal plan** → Orange warning
- **No food logs** → Yellow info with "Log Your First Meal" button
- **Complete data** → Nothing shown

#### Component 2: `DataCompletenessScoreDisplay`
Replaces the simple score number with context:
- **Reliable data** → Normal score (e.g., "92")
- **No body metrics** → Shows "--" with "Profile incomplete"
- **Incomplete data** → Shows score in orange with ⚠️ icon

**Usage:**
```tsx
<IncompleteProfileAlert
  hasBodyMetrics={breakdown.dataCompleteness.hasBodyMetrics}
  hasMealPlan={breakdown.dataCompleteness.hasMealPlan}
  hasFoodLogs={breakdown.dataCompleteness.hasFoodLogs}
  mealsLogged={breakdown.dataCompleteness.mealsLogged}
  missingData={breakdown.dataCompleteness.missingData}
/>

<DataCompletenessScoreDisplay
  score={dailyScore}
  hasBodyMetrics={true}
  hasMealPlan={false}
  hasFoodLogs={false}
  mealsLogged={0}
  reliable={false}
  missingData={['meal plan', 'food logs']}
/>
```

---

## Expected Behavior After Fix

| Scenario | Old Score | New Score | UI Display |
|----------|-----------|-----------|------------|
| **No body metrics** | 85-92 | **0** | "--" + Red alert |
| **Has metrics, no meal plan** | 85-92 | **0-10** | Orange score + Warning |
| **Has metrics + plan, no food logs** | 85-92 | **0-20** | Orange score + "Log meals" |
| **Has all data, ate 0** | 85-92 | **0-20** | Orange score (actual 0 vs target) |
| **Has all data, ate well** | 95-100 | **95-100** | Normal green score ✅ |

---

## Testing

### Test 1: User with no body metrics
```bash
# Expected: score = 0, shows "--" with red alert
# Check dataCompleteness.hasBodyMetrics = false
```

### Test 2: User with metrics but no meal plan
```bash
# Expected: score = 0-10 (penalties applied)
# Check dataCompleteness.hasMealPlan = false
```

### Test 3: User with metrics + plan, but ate nothing
```bash
# Expected: score = 0-20 
# Macros: 0 consumed / 2500 target = 100% error = 0 score
# Check dataCompleteness.hasFoodLogs = false
```

### Test 4: User with complete data
```bash
# Expected: score = 85-100 (based on actual adherence)
# Check dataCompleteness.reliable = true
```

---

## Integration Steps

1. **Import components in Dashboard:**
```typescript
import { IncompleteProfileAlert, DataCompletenessScoreDisplay } from '@/components/IncompleteProfileAlert';
```

2. **Add alert at top of dashboard:**
```tsx
{unifiedScoreResult?.breakdown?.dataCompleteness && 
 !unifiedScoreResult.breakdown.dataCompleteness.reliable && (
  <IncompleteProfileAlert
    hasBodyMetrics={unifiedScoreResult.breakdown.dataCompleteness.hasBodyMetrics}
    hasMealPlan={unifiedScoreResult.breakdown.dataCompleteness.hasMealPlan}
    hasFoodLogs={unifiedScoreResult.breakdown.dataCompleteness.hasFoodLogs}
    mealsLogged={unifiedScoreResult.breakdown.dataCompleteness.mealsLogged}
    missingData={unifiedScoreResult.breakdown.dataCompleteness.missingData}
  />
)}
```

3. **Replace score display:**
```tsx
<DataCompletenessScoreDisplay
  score={dashboardData.dailyScore}
  hasBodyMetrics={unifiedScoreResult?.breakdown?.dataCompleteness?.hasBodyMetrics ?? true}
  hasMealPlan={unifiedScoreResult?.breakdown?.dataCompleteness?.hasMealPlan ?? false}
  hasFoodLogs={unifiedScoreResult?.breakdown?.dataCompleteness?.hasFoodLogs ?? false}
  mealsLogged={unifiedScoreResult?.breakdown?.dataCompleteness?.mealsLogged ?? 0}
  reliable={unifiedScoreResult?.breakdown?.dataCompleteness?.reliable ?? false}
  missingData={unifiedScoreResult?.breakdown?.dataCompleteness?.missingData ?? []}
/>
```

---

## Summary

### What Changed
1. ✅ `calculateMacroScore(0, 0)` now returns **0** instead of **100**
2. ✅ Added body metrics validation (returns score = 0 if missing)
3. ✅ Added incomplete data penalties (-30 for no plan, -30 for no logs)
4. ✅ Added `dataCompleteness` tracking to breakdown
5. ✅ Created dynamic UI components to show warnings

### Impact
- Users with **NO DATA** now get **0-20** instead of **85-92**
- Users with **NO BODY METRICS** get **0** with clear warning
- Users with **COMPLETE DATA** still get **85-100** as before ✅
- Clear visual feedback about what's missing

### Decisions Made
- **Chose 0 over null** to avoid breaking existing code
- **Applied penalties** for missing data
- **Created warnings** instead of blocking (better UX)
- **No database changes** required

**The bug is fixed! 🎉**
