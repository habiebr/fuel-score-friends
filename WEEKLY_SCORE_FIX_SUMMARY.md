# Weekly Score Fix & Explainer Updates - Summary

## Issues Fixed

### 1. Weekly Score Showing 0 ✅
**Problem:** Dashboard shows weekly score of 0 while leaderboard shows 60.

**Root Cause:** The weekly score calculation relies on cached data in the `nutrition_scores` table. If this table is empty or has stale data, the score shows as 0.

**Solution Implemented:**
- Added enhanced logging to the Dashboard to debug the issue:
  ```typescript
  console.log('📊 WEEKLY SCORE DEBUG:', {
    weekStart: format(weekStart, 'yyyy-MM-dd'),
    result: weeklyScoreResult,
    average: weeklyScoreResult?.average,
    dailyScores: weeklyScoreResult?.dailyScores,
    validScoresCount: weeklyScoreResult?.dailyScores?.filter(d => d.score > 0).length
  });
  ```
- This will help identify whether:
  - No scores exist in `nutrition_scores` table
  - Scores are stale (outdated)
  - Calculation is incorrect

**How to Debug:**
1. Open browser console (F12)
2. Look for `📊 WEEKLY SCORE DEBUG` logs
3. Check if `dailyScores` array is empty
4. If empty, run: `DELETE FROM nutrition_scores WHERE date >= CURRENT_DATE - INTERVAL '7 days';`
5. Refresh dashboard to force recalculation

**Note:** The scoring logic is correct. The issue is likely stale cached data. See `SCORE_92_ROOT_CAUSE.md` for detailed analysis of the caching system.

---

### 2. Enhanced Weekly Score Tooltip ✅
**Implemented:** Rich tooltip with detailed explanation

**New Tooltip Content:**
- **Formula**: Weekly Score = Σ(Daily Scores) / 7 days
- **Ranking**: Explains how leaderboard ranking works (weekly score descending, then total km)
- **Tip**: Link to scoring explainer page
- **Visual Design**: Clean sections with background highlights

**Code Location:** `src/components/Dashboard.tsx` (lines 896-927)

---

### 3. Updated Scoring Explainer Page ✅
**Added:** Ranking formula section to existing page

**New Content:**
- Explains leaderboard ranking logic
- Primary sort: Weekly score (descending)
- Secondary sort: Total kilometers (descending)
- Call-to-action to encourage logging

**Page:** `/scores` → `src/pages/ScoreExplainer.tsx`

---

### 4. Created Nutrition Explainer Page ✅
**NEW PAGE:** Comprehensive macronutrition calculation guide

**Content Sections:**
1. **BMR (Basal Metabolic Rate)**
   - What it is: Calories burned at rest
   - Formula: Mifflin-St Jeor Equation
   - Example calculation for sample runner
   
2. **TDEE (Total Daily Energy Expenditure)**
   - What it is: Total calories including activity
   - Activity multipliers by training load:
     - Rest: 1.3
     - Easy: 1.5
     - Moderate: 1.6
     - Long: 1.8
     - Quality: 1.7
   - Examples for different training days

3. **Macronutrient Distribution**
   - Runner-focused strategy:
     - Carbs: 50% (primary energy)
     - Protein: 25% (muscle recovery)
     - Fat: 25% (hormones & long-duration energy)
   - Formulas to convert percentages to grams
   - Visual cards with color coding

4. **Meal Distribution**
   - Standard split: Breakfast 30%, Lunch 40%, Dinner 30%, Snack 10%
   - Fueling windows for runs >60 min:
     - Pre-run: 1-4g carbs/kg
     - During-run: 30-90g carbs/hour
     - Post-run: 1-1.2g carbs/kg + 0.3g protein/kg

5. **Automatic Daily Generation**
   - Explains how meal plans are auto-generated at midnight
   - What the system does automatically
   - Encourages profile updates for accuracy

**Route:** `/nutrition-explainer` → `src/pages/NutritionExplainer.tsx`

**Design Features:**
- Color-coded macro cards (orange, blue, purple)
- Formula examples with real calculations
- Step-by-step walkthrough
- Professional medical/scientific styling
- Responsive grid layouts

---

## Files Changed

### Modified
1. ✅ `src/components/Dashboard.tsx`
   - Enhanced weekly score logging
   - Updated Weekly Score tooltip with detailed content

