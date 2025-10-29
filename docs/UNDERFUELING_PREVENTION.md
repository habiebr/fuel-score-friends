# Underfueling Prevention - Science Layer Safeguards

**Status:** ✅ IMPLEMENTED & TESTED

## The Issue

The science layer had a **potential underfueling risk** where calculated macros could sum to less than TDEE due to rounding errors. This would cause users to receive insufficient calories, especially on training days.

## The Root Cause

### Example (Easy Training Day):
- **TDEE**: 2640 kcal
- **CHO**: 385g × 4 = **1540 kcal**
- **Protein**: 119g × 4 = **476 kcal**
- **Subtotal**: 2016 kcal
- **Remaining**: 2640 - 2016 = **624 kcal**
- **Min fat (20%)**: 528 kcal
- **Fat chosen**: 624 kcal
- **Fat grams**: 69g × 9 = **621 kcal** (rounding down)
- **Total**: 1540 + 476 + 621 = **2637 kcal** ❌ (3 kcal short of TDEE)

The issue was **rounding errors** in gram-to-calorie conversions combined with not ensuring totals met TDEE.

## The Fix

### Before:
```typescript
const fatGrams = Math.round(fatKcal / 9);
// Could result in total < TDEE due to rounding down
```

### After:
```typescript
let fatKcal = Math.max(minFatKcal, remainingKcal);

// Calculate total to check for underfueling
const totalKcal = choKcal + proteinKcal + fatKcal;

// CRITICAL: If total is less than TDEE, add more fat to prevent underfueling
if (totalKcal < tdee) {
  const deficit = tdee - totalKcal;
  fatKcal += deficit;
}

// Use ceiling to prevent underfueling from rounding down
const fatGrams = Math.ceil(fatKcal / 9);
```

## Safeguards Implemented

### 1. **Deficit Detection**
```typescript
if (totalKcal < tdee) {
  const deficit = tdee - totalKcal;
  fatKcal += deficit;
}
```
Ensures total calories always meet or exceed TDEE.

### 2. **Ceiling Rounding for Fat**
```typescript
const fatGrams = Math.ceil(fatKcal / 9);
```
Prevents underfueling from rounding fat grams down.

### 3. **Minimum Fat Requirement**
```typescript
const minFatKcal = tdee * 0.2; // Minimum 20% of TDEE
```
Ensures adequate fat intake for hormonal health.

## Test Results

✅ All training loads now meet or exceed TDEE:
- **Rest day**: 2310 kcal target → 2310 kcal total ✅
- **Easy day**: 2640 kcal target → 2646 kcal total ✅ (6 kcal over)
- **Moderate day**: 2970 kcal target → 3058 kcal total ✅
- **Long day**: 3300 kcal target → 3718 kcal total ✅
- **Quality day**: 3465 kcal target → 3470 kcal total ✅

✅ Carb targets exceed minimums:
- Long runs: 630g CHO (≥ 7g/kg recommendation) ✅
- Quality workouts: 560g CHO (≥ 7g/kg recommendation) ✅

✅ Protein targets exceed minimums:
- Quality workouts: 133g protein (≥ 1.6g/kg recommendation) ✅

## Why Some Days Are "Over"

On **long run days**, carb targets (8-10g/kg) can exceed what TDEE can accommodate in the standard macro calculation. This is **intentional and correct** because:

1. **Long runs need massive glycogen stores** (9g CHO/kg = 630g for 70kg person)
2. **This exceeds "daily" calorie math** but is physiologically necessary
3. **Users should prioritize carbs on long run days** over exact calorie matching
4. **The system ensures they won't be underfueled** - better to be slightly over

### Example: Long Run Day (70kg person)
- **TDEE**: 3300 kcal
- **Target CHO**: 9g/kg × 70kg = **630g** (2520 kcal)
- **Target protein**: 1.9g/kg × 70kg = **133g** (532 kcal)
- **Min fat**: 3300 × 0.2 = **660 kcal** (73g fat)
- **Total**: 2520 + 532 + 660 = **3712 kcal** (~12% over TDEE)

**Why this is correct:**
- Marathon runners need 8-12g CHO/kg for glycogen supercompensation
- Better to be slightly over than risk bonking on a 20+ mile run
- Fat minimum (20%) is maintained for hormonal health
- Protein is adequate for recovery

## Files Modified

1. **`src/lib/nutrition-engine.ts`** - Added underfueling safeguards
2. **`src/lib/marathon-nutrition.ts`** - Added underfueling safeguards
3. **`src/lib/__tests__/nutrition-validation.test.ts`** - Created validation tests

## User Impact

✅ **No underfueling**: Users following suggestions will always meet TDEE minimum  
✅ **Adequate carbs**: Long/hard days provide sufficient glycogen fuel  
✅ **Adequate protein**: Recovery needs are met for all training loads  
✅ **Adequate fat**: Minimum 20% ensures hormonal health  

## Next Steps

1. Deploy to production after testing
2. Monitor user energy levels and feedback
3. Consider adding user feedback loop for "energy levels" post-run
4. Document in user-facing materials the intentional slight overage on long days

