# Score 92 Baseline - Quick Reference

## 🔴 THE PROBLEM

**Users with ZERO data get scores of 85-96**, same as users with excellent nutrition.

## 🎯 Root Cause

**File:** `src/lib/unified-scoring.ts:168`

```typescript
function calculateMacroScore(actual: number, target: number): number {
  if (target <= 0) return 100;  // ⚠️ Zero target = Perfect score!
  // ...
}
```

When there's **no meal plan** (target = 0), the system returns **100 (perfect)** for all macros.

## 📊 Score Breakdown (No Data)

| Component | Logic | Score |
|-----------|-------|-------|
| **Macros** | 0/0 = perfect | **100** ⚠️ |
| **Timing** | Not applicable = perfect | **100** ⚠️ |
| **Structure** | No meals logged | **0** ✅ |
| **Nutrition Total** | 100×50% + 100×35% + 0×15% | **85** |
| **Training** | 0/0 = complete | **60** ⚠️ |
| **Final (Rest Day)** | 85×100% + 60×0% | **85** |
| **+ Bonuses** | +7 typical | **92** ⭐ |

## 🐛 Why This Happens

1. **Macro scoring:** `if (target <= 0) return 100`
   - No meal plan → target = 0
   - Returns perfect score (100)
   - Even with zero food logged!

2. **Timing scoring:** All windows default to 100 when not applicable
   - Rest days → all windows inactive
   - Returns perfect score (100)

3. **Training scoring:** `if (planned === 0 && actual === 0) return 100`
   - No plan + no activity → considered "complete"
   - Returns perfect score (100)

4. **Only structure penalizes:** Missing meals only cost 15% of score
   - 0 meals → structure = 0
   - But macros (50%) and timing (35%) already at 100!
   - Net result: 85/100

5. **Bonuses applied:** Even with no data
   - Window sync: +5
   - Hydration: +2
   - Total: +7
   - Final: 85 + 7 = **92**

## 📈 Score by Data Completeness

| Data Available | Score |
|----------------|-------|
| Nothing | **85** |
| Nothing + bonuses | **92** ⭐ |
| 1 meal logged (no plan) | **89** |
| 2 meals logged (no plan) | **93** |
| 3 meals logged (no plan) | **96** |
| Perfect nutrition | **100** |

**Problem:** Can't distinguish "no data" from "good nutrition"!

## ✅ Solutions

### Immediate Fix (Option B)
Add incomplete data penalty:

```typescript
let penalty = 0;
if (target.calories <= 0) penalty -= 30;  // No meal plan
if (actual.calories <= 0) penalty -= 30;  // No food logs
if (mealsLogged === 0) penalty -= 20;     // No meals

finalScore = baseScore + bonuses + penalty;
// Result: 85 - 80 = 5 ⭐ Much better!
```

### Better Fix (Option A)
Return null when data is insufficient:

```typescript
if (target <= 0 && actual <= 0) return null;

// UI shows:
// "Daily Score: --"
// "⚠️ No data available"
// "Log your meals to see your score!"
```

### Best Fix (Long-term)
Use default targets as fallback:

```typescript
const DEFAULT = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
const effectiveTarget = target > 0 ? target : DEFAULT[macroType];

// Now 0 actual vs 2000 target → error = 100% → score = 0
```

## 🎯 Key Insights

### Science Layer Issues

1. **Macros (50% weight):**
   - ❌ Zero targets return 100
   - ✅ Should return 0 or null

2. **Timing (35% weight):**
   - ❌ Not applicable returns 100
   - ✅ Should return neutral (50) or null

3. **Structure (15% weight):**
   - ✅ Correctly returns 0 for no meals
   - ⚠️ But only 15% weight, can't offset other 85%

4. **Training:**
   - ❌ No plan + no activity = 100
   - ✅ Should return null or require minimum data

### Weighting Problem

Even if structure = 0, the score is still high because:
```
Nutrition = (Macros × 50%) + (Timing × 35%) + (Structure × 15%)
          = (100 × 0.50) + (100 × 0.35) + (0 × 0.15)
          = 50 + 35 + 0
          = 85  ⚠️ Still high!
```

Structure only contributes **15%**, so it can't penalize enough.

## 📁 Files Affected

### Scoring Logic
- `src/lib/unified-scoring.ts` - Main issue (line 168)
- `src/science/dailyScore.ts` - Legacy, same issue
- `src/services/unified-score.service.ts` - Calls scoring logic

### Database
- `nutrition_scores` - Caches the wrong scores
- `daily_meal_plans` - Provides targets (works correctly)
- `food_logs` - Provides actuals (works correctly)

## 🧪 Quick Test

```bash
# Test current behavior
node -e "
function score(t, a) { return t <= 0 ? 100 : (Math.abs(a-t)/t <= 0.05 ? 100 : 0); }
console.log('Score with zero data:', score(0, 0));  // 100 ⚠️
console.log('Score with target:', score(2000, 0));   // 0 ✅
"
```

## 🔗 Related Docs

- `SCORE_92_DETAILED_ANALYSIS.md` - Full analysis
- `SCORE_92_FLOW_DIAGRAM.md` - Visual diagrams
- `DEBUG_SCORE_92.md` - Cache issue (separate)
- `SCORE_92_ROOT_CAUSE.md` - Cache issue (separate)

## 📝 Action Items

- [ ] **P1:** Implement incomplete data penalty (-60 pts)
- [ ] **P1:** Add data completeness indicator to UI
- [ ] **P2:** Return null scores when data insufficient
- [ ] **P2:** Add cache invalidation strategy
- [ ] **P3:** Use default targets as fallback
- [ ] **P3:** Redesign scoring weights (reduce macros/timing, increase structure)

## 💡 Bottom Line

The **92 baseline** is caused by:
1. Zero targets returning perfect scores (100)
2. Missing data defaulting to perfect scores (100)
3. Only 15% of score penalizing missing meals

**This is a fundamental design flaw, not a cache issue.**

Users are rewarded with 85-96 scores for doing absolutely nothing. The fix requires changing the scoring algorithm to handle missing data properly.

---

**Last Updated:** October 13, 2025  
**Severity:** 🔴 Critical - Undermines entire scoring system  
**Priority:** P1 - Immediate fix required
