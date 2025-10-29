# User-Determined Activity Types Analysis

**Date:** October 13, 2025  
**Question:** Does the system consider user's explicit "long_run" designation when calculating nutrition?

## Current System Analysis

### How Users Plan Training

In the **Goals/Training Plan** page (`Goals.tsx`), users can select:

| UI Option | Database Stored As | Auto-Set Parameters |
|-----------|-------------------|---------------------|
| **Long Run** | `activity_type: 'run'` | `distance >= 15 km`, `duration >= 90 min`, `intensity: moderate` |
| **Interval** | `activity_type: 'run'` | `distance >= 5 km`, `duration >= 45 min`, `intensity: high` |
| **Run** | `activity_type: 'run'` | `distance >= 4 km`, `duration >= 30 min`, `intensity: moderate` |
| **Strength** | `activity_type: 'strength'` | `duration = 45 min`, `intensity: moderate` |
| **Rest** | `activity_type: 'rest'` | `duration = 0`, `distance = null` |

### Database Schema

```sql
CREATE TABLE training_activities (
  activity_type TEXT NOT NULL, -- 'rest', 'run', 'strength', 'cardio', 'other'
  duration_minutes INTEGER NOT NULL,
  distance_km NUMERIC(5,2),
  intensity TEXT NOT NULL -- 'low', 'moderate', 'high'
);
```

**Key Finding:** User's "Long Run" selection is NOT stored in the database! It's only used to pre-fill distance/duration/intensity values.

## Problem: Loss of User Intent 🚨

### What Happens:

1. **User selects "Long Run"** in training planner
2. **System converts to:**
   - `activity_type: 'run'` (generic)
   - `distance_km: 15+`
   - `duration_minutes: 90+`
   - `intensity: 'moderate'`

3. **Classification reads from database:**
   ```typescript
   if (distance_km >= 15) return 'long';
   if (intensity === 'high') return 'quality';
   if (duration_minutes >= 60) return 'moderate';
   ```

4. **Result:** ✅ Works correctly IF user keeps default values

### Edge Cases Where It Fails:

