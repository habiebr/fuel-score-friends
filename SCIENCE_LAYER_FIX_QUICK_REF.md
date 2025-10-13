# Science Layer Fix - Quick Reference

## The Fix in 3 Sentences

1. **Meal plans are now treated as a CACHE, not a requirement**
2. **Science layer (BMR/TDEE) calculates targets on-the-fly when meal plan missing**
3. **Scores now reflect actual eating behavior, not whether meal plan exists in database**

---

## Code Changes

### `unified-score.service.ts`
```typescript
if (hasMealPlan) {
  nutritionTargets = /* from database */;
} else {
  // SCIENCE LAYER FALLBACK
  const tdee = calculateTDEE(userProfile, inferredLoad);
  const macros = calculateMacros(userProfile, inferredLoad, tdee);
  nutritionTargets = { calories: tdee, ... };
}
```

### `unified-scoring.ts`
```typescript
// REMOVED: -30 point penalty for missing meal plan
// UPDATED: reliability = hasFoodLogs && mealsLogged > 0
```

### `IncompleteProfileAlert.tsx`
```typescript
// REMOVED: hasMealPlan prop and "Meal Plan Missing" warning
```

---

## Score Matrix

| Has Body Metrics? | Has Meal Plan? | Ate Food? | Old | New |
|-------------------|----------------|-----------|-----|-----|
| ❌ No | - | - | 92 | 0 |
| ✅ Yes | ❌ No | ❌ No | 92 | 0-20 |
| ✅ Yes | ❌ No | ✅ Yes | 92 | 60-90 |
| ✅ Yes | ✅ Yes | ✅ Yes | 95 | 95 |

---

## Data Hierarchy

```
Body Metrics → Science Layer → Targets (calculated or cached) → Food Logs → Score
   ↑              ↑                    ↑                            ↑
Required    Always works      Optional cache            User behavior
```

---

## Testing

```bash
# User with only body metrics
# Expected: score = 0, message = "Log Your First Meal"

# User with metrics + ate 2000 kcal (TDEE = 2500)
# Expected: score = 70-80, no warnings

# User deletes meal plan
# Expected: still works (science layer fallback)
```

---

**Result: Meal plan is now optional. Science layer is the source of truth.** ✅
