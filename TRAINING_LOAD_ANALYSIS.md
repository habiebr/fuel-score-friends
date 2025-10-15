# Training Load Classification Analysis

**Date:** October 13, 2025  
**Analysis:** Comparing training load classification logic with science layer specifications

## Summary

✅ **Training load classification is mostly aligned with science layer**  
⚠️ **Minor inconsistency found in quality/interval classification**

## Training Load Categories (Science Layer)

From `nutrition-unified.ts` and science documentation:

| Load | Activity Factor | Description | Carbs (g/kg) | Protein (g/kg) |
|------|----------------|-------------|--------------|----------------|
| **REST** | 1.4 | Rest or recovery | 3-4 | 1.6 |
| **EASY** | 1.6 | Easy run < 60 min | 5-6 | 1.6-1.8 |
| **MODERATE** | 1.8 | Moderate run 60+ min | 6-8 | 1.8 |
| **LONG** | 2.0 | Long run ≥15 km or >90 min | 8-10 | 1.8-2.0 |
| **QUALITY** | 2.1 | Intense (tempo, intervals, hills) | 7-9 | 1.8-2.0 |

## Classification Logic Implementation

### Edge Function (`nutrition-unified.ts`)

```typescript
export function aggregateActivitiesToLoad(activities): TrainingLoad {
  const classify = (a: any): TrainingLoad => {
    if (a.activity_type === 'run') {
      if (typeof a.distance_km === 'number' && a.distance_km >= 15) return 'long';
      if ((a.intensity || 'moderate') === 'high') return 'quality';
      if (typeof a.duration_minutes === 'number' && a.duration_minutes >= 60) return 'moderate';
      return 'easy';
    }
    // ... other activity types
  };
}
```

**Logic:**
1. **LONG:** `distance >= 15 km` ✅
2. **QUALITY:** `intensity === 'high'` ✅
3. **MODERATE:** `duration >= 60 minutes` ✅
4. **EASY:** Everything else

### Dashboard (`Dashboard.tsx`)

```typescript
const determineTrainingLoad = async () => {
  // From planned training
  if (hasRest && plannedActivities.length === 1) return 'rest';
  if (totalDistance >= 15) return 'long';
  if (hasHighIntensity || (totalDuration >= 60 && totalDistance >= 10)) return 'quality';
  if (totalDuration >= 45 || totalDistance >= 8) return 'moderate';
  return 'easy';
  
  // From Google Fit (fallback)
  if (activeMinutes < 15 && distanceKm < 2) return 'rest';
  if (activeMinutes < 45 || distanceKm < 8) return 'easy';
  if (distanceKm >= 15) return 'long';
  if (activeMinutes >= 60 && distanceKm >= 10) return 'quality';
  return 'moderate';
};
```

**Logic:**
1. **REST:** `activity < 15 min AND distance < 2 km` ✅
2. **LONG:** `distance >= 15 km` ✅
3. **QUALITY:** `high intensity OR (duration >= 60 AND distance >= 10)` ⚠️
4. **MODERATE:** `duration >= 45 OR distance >= 8` ✅
5. **EASY:** Everything else

## Analysis by Activity Type

### 1. Long Run (≥15 km)

**Classification:** `long` load  
**Activity Factor:** 2.0  
**Aligned?** ✅ YES

**Implementation:**
- Edge function: `distance_km >= 15` → `long`
- Dashboard: `totalDistance >= 15` → `long`
- Science: "Long run (>15 km or >90 min)" → 2.0 multiplier

**Examples:**
- 18 km run → `long` → 2580 kcal ✅
- 20 km run → `long` → 2580 kcal ✅
- 21 km (half marathon) → `long` → 2580 kcal ✅

### 2. Regular Run (5-10 km, < 60 min)

**Classification:** `easy` or `moderate`  
**Activity Factor:** 1.6 (easy) or 1.8 (moderate)  
**Aligned?** ✅ YES

**Implementation:**
- Edge function:
  - `duration < 60 min` → `easy` (1.6)
  - `duration >= 60 min` → `moderate` (1.8)
- Dashboard:
  - `duration < 45 min` → `easy`
  - `duration >= 45 min AND distance >= 8 km` → `moderate`

**Examples:**
- 5 km / 40 min run → `easy` → 2580 kcal (1613 × 1.6) ✅
- 10 km / 70 min run → `moderate` → 2903 kcal (1613 × 1.8) ✅
- 8 km / 50 min run → `moderate` → 2903 kcal ✅

### 3. Interval/Quality Sessions

**Classification:** `quality`  
**Activity Factor:** 2.1  
**Aligned?** ⚠️ **PARTIALLY**

**Implementation:**
- Edge function:
  - `intensity === 'high'` → `quality` ✅
- Dashboard:
  - `intensity === 'high'` → `quality` ✅
  - `duration >= 60 AND distance >= 10` → `quality` ⚠️

**Issue Found:**
The Dashboard has additional logic that classifies runs as `quality` based on duration/distance:
```typescript
if (hasHighIntensity || (totalDuration >= 60 && totalDistance >= 10)) return 'quality';
```

