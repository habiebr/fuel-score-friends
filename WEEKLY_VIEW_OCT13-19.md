# Demo Account - Weekly View (Mon Oct 13 - Sun Oct 19) ✅

**Date:** October 14, 2025  
**Status:** ✅ COMPLETED

---

## 📅 Date Range Update

Changed from backwards-looking (past 7 days) to **weekly calendar view**:
- **Start:** Monday, October 13, 2025
- **End:** Sunday, October 19, 2025
- **Total:** 7 days (full week)

This matches the "OCT 13 - OCT 19" range shown in your Weekly Food Diary screenshot!

---

## 📊 Complete Weekly Schedule

### Monday, October 13 (Yesterday)
**Training:** 🏃‍♂️ Long Run - 22km at marathon pace (120 min)
- **Meals:** 15 logged (extra snacks for recovery)
- **Calories:** 3,910 kcal (HIGHEST - recovery day)
- **Protein:** 215g
- **Carbs:** 492g
- **Fat:** 114g
- **Score:** 82% (Excellent)
- **Wearable:** 28,500 steps, 1,450 cal burned, HR avg 145

### Tuesday, October 14 (Today)
**Training:** Easy Recovery Run - 5km (30 min)
- **Meals:** 13 logged
- **Calories:** 3,530 kcal
- **Protein:** 206g
- **Carbs:** 462g
- **Fat:** 110g
- **Score:** 88% (Excellent)
- **Wearable:** 12,500 steps, 520 cal burned, HR avg 138

### Wednesday, October 15 (Tomorrow)
**Training:** Easy Run - 7km (40 min)
- **Meals:** 13 logged
- **Calories:** 3,530 kcal
- **Protein:** 184g
- **Carbs:** 408g
- **Fat:** 102g
- **Score:** 75% (Good)
- **Wearable:** 13,200 steps, 580 cal burned, HR avg 140

### Thursday, October 16
**Training:** 🔥 Tempo Run - 12km at 4:50/km pace (60 min)
- **Meals:** 15 logged (extra snacks for hard training)
- **Calories:** 3,910 kcal (HIGH)
- **Protein:** 192g
- **Carbs:** 428g
- **Fat:** 104g
- **Score:** 72% (Good)
- **Wearable:** 15,200 steps, 780 cal burned, HR avg 155

### Friday, October 17
**Training:** 😴 Rest Day - Active recovery stretching
- **Meals:** 10 logged (reduced intake)
- **Calories:** 2,950 kcal (LOWEST)
- **Protein:** 172g
- **Carbs:** 378g
- **Fat:** 94g
- **Score:** 85% (Excellent)
- **Wearable:** 3,200 steps, 1,800 cal burned, HR avg 65

### Saturday, October 18
**Training:** 🔥 Intervals - 8x800m strong finish (50 min)
- **Meals:** 15 logged (extra snacks for hard training)
- **Calories:** 3,910 kcal (HIGH)
- **Protein:** 198g
- **Carbs:** 436g
- **Fat:** 106g
- **Score:** 79% (Good)
- **Wearable:** 14,500 steps, 780 cal burned, HR avg 155

### Sunday, October 19
**Training:** Easy Run - 8.5km morning run (45 min)
- **Meals:** 13 logged
- **Calories:** 3,530 kcal
- **Protein:** 188g
- **Carbs:** 414g
- **Fat:** 104g
- **Score:** 80% (Excellent)
- **Wearable:** 12,800 steps, 620 cal burned, HR avg 138

---

## 📊 Weekly Summary

### Training Load
- **Total Distance:** 75.5 km
- **Total Duration:** 365 minutes (6 hours 5 min)
- **Total Calories Burned:** 5,510 kcal
- **Rest Days:** 1 (Friday)
- **Easy Runs:** 3 days
- **Hard Training:** 3 days (long run, tempo, intervals)

### Nutrition
- **Total Calories:** 25,270 kcal over 7 days
- **Average/Day:** 3,610 kcal
- **Range:** 2,950 - 3,910 kcal
- **Total Meals:** 94 logged
- **Average/Day:** 13.4 meals
- **Average Score:** 80% (Excellent overall)

### Calorie Distribution
- **Rest Day (Fri):** 2,950 kcal (10 meals)
- **Easy Run Days (Tue, Wed, Sun):** 3,530 kcal (13 meals)
- **Hard Training Days (Mon, Thu, Sat):** 3,910 kcal (15 meals)

---

## 🔧 Technical Changes

### Modified Functions

1. **`createFoodLogs()`**
   ```javascript
   // Changed from: for (let daysAgo = 0; daysAgo <= 6; daysAgo++)
   // Changed to: for (let daysOffset = -1; daysOffset <= 5; daysOffset++)
   // Creates logs from Mon (yesterday, -1) to Sun (future, +5)
   ```

2. **`createTrainingActivities()`**
   ```javascript
   // Reordered activities to match new week:
   // -1 (Mon): Long run 22km
   // 0 (Tue): Easy recovery 5km
   // +1 (Wed): Easy 7km
   // +2 (Thu): Tempo 12km
   // +3 (Fri): Rest
   // +4 (Sat): Intervals 10km
   // +5 (Sun): Easy 8.5km
   ```

3. **`createNutritionScores()`**
   ```javascript
   // Updated scores to match new date range
   // Each day aligned with corresponding training load
   ```

4. **`createWearableData()`**
   ```javascript
   // Updated wearable data to match new date range
   // Steps, calories, heart rate aligned with training activities
   ```

### New Utility Script

**`clear-all-demo-data.mjs`**
- Deletes all existing training activities, food logs, nutrition scores, meal plans, and wearable data
- Essential for clean repopulation with new date range

---

## ✅ Verification

Run this command to check the distribution:
```bash
node check-food-distribution.mjs
```

**Expected Output:**
```
📅 Found 7 days with food logs:

TODAY        Sun 2025-10-19    (3,530 kcal, 13 meals)
YESTERDAY    Sat 2025-10-18    (3,910 kcal, 15 meals)
Day -2       Fri 2025-10-17    (2,950 kcal, 10 meals)
Day -3       Thu 2025-10-16    (3,910 kcal, 15 meals)
Day -4       Wed 2025-10-15    (3,530 kcal, 13 meals)
Day -5       Tue 2025-10-14    (3,530 kcal, 13 meals)
Day -6       Mon 2025-10-13    (3,910 kcal, 15 meals)

✅ Perfect! Food logs are distributed across 7 days!
```

---

## 🎯 Result

Your Weekly Food Diary will now show:

**Header:** `OCT 13 - OCT 19` ✅

**Days:**
- **Mon:** 3910 kcal (Long run recovery)
- **Tue:** 3530 kcal (Easy recovery)
- **Wed:** 3530 kcal (Easy run)
- **Thu:** 3910 kcal (Tempo run)
- **Fri:** 2950 kcal (Rest day)
- **Sat:** 3910 kcal (Intervals)
- **Sun:** 3530 kcal (Easy run)

All data perfectly distributed across the full week from Monday to Sunday! 📅

---

**Demo Account:** demo@nutrisync.id / Demo2025!  
**Timezone:** Australia/Melbourne (UTC+11)  
**Week:** Mon Oct 13 - Sun Oct 19, 2025