#### Case 1: User Overrides Long Run Distance
**Scenario:** User selects "Long Run" but changes distance to 12 km (maybe they're building up gradually)

**Expected:** Should be treated as "long" (user's intent)  
**Actual:** Classified as "moderate" (duration 90 min triggers moderate, not long)  
**Impact:** Gets 2903 kcal instead of 3226 kcal

#### Case 2: User Plans Short Long Run
**Scenario:** User selects "Long Run" with 14 km (just under 15 km threshold)

**Expected:** "long" (user explicitly said it's a long run)  
**Actual:** "moderate" (14 km < 15 km threshold)  
**Impact:** Underestimates calories for their long run day

#### Case 3: User's Regular Run Exceeds 15 km
**Scenario:** User selects "Run" but adds 16 km distance

**Expected:** "easy" or "moderate" (user considers it regular pace)  
**Actual:** "long" (automatic classification based on distance)  
**Impact:** Overestimates calories if it's an easy-paced run

## Current Classification Logic

### Dashboard (`Dashboard.tsx`)

```typescript
const determineTrainingLoad = async () => {
  // Reads from training_activities table
  const { data: plannedActivities } = await supabase
    .from('training_activities')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today);
  
  // Classification based on PARAMETERS ONLY
  if (totalDistance >= 15) return 'long';
  if (hasHighIntensity) return 'quality';
  if (totalDuration >= 60 || totalDistance >= 10) return 'moderate';
  if (totalDuration >= 30 || totalDistance >= 5) return 'easy';
  return 'rest';
};
```

**Issue:** Only looks at distance/duration/intensity, NOT user's original activity type selection.

### Edge Function (`nutrition-unified.ts`)

```typescript
export function aggregateActivitiesToLoad(activities): TrainingLoad {
  const classify = (a: any): TrainingLoad => {
    if (a.activity_type === 'run') {
      if (a.distance_km >= 15) return 'long';
      if (a.intensity === 'high') return 'quality';
      if (a.duration_minutes >= 60) return 'moderate';
      return 'easy';
    }
    // ...
  };
}
```

**Same Issue:** Only parameter-based, ignores user's activity type designation.

## Recommended Solutions

### Option 1: Store User's Activity Designation (Recommended)

**Change Database Schema:**
```sql
ALTER TABLE training_activities 
ADD COLUMN user_activity_label TEXT; -- 'long_run', 'interval', 'regular_run', etc.
```

**Update Classification Logic:**
```typescript
const classify = (a: any): TrainingLoad => {
  if (a.activity_type === 'run') {
    // Priority 1: User's explicit designation
    if (a.user_activity_label === 'long_run') return 'long';
    if (a.user_activity_label === 'interval') return 'quality';
    
    // Priority 2: Automatic classification (fallback)
    if (a.distance_km >= 15) return 'long';
    if (a.intensity === 'high') return 'quality';
    if (a.duration_minutes >= 60) return 'moderate';
    return 'easy';
  }
};
```

**Pros:**
- ✅ Respects user intent
- ✅ Allows flexible training (12 km long run OK)
- ✅ User knows their effort level best
- ✅ Prevents misclassification

**Cons:**
- ⚠️ Requires database migration
- ⚠️ Need to update training planner UI
- ⚠️ Need to educate users on proper selection

### Option 2: Smarter Thresholds with Tolerance

**Keep current system but add flexibility:**
```typescript
const classify = (a: any): TrainingLoad => {
  if (a.activity_type === 'run') {
    // Long run: >= 15 km OR (>= 12 km AND >= 90 min)
    if (a.distance_km >= 15 || (a.distance_km >= 12 && a.duration_minutes >= 90)) {
      return 'long';
    }
    
    if (a.intensity === 'high') return 'quality';
    if (a.duration_minutes >= 60) return 'moderate';
    return 'easy';
  }
};
```

**Pros:**
- ✅ No schema changes needed
- ✅ Catches most edge cases
- ✅ Based on typical running patterns

**Cons:**
- ⚠️ Still doesn't capture true user intent
- ⚠️ Arbitrary threshold choices

### Option 3: Use Duration + Distance Combined

**Long run detection:**
```typescript
// Long run = sustained effort over distance
const isLongRun = (distance_km >= 15) || 
                  (distance_km >= 12 && duration_minutes >= 80) ||
                  (duration_minutes >= 100);
```

**Pros:**
- ✅ More nuanced classification
- ✅ Accounts for slower runners

**Cons:**
- ⚠️ Complex rules
- ⚠️ Still guessing user intent

## Comparison with Current Fix

### What We Fixed Earlier:
```typescript
// Removed incorrect quality classification
if (hasHighIntensity) return 'quality'; // ✅ Now intensity-based only
```

### What Still Needs Attention:
```typescript
// Long run threshold might be too strict
if (totalDistance >= 15) return 'long'; // ⚠️ Ignores user's "long run" selection at 12-14 km
```

## Real-World Examples

### Example 1: Progressive Training
**User:** Building up to first half-marathon  
**Week 8:** Selects "Long Run" with 12 km (not ready for 15 km yet)

**Current System:**
- Stores: `activity_type: 'run'`, `distance: 12 km`, `duration: 85 min`
- Classifies as: `moderate` (2903 kcal)
- User's intent: This IS their long run for the week!
- Should get: `long` (3226 kcal) ❌

**With User Label:**
- Stores: `user_activity_label: 'long_run'`
- Classifies as: `long` (3226 kcal) ✅

### Example 2: Experienced Runner Easy Long Run
**User:** Marathon training, doing easy long run  
**Plan:** 18 km at very easy pace

**Current System:**
- Stores: Selects "Long Run", gets `distance: 18 km`
- Classifies as: `long` (3226 kcal) ✅
- Works correctly!

### Example 3: Interval Session
**User:** Selects "Interval" with 8 km workout

**Current System:**
- Stores: `intensity: 'high'`, `distance: 8 km`
- Classifies as: `quality` (3387 kcal) ✅
- Works correctly because intensity is preserved!

## Recommendation

### Short-term (Current State): ✅ ACCEPTABLE

The current system works well for:
- ✅ Long runs ≥ 15 km
- ✅ Intervals (intensity-based)
- ✅ Regular runs (distance/duration-based)

**Minor issues:**
- Long runs 12-14 km might be underestimated
- But users can manually adjust distance to 15 km if needed

### Medium-term: Consider Adding user_activity_label

If you see user complaints about:
- "My long run shows wrong calories"
- "I selected long run but got moderate calories"

Then implement Option 1 (store user's activity label).

### Long-term: AI-Assisted Classification

Learn from user patterns:
- If user consistently marks 12 km runs as "long run"
- System learns their personal threshold is 12 km, not 15 km
- Personalized classification per user

## Summary

### Question: Is user's "long_run" selection considered?

**Answer:** ❌ **NO** - User's selection is converted to parameters (distance/duration/intensity), then those parameters are used for classification.

### Impact:

**Low Impact for Most Users:**
- ✅ System auto-fills appropriate distance/duration when user selects "Long Run"
- ✅ If user keeps defaults (15+ km), classification works correctly
- ✅ Interval sessions work well (intensity is preserved)

**Medium Impact for Edge Cases:**
- ⚠️ Users building up distance (12-14 km long runs)
- ⚠️ Users who override default distances
- ⚠️ Non-standard training approaches

### Current Fix Priority:

**Priority 1 (DONE):** ✅ Fixed quality classification (intensity-based only)  
**Priority 2 (Current):** ⚠️ Consider storing user activity labels  
**Priority 3 (Future):** 📊 Personalized thresholds per user

---

**Conclusion:** The system works well for standard cases but doesn't preserve user's explicit activity type designation. For better accuracy, consider storing the user's selected activity label alongside the parameters.