This means a **10 km / 60 min run** (6:00 min/km pace) would be classified as `quality` even if it's NOT high intensity. This is incorrect for easy-paced longer runs.

**Examples:**
- 5 km interval session (intensity: high) → `quality` → 3387 kcal (1613 × 2.1) ✅
- 10 km tempo run (intensity: high) → `quality` → 3387 kcal ✅
- 10 km easy run / 70 min (intensity: moderate) → Should be `moderate` but Dashboard may classify as `quality` ❌

### Science Layer Definitions

From nutrition explainer and science specs:

**Easy:**
- Light running
- Recovery pace
- < 60 minutes or < 8 km

**Moderate:**
- Steady-state running
- Comfortable pace
- 60+ minutes or 8+ km
- Not high intensity

**Long:**
- Extended duration
- Distance ≥ 15 km
- Duration > 90 minutes
- Volume emphasis

**Quality:**
- High intensity
- Tempo runs
- Interval training
- Hill workouts
- Race-pace efforts

## Issues Identified

### 1. Quality Classification Overlap (Dashboard)

**Problem:**
```typescript
if (hasHighIntensity || (totalDuration >= 60 && totalDistance >= 10)) return 'quality';
```

**Why It's Wrong:**
- A 10 km easy run in 70 minutes (7:00 min/km pace) is NOT quality
- This pace is slower than marathon pace for most runners
- Should be classified as `moderate`, not `quality`

**Impact:**
- Overestimates calories for easy long runs
- User might eat 3387 kcal instead of 2903 kcal (484 kcal surplus!)
- Could lead to weight gain for easy-paced runners

**Fix:**
Remove the duration/distance condition from quality classification. Only use intensity:

```typescript
if (hasHighIntensity) return 'quality';
if (totalDistance >= 15) return 'long';
if (totalDuration >= 60 && totalDistance >= 10) return 'moderate'; // Move here
```

### 2. Edge Function is Correct

The edge function in `nutrition-unified.ts` is **correct**:
```typescript
if (a.distance_km >= 15) return 'long';
if (a.intensity === 'high') return 'quality';
if (a.duration_minutes >= 60) return 'moderate';
return 'easy';
```

This properly uses intensity to determine quality sessions.

## Recommendations

### Fix Dashboard Training Load Logic

**Current (incorrect):**
```typescript
if (totalDistance >= 15) return 'long';
if (hasHighIntensity || (totalDuration >= 60 && totalDistance >= 10)) return 'quality';
if (totalDuration >= 45 || totalDistance >= 8) return 'moderate';
```

**Recommended (correct):**
```typescript
if (totalDistance >= 15) return 'long';
if (hasHighIntensity) return 'quality'; // Only intensity-based
if (totalDuration >= 60 || totalDistance >= 10) return 'moderate';
if (totalDuration >= 30 || totalDistance >= 5) return 'easy';
```

### Updated Classification Rules

| Condition | Load | Rationale |
|-----------|------|-----------|
| `distance >= 15 km` | LONG | Volume priority |
| `intensity === 'high'` | QUALITY | Intensity priority |
| `duration >= 60 min OR distance >= 10 km` | MODERATE | Sustained effort |
| `duration >= 30 min OR distance >= 5 km` | EASY | Light activity |
| `activity < 15 min AND distance < 2 km` | REST | Minimal activity |

### Testing Scenarios

After fix, verify these classifications:

| Activity | Expected Load | Current (Dashboard) | After Fix |
|----------|---------------|---------------------|-----------|
| 5 km easy / 35 min | EASY | ✅ EASY | ✅ EASY |
| 10 km easy / 70 min | MODERATE | ❌ QUALITY | ✅ MODERATE |
| 10 km tempo / 50 min (high intensity) | QUALITY | ✅ QUALITY | ✅ QUALITY |
| 15 km long / 90 min | LONG | ✅ LONG | ✅ LONG |
| 18 km long / 120 min | LONG | ✅ LONG | ✅ LONG |
| 5 km intervals (high intensity) | QUALITY | ✅ QUALITY | ✅ QUALITY |
| 8 km moderate / 50 min | MODERATE | ✅ MODERATE | ✅ MODERATE |

## Conclusion

### What's Aligned ✅

1. **Long runs:** Correctly classified at ≥15 km
2. **Easy runs:** Correctly classified for short runs
3. **Intensity-based quality:** High intensity correctly triggers quality
4. **Edge function:** Fully aligned with science layer

### What Needs Fixing ⚠️

1. **Dashboard quality logic:** Remove duration/distance condition for quality
2. **Quality should ONLY be intensity-based** (tempo, intervals, hills)
3. **Long easy runs:** Should be moderate or long, not quality

### Priority

**Medium Priority** - Only affects Dashboard display for users doing 10+ km easy runs at slow pace. Edge functions (meal generation, scoring) use correct logic.

**Files to Update:**
- `src/components/Dashboard.tsx` lines 630-631

**Impact if Fixed:**
- More accurate calorie targets for easy long runs
- Better nutritional guidance for recreational runners
- Prevents overfeeding on easy days
