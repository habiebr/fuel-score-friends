# Score Calculation Review

## Summary
I've reviewed the daily and weekly score calculation functions. Here's what I found:

## ✅ Daily Score Calculation - CORRECT

### Implementation Files:
1. **`src/science/dailyScore.ts`** - Legacy formula
2. **`src/lib/unified-scoring.ts`** - New unified system (currently in use)

### Formula Alignment:
Both implementations follow the same core formula structure:

#### Daily Score Formula:
```
Daily Score = (Nutrition Score × wN) + (Training Score × wT) + Bonuses + Penalties
```

Where weights (wN, wT) vary by training load:
- **Rest**: `wN=1.0, wT=0.0` ✅
- **Easy**: `wN=0.7, wT=0.3` ✅
- **Moderate**: `wN=0.6, wT=0.4` ✅
- **Long**: `wN=0.55, wT=0.45` ✅
- **Quality**: `wN=0.6, wT=0.4` ✅

#### Nutrition Score (50% macros, 35% timing, 15% structure):
```
Nutrition = (Macros × 0.50) + (Timing × 0.35) + (Structure × 0.15)
```

**Macros Score** (piecewise function):
- ±5% error: 100 points ✅
- ±10% error: 60 points ✅
- ±20% error: 20 points ✅
- >20% error: 0 points ✅

Macro weights (runner-focused):
- Calories: 30% ✅
- Carbs: 40% ✅
- Protein: 20% ✅
- Fat: 10% ✅

**Timing Score** (pre 40%, during 40%, post 20%):
- Pre-workout: 100 if ≥80% of target carbs in window, else 0 ✅
- During: Linear scale between ±10g (100pts) and ±30g (0pts) ✅
- Post-workout: 100 if ≥80% of both carbs AND protein in window, else 0 ✅

**Structure Score**:
- Breakfast: 25 points ✅
- Lunch: 25 points ✅
- Dinner: 25 points ✅
- Snack: 25 points (if training day) ✅
- Penalty: Max 70 if single meal >60% of calories ✅

#### Training Score (60% completion, 25% type match, 15% intensity):
```
Training = (Completion × 0.60) + (Type Match × 0.25) + (Intensity × 0.15)
```

**Completion**:
- 90-110% of planned duration: 100 points ✅
- 75-125% of planned duration: 60 points ✅
- Otherwise: 0 points ✅

**Type Match**:
- Same activity family: 100 points ✅
- Different: 0 points ✅

**Intensity** (if HR available):
- Within target zone: 100 points ✅
- Near target zone: 60 points ✅
- Otherwise: 0 points ✅
- *Note: If HR unavailable, weight redistributed to completion (75% total)* ✅

#### Bonuses (max +10):
- All fueling windows synced: +5 ✅
- Streak days: +1 per day (max +5) ✅
- Hydration target met: +2 ✅

#### Penalties (max -15):
- Hard day + underfueled (<80% carbs): -5 ✅
- Big calorie deficit (>500) on 90+ min session: -10 ✅
- Missed post-workout window: -3 ✅

#### Overconsumption Penalty:
- >115% of calorie target: -10 points ✅

**Final score is clamped to [0, 100]** ✅

---

## ⚠️ Weekly Score Calculation - INCONSISTENCY FOUND!

### The Problem:
There are **two different implementations** with **different behaviors**:

### 1. Legacy Function (`src/science/dailyScore.ts`):
```typescript
export function weeklyScore(scores: number[]): number {
  return scores.slice(0, 7).reduce((s, v) => s + Math.max(0, Math.min(100, Math.round(v))), 0);
}
```
**This SUMS the scores** (returns 0-700 range) ❌

### 2. Current Implementation (`src/services/unified-score.service.ts`):
```typescript
export async function getWeeklyScoreFromCache(...) {
  const validScores = dailyScores.filter(d => d.score > 0);
  const average = validScores.length > 0
    ? Math.round(validScores.reduce((sum, d) => sum + d.score, 0) / validScores.length)
    : 0;
  return { average, dailyScores };
}
```
**This AVERAGES the scores** (returns 0-100 range) ✅

### 3. Leaderboard Function (`getAllUsersWeeklyScoresFromCache`):
```typescript
const validScores = dailyScores.filter(d => d.score > 0);
const weeklyScore = validScores.length > 0
  ? Math.round(validScores.reduce((sum, d) => sum + d.score, 0) / validScores.length)
  : 0;
```
**This also AVERAGES** ✅

---

## Issues Found:

### 1. **Missing Function Reference** (Critical Bug)
In `src/services/unified-score.service.ts` line 408:
```typescript
export async function getWeeklyScorePersisted(userId: string): Promise<{...}> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  
  return getWeeklyUnifiedScore(userId, weekStart, 'runner-focused');  // ❌ FUNCTION DOESN'T EXIST
}
```

**This function `getWeeklyUnifiedScore` is never defined!** This will cause runtime errors.

**Fix:** Should use `getWeeklyScoreFromCache` instead:
```typescript
return getWeeklyScoreFromCache(userId, weekStart);
```

### 2. **Unused Legacy Function**
The `weeklyScore()` function in `dailyScore.ts` is the old formula that sums scores. It's still in the codebase but:
- ✅ Not currently being used in production code
- ⚠️ Should be removed or documented as deprecated to avoid confusion

---

## Recommendations:

### High Priority:
1. **Fix the undefined function bug** in `getWeeklyScorePersisted`
2. **Remove or mark as deprecated** the legacy `weeklyScore` sum function

### Medium Priority:
3. **Document the weekly scoring approach** - clarify that it's a 7-day average of valid daily scores
4. **Add unit tests** for weekly score calculation edge cases:
   - Week with some missing days
   - Week with all zeros
   - Week with mix of valid and zero scores

### Low Priority:
5. Consider adding a weekly bonus for consistency (e.g., bonus if all 7 days have scores)

---

## Correct Weekly Score Formula:

**Current (Correct) Implementation:**
```
Weekly Score = Average of valid daily scores (excluding zeros and missing days)
            = Σ(daily_scores where score > 0) / count(valid days)
            Range: 0-100
```

**Legacy (Incorrect) Implementation:**
```
Weekly Score = Sum of daily scores (capped at 100 each)
            = Σ(min(100, daily_score))
            Range: 0-700  ❌ WRONG
```

---

## Code Quality:

✅ **Daily calculations are linear to the formula** - all component scores are calculated correctly with proper weights
✅ **Proper piecewise functions** for macro scoring
✅ **Correct weight distributions** by training load
✅ **Bonuses and penalties** properly capped and applied
✅ **Final score clamping** to [0, 100] range

⚠️ **Weekly calculation has a bug** - undefined function reference
⚠️ **Legacy code exists** - old sum-based weekly function still in codebase