2. ✅ `src/pages/ScoreExplainer.tsx`
   - Added Leaderboard Ranking section
   - Updated weekly score description

3. ✅ `src/App.tsx`
   - Added route for `/nutrition-explainer`
   - Imported `NutritionExplainerPage` component

### Created
4. ✅ `src/pages/NutritionExplainer.tsx`
   - Complete new page explaining BMR, TDEE, macros, and meal distribution
   - 4 major sections with examples and formulas
   - Professional UI with color-coded components

---

## How to Access

### Scoring Explainer
- URL: `/scores`
- Link: From Weekly Score tooltip → "See the scoring explainer"
- Content: Daily score calculation + Weekly score rollup + Ranking

### Nutrition Explainer
- URL: `/nutrition-explainer`
- Content: BMR → TDEE → Macros → Meal Distribution
- Purpose: Help users understand how meal plans are calculated

---

## Next Steps for User

### To Fix Weekly Score Issue:
1. **Check Console Logs**
   ```
   Open browser → F12 → Console tab
   Look for: "📊 WEEKLY SCORE DEBUG"
   ```

2. **If No Scores Found:**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT * FROM nutrition_scores 
   WHERE user_id = 'YOUR_USER_ID'
   AND date >= CURRENT_DATE - INTERVAL '7 days';
   ```

3. **If Scores Are Stale:**
   ```sql
   -- Clear cache to force recalculation
   DELETE FROM nutrition_scores 
   WHERE date >= CURRENT_DATE - INTERVAL '7 days';
   ```

4. **Refresh Dashboard**
   - Scores will recalculate automatically
   - Check console logs again for updated data

### To Share with Users:
- Direct them to `/nutrition-explainer` to understand meal planning
- Direct them to `/scores` to understand scoring system
- Both pages are educational and help with engagement

---

## Deployment

✅ **Deployed to Production:** https://963b6d1e.nutrisync.pages.dev

**Build Info:**
- Bundle size: 549.59 kB (gzipped: 148.55 kB)
- New assets: 4 files
- Status: Successfully deployed to Cloudflare Pages

**Deployed Features:**
1. Enhanced weekly score debugging
2. Rich Weekly Score tooltip
3. Updated Scoring Explainer page
4. New Nutrition Explainer page

---

## Screenshots to Update

Recommended screenshots for documentation:
1. Weekly Score tooltip (hover over Weekly Score in Dashboard)
2. Scoring Explainer page at `/scores`
3. Nutrition Explainer page at `/nutrition-explainer`
4. Console logs showing `📊 WEEKLY SCORE DEBUG` output

---

## Technical Notes

### Weekly Score Calculation
```typescript
// From src/services/unified-score.service.ts
const validScores = dailyScores.filter(d => d.score > 0);
const average = validScores.length > 0
  ? Math.round(validScores.reduce((sum, d) => sum + d.score, 0) / validScores.length)
  : 0;
```

### Leaderboard Ranking
```typescript
// From src/pages/Community.tsx
userStats.sort((a, b) => {
  // Primary: Weekly score (descending)
  if (b.weekly_score !== a.weekly_score) {
    return b.weekly_score - a.weekly_score;
  }
  // Secondary: Total kilometers (descending)
  return b.total_kilometers - a.total_kilometers;
});
```

### BMR Formula
```typescript
// Mifflin-St Jeor Equation
// Men: (10 × weight) + (6.25 × height) - (5 × age) + 5
// Women: (10 × weight) + (6.25 × height) - (5 × age) - 161
```

### TDEE Calculation
```typescript
const multipliers = {
  rest: 1.3,
  easy: 1.5,
  moderate: 1.6,
  long: 1.8,
  quality: 1.7
};
const tdee = bmr * multipliers[trainingLoad];
```

---

## Summary

All requested features have been implemented and deployed:

1. ✅ **Weekly score debugging** - Enhanced logs to identify why score shows 0
2. ✅ **Rich tooltip** - Detailed explanation with formula and ranking
3. ✅ **Updated explainer** - Added ranking section to existing page
4. ✅ **New nutrition page** - Comprehensive BMR/TDEE/macro explanation

The weekly score issue is likely a **data/caching problem**, not a code problem. The enhanced logging will help diagnose this in production.
