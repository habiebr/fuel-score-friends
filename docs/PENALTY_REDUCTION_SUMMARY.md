# Penalty Reduction Implementation Summary

**Deployed:** ✅ Live on beta.nutrisync.id

## What Was Changed

### 1. Made Penalties Configurable
- Created two penalty profiles: `reduced` (default) and `strict` (legacy)
- Easy to switch between profiles by changing one constant
- Old strict values preserved for easy recall

### 2. Reduced Activity Penalties by ~60%
| Penalty | Old Value | New Value | Change |
|---------|-----------|----------|--------|
| Hard underfuel | -5 | -2 | -60% |
| Big deficit | -10 | -5 | -50% |
| Missed post-window | -3 | -1 | -67% |
| **Max combined** | **-15** | **-8** | **-47%** |

### 3. Disabled Structured Meals Penalty
- **Old value**: -10 points if user logged food but not in structured meals
- **New value**: 0 points (penalty disabled)
- This prevents penalizing users who are just logging food naturally without meal structure

### 4. Reduced Data Completeness Penalty by 50%
| Penalty | Old Value | New Value | Change |
|---------|-----------|----------|--------|
| No food logs | -30 | -15 | -50% |

### 5. Implemented in Both Frontend and Backend
- **Frontend**: `src/lib/unified-scoring.ts`
- **Backend**: `supabase/functions/recalculate-scores/index.ts`
- Both use the same penalty configuration for consistency

## Expected Impact

### Score Improvements
- **Average score increase**: +8 to +12 points
- **Typical day example**:
  - Before: 70 base score → **55/100** (with -15 penalties)
  - After: 70 base score → **62/100** (with -8 penalties)
- **Best case**: Score increases of up to +20 points for users with multiple penalty triggers

### User Experience
- ✅ Less punitive, more encouraging
- ✅ Still provides feedback signals for critical issues
- ✅ Maintains accountability for important behaviors (overconsumption, no data)
- ✅ Easier to achieve higher scores while still maintaining quality standards

## How to Switch Between Profiles

### Current: Reduced Severity (Default)
```typescript
const ACTIVE_PENALTY_PROFILE: 'reduced' | 'strict' = 'reduced';
```

### To Recall Strict Penalties
```typescript
const ACTIVE_PENALTY_PROFILE: 'reduced' | 'strict' = 'strict';
```

Switch this constant in both files:
1. `src/lib/unified-scoring.ts` (line 174)
2. `supabase/functions/recalculate-scores/index.ts` (line 99)

Then rebuild and redeploy.

## Files Modified

1. **src/lib/unified-scoring.ts**
   - Added PENALTY_PROFILES configuration
   - Updated calculateModifiers() to use configurable penalties
   - Updated incomplete data penalty logic

2. **supabase/functions/recalculate-scores/index.ts**
   - Added matching PENALTY_PROFILES configuration
   - Updated penalty calculations

3. **docs/PENALTY_ASSESSMENT.md**
   - Added implementation status and instructions

## Next Steps

- Monitor user engagement and score distributions
- Gather user feedback on the new scoring system
- Consider making the profile switchable via UI/admin panel if needed
- Track if the reduced penalties maintain the desired behavior signals

