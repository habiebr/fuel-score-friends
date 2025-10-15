# Demo Account - Melbourne Timezone Fix ✅

**Date:** October 14, 2025  
**Status:** ✅ COMPLETED

---

## 🐛 Problem

Food logs were clustering on only 3 days (Monday 4280 kcal, Tuesday 4220 kcal, Wednesday 1940 kcal) instead of being evenly distributed across 7 days.

**Root Cause:** Timezone conversion issues
- Script was using Jakarta timezone (UTC+7) 
- User is in Melbourne timezone (UTC+11, AEDT)
- Date/time calculations were converting to UTC, causing meals to "spill" across day boundaries

---

## ✅ Solution

### 1. Updated Profile Timezone
Changed from `Asia/Jakarta` to `Australia/Melbourne`:
```javascript
timezone: 'Australia/Melbourne',
goal_name: 'Melbourne Marathon 2025',
```

### 2. Fixed Date/Time Generation Functions
**Problem:** Using `.toISOString()` converts to UTC, which shifts dates
```javascript
// BEFORE (WRONG)
date.toISOString() 
// "2025-10-14T07:30:00" Melbourne → "2025-10-13T20:30:00" UTC ❌
```

**Solution:** Use local date strings without timezone conversion
```javascript
// AFTER (CORRECT)
function getDateTime(daysAgo = 0, time = '12:00:00') {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${time}`;
}
```

This creates timestamps like `2025-10-14T07:30:00` which Postgres/Supabase interprets in the user's timezone.

---

## 📊 Final Result

### Perfect 7-Day Distribution ✅

| Day | Date | Meals | Calories | Training |
|-----|------|-------|----------|----------|
| **TODAY** | Tue Oct 14 | 13 | 3,530 kcal | Easy recovery run (5km) |
| **YESTERDAY** | Mon Oct 13 | 15 | 3,910 kcal | Long run (22km) 🏃‍♂️ |
| **Day -2** | Sun Oct 12 | 13 | 3,530 kcal | Easy run (7km) |
| **Day -3** | Sat Oct 11 | 15 | 3,910 kcal | Intervals (10km) 🔥 |
| **Day -4** | Fri Oct 10 | 10 | 2,950 kcal | Rest day 😴 |
| **Day -5** | Thu Oct 9 | 15 | 3,910 kcal | Tempo run (12km) 🔥 |
| **Day -6** | Wed Oct 8 | 13 | 3,530 kcal | Easy run (8.5km) |

**Total:** 94 meals across 7 days  
**Average:** 3,610 kcal/day  

---

## 🎯 Calorie Distribution Logic

### Rest Day (Fri Oct 10): 2,950 kcal
- Skip evening snack completely
- Skip breakfast toast
- **10 meals** (reduced intake)

### Easy Run Days: 3,530 kcal
- All standard meals included
- **13 meals** (moderate intake)
- Days: Today, Day -2, Day -6

### Hard Training Days: 3,910 kcal
- Standard meals + **extra snacks**
- Morning snack: Energy bar (220 kcal)
- Pre-dinner: Rice cakes with honey (160 kcal)
- **15 meals** (high intake for recovery)
- Days: Yesterday (long run), Day -3 (intervals), Day -5 (tempo)

---

## 🔧 Technical Changes

### Files Modified
1. **`create-demo-account.mjs`**
   - Updated `getDate()` function - local date without timezone conversion
   - Updated `getDateTime()` function - returns `YYYY-MM-DDTHH:MM:SS` format
   - Changed profile timezone: `Australia/Melbourne`
   - Changed goal name: `Melbourne Marathon 2025`

2. **`update-demo-timezone.mjs`** (new)
   - Script to update existing profile timezone

3. **`check-food-distribution.mjs`** (new)
   - Utility to verify food logs are properly distributed
   - Shows meals and calories per day

---

## ✅ Verification Commands

### Check Distribution
```bash
node check-food-distribution.mjs
```

**Expected Output:**
```
✅ Perfect! Food logs are distributed across 7 days!
Total days:     7 days
Total meals:    94 logged
Average/day:    3,610 kcal
```

### Full Calorie Breakdown
```bash
node verify-demo-calories.mjs
```

---

## 📝 Lessons Learned

1. **Always consider user timezone** when creating demo data
2. **Avoid `.toISOString()`** for user-facing timestamps - it converts to UTC
3. **Use local date strings** (`YYYY-MM-DDTHH:MM:SS`) for databases with timezone support
4. **Test with actual timezone** - don't assume all users are in one timezone

---

## 🎉 Result

The demo account now works perfectly in **Melbourne timezone (AEDT, UTC+11)**:

✅ Food logs evenly distributed across 7 days  
✅ Realistic calorie intake (2,950-3,910 kcal/day)  
✅ Training-responsive eating patterns  
✅ Proper meal frequency (10-15 meals/day)  
✅ No timezone conversion issues  

**The Weekly Food Diary will now show proper data on all 7 days!** 📅

---

**Demo Account:** demo@nutrisync.id / Demo2025!  
**Timezone:** Australia/Melbourne (UTC+11)  
**Login:** https://app.nutrisync.id
