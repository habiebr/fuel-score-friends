# Penalty Assessment & Impact Analysis

**Status: IMPLEMENTED** ✅

The penalty system has been updated to use **reduced severity** by default, with the ability to recall **strict penalties** if needed.

## Implementation Summary

### What Changed
- **Configurable penalty system** with two profiles: `reduced` (default) and `strict` (legacy)
- **Easy recall**: Switch between profiles by changing one constant
- **Structured meals penalty**: DISABLED in reduced profile
- **Activity penalties**: Reduced by ~60%
- **Data penalties**: Reduced by ~50%

### How to Switch Between Profiles

In `src/lib/unified-scoring.ts` and `supabase/functions/recalculate-scores/index.ts`:

```typescript
// Switch penalty profile here: 'reduced' or 'strict'
const ACTIVE_PENALTY_PROFILE: 'reduced' | 'strict' = 'reduced';
```

Change `'reduced'` to `'strict'` to recall the old strict penalties.

---

## Current Penalty System

### Penalty Categories

1. **Activity-Based Penalties** (max -15 points)
   - Hard underfuel (-5): Quality/Long run day with <80% target carbs
   - Big deficit (-10): Large calorie deficit + workout ≥90 min
   - Missed post-window (-3): Didn't consume post-workout recovery fuel
   - **Maximum combined: -15 points**

2. **Overconsumption Penalties** (strategy-dependent)
   - Runner-focused: -10 points (if >115% of target calories)
   - General: -5 points (if >110% of target calories)
   - Meal-level: -3 points (if >110% of target calories)

3. **Data Completeness Penalties**
   - No food logs: -30 points
   - No structured meals: -10 points (when food is logged but not in meals)

### Maximum Impact

**Worst case scenario:**
- Base score: 75
- Penalties: -15 (activity) + -10 (overconsumption) + -30 (no logs) = **-55 points**
- **Final score: 20/100** 😢

**Typical scenario:**
- Base score: 70
- Penalties: -10 (big deficit) + -5 (overconsumption) = **-15 points**
- **Final score: 55/100** 😕

## Impact of Disabling Penalties

If we **disable all penalties**, typical scores would:

- **Without penalties**: 70 → **70/100** ✅
- **With penalties**: 70 → 55/100 ❌

**Average increase: +10 to +20 points** depending on user behavior

## Recommendation: Reduce, Don't Eliminate

### Option 1: Reduce Penalty Severity (Recommended)

```typescript
// Current penalties
const penalties = {
  hardUnderfuel: -5,
  bigDeficit: -10,
  missedPostWindow: -3,
  maxCombined: -15
};

// Reduced severity
const penalties = {
  hardUnderfuel: -2,        // Reduced from -5
  bigDeficit: -5,           // Reduced from -10
  missedPostWindow: -1,     // Reduced from -3
  maxCombined: -8          // Reduced from -15
};
```

**Impact:** Users get +5 to +10 points on average

### Option 2: Reduce Data Completeness Penalties

Keep data logging penalties (important for engagement) but reduce:
- No food logs: -30 → **-15** (50% reduction)
- No structured meals: -10 → **-5** (50% reduction)

### Option 3: Remove Only Activity Penalties

Keep data completeness and overconsumption, but remove:
- Hard underfuel penalty
- Big deficit penalty
- Missed post-window penalty

**Impact:** Users get +5 to +15 points depending on training load

### Option 4: Make Penalties Optional

Add a user preference or admin setting to enable/disable penalties

## Recommendation

**Implement Option 1 + Partial Option 2:**
1. Reduce activity penalties by ~60%
2. Reduce data completeness penalties by ~50%
3. Keep overconsumption penalties (already moderate)

This makes scoring **less punitive** while still providing **feedback signals** for important behaviors.

### Expected Impact

- Average score increase: **+8 to +12 points**
- Better user experience and engagement
- Still maintains behavior signal for critical issues (overconsumption, no data)

