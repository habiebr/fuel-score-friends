# Calorie Adjustment Based on Training Plan - Test Results

## ✅ CONFIRMED: Calories DO Change with Training Plans!

Date: October 11, 2025
Test File: `tests/calorie-training-adjustment.test.ts`
All 13 tests PASSED ✅

---

## Key Findings

### 1. Activity Factor Multipliers by Training Load

The system uses **different activity factors** to multiply BMR based on the training plan:

```
Training Load    Activity Factor    Multiplier
─────────────────────────────────────────────
Rest Day         1.4x BMR          Baseline
Easy Run         1.6x BMR          +14% vs Rest
Moderate Run     1.8x BMR          +29% vs Rest
Long Run         2.0x BMR          +43% vs Rest
Quality Run      2.1x BMR          +50% vs Rest
```

### 2. Real Calorie Changes (70kg Runner Example)

**Base Metabolic Rate (BMR):** 1,649 kcal/day

**Total Daily Energy Expenditure (TDEE) by Training Load:**

| Day Type | TDEE | Increase from Rest Day |
|----------|------|------------------------|
| **Rest Day** | 2,310 kcal | Baseline |
| **Easy Run** | 2,640 kcal | +330 kcal (+14%) |
| **Moderate Run** | 2,970 kcal | +660 kcal (+29%) |
| **Long Run** | 3,300 kcal | +990 kcal (+43%) |
| **Quality Run** | 3,460 kcal | +1,150 kcal (+50%) |

### 3. Carbohydrate Needs Scale with Training

**Carb targets per kg body weight:**

```
Rest Day:     3.5 g/kg  →  245g for 70kg runner
Easy Run:     5.5 g/kg  →  385g for 70kg runner
Moderate Run: 7.0 g/kg  →  490g for 70kg runner
Long Run:     9.0 g/kg  →  630g for 70kg runner
Quality Run:  8.0 g/kg  →  560g for 70kg runner
```

**From Rest to Long Run: +385g carbs (+157% increase!)**

---

## Complete Macro Breakdown Examples

### REST DAY (70kg runner)
```
Calories: 2,310 kcal
Carbs:    245g  (980 kcal = 42%)
Protein:  112g  (448 kcal = 19%)
Fat:      98g   (882 kcal = 38%)
```

### LONG RUN DAY (70kg runner)
```
Calories: 3,300 kcal  (+990 kcal from rest day)
Carbs:    630g  (2,520 kcal = 76%)
Protein:  133g  (532 kcal = 16%)
Fat:      73g   (657 kcal = 20%)
```

**Notice:** On a long run day, you need **76% carbs** vs only 42% on a rest day!

---

## Real Training Week Example

**Typical Marathon Training Week (70kg runner):**

```
Day | Training     | Calories
─────────────────────────────
Mon | Easy Run     | 2,640 kcal
Tue | Moderate Run | 2,970 kcal
Wed | Easy Run     | 2,640 kcal
Thu | Rest         | 2,310 kcal
Fri | Quality Run  | 3,460 kcal
Sat | Easy Run     | 2,640 kcal
Sun | Long Run     | 3,300 kcal
─────────────────────────────
TOTAL              | 19,960 kcal/week
DAILY AVG          | 2,851 kcal/day
```

**Comparison:**
- If every day was a rest day: 16,170 kcal/week
- With training plan: 19,960 kcal/week
- **Extra calories needed: +3,790 kcal/week**
- **That's +541 kcal/day on average**

---

## Real-World Examples

### 60kg Female Runner - Long Run Day

```
Rest Day:    1,860 kcal
Long Run:    2,660 kcal  (+800 kcal)
Carbs:       540g (9 g/kg body weight)
Protein:     114g (1.9 g/kg body weight)
```

### 80kg Male Runner - Quality Run Day

```
Rest Day:    2,460 kcal
Quality Run: 3,690 kcal  (+1,230 kcal!)
Carbs:       640g (8 g/kg body weight)
Protein:     152g (1.9 g/kg body weight)
```

---

## How It Works: The Calculation Chain

```
1. Calculate BMR (Basal Metabolic Rate)
   └─ Uses Mifflin-St Jeor equation
      Formula: (10 × weight) + (6.25 × height) - (5 × age) + 5 (male)

2. Determine Training Load
   └─ Based on planned workout: rest, easy, moderate, long, quality

3. Get Activity Factor
   └─ Each training load has a specific multiplier (1.4x to 2.1x)

4. Calculate TDEE (Total Daily Energy Expenditure)
   └─ TDEE = BMR × Activity Factor
   └─ Rounded to nearest 10 kcal

5. Calculate Macronutrient Targets
   └─ Carbs: Based on g/kg body weight (varies by training load)
   └─ Protein: Based on g/kg body weight (slightly increases with load)
   └─ Fat: Fills remaining calories (minimum 20% of TDEE)

6. Distribute Across Meals
   └─ Breakfast, Lunch, Dinner, Snack (if training day)
   └─ Includes fueling windows (pre/during/post workout)
```

---

## Code Implementation

The calorie adjustment is implemented in:

**Primary Files:**
- `src/lib/marathon-nutrition.ts`
- `src/lib/nutrition-engine.ts`
- `supabase/functions/_shared/nutrition-unified.ts`

**Key Functions:**
```typescript
calculateBMR(profile)           // Returns baseline metabolic rate
getActivityFactor(load)         // Returns 1.4-2.1x multiplier
calculateTDEE(profile, load)    // Returns total daily calories
getMacroTargetsPerKg(load)      // Returns carb/protein g/kg targets
calculateMacros(profile, load, tdee)  // Returns complete macro breakdown
```

---

## Verification Results

### ✅ All Tests Passing (13/13)

1. ✅ BMR calculation correct
2. ✅ Activity factors vary by training load
3. ✅ TDEE changes with training load
4. ✅ Significant calorie difference between rest and long run
5. ✅ Carb targets adjust based on training intensity
6. ✅ Carb increase from rest to long run (157%)
7. ✅ Complete macros for rest day (42% carbs)
8. ✅ Complete macros for long run day (76% carbs)
9. ✅ All training loads compared side by side
10. ✅ Calories increase proportionally with intensity
11. ✅ Practical training week calorie differences
12. ✅ 60kg female runner example
13. ✅ 80kg male runner example

---

## Summary

### Question: "Do calories change if there is a training plan?"

### Answer: **YES! Absolutely!**

The system automatically adjusts calorie targets based on your training plan for the day:

- **Rest Day:** Baseline calories (BMR × 1.4)
- **Easy Run:** +14% more calories
- **Moderate Run:** +29% more calories  
- **Long Run:** +43% more calories
- **Quality Run:** +50% more calories

**Example:** A 70kg runner needs:
- **2,310 kcal** on a rest day
- **3,300 kcal** on a long run day
- **That's almost 1,000 extra calories!**

The system also automatically increases carbohydrate targets (from 3.5g/kg on rest days to 9g/kg on long runs) and adjusts protein slightly to support training load.

**This is exactly how sports nutrition should work!** 🎯

---

## Test Command

To run these tests yourself:

```bash
npm test -- calorie-training-adjustment.test.ts --run
```

All tests will show detailed output with real numbers and comparisons.
