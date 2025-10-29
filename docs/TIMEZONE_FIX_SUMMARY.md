# Timezone Fix Summary

## Problem
Food logs were showing up on the wrong day because the application was using hardcoded UTC timestamps (e.g., `${today}T00:00:00`) when querying and storing data, without accounting for the user's local timezone.

## Solution Implemented

### 1. Created Timezone Utility Library
**File:** `src/lib/timezone.ts`

This provides helper functions to:
- `getLocalDayBoundaries(date)` - Get start/end of a day in user's local timezone
- `getLocalDateString(date)` - Get YYYY-MM-DD in local timezone
- `getDateRangeForQuery(dateString)` - Convert date string to proper query range

### 2. Fixed Food Log Storage
**File:** `src/components/FoodTrackerDialog.tsx`

- Now explicitly sets `logged_at` timestamp when creating food logs
- Uses `new Date().toISOString()` which captures the current local time properly

### 3. Fixed Food Log Queries

#### Updated Files:
- **`src/pages/Meals.tsx`**
  - Changed from hardcoded `${today}T00:00:00` to using `getLocalDayBoundaries()`
  - Now properly filters food logs by user's local day

- **`src/components/CachedDashboard.tsx`**
  - Updated to use timezone utilities for food log queries

## Files Still Need fixing:

The following components still use hardcoded UTC timestamps and should be updated:

1. `src/components/CaloriesWidget.tsx` - line 46
2. `src/components/MealTimeline.tsx` - line 100
3. `src/components/TrainingNutritionWidget.tsx` - line 244
4. `src/components/DailyNutritionSummary.tsx` - line 79
5. `src/components/RunnerNutritionDashboard.tsx` - line 75
6. `src/components/CachedWidget.tsx` - lines 155, 188
7. `src/components/Dashboard.tsx` - line 525
8. `src/components/CombinedNutritionWidget.tsx` - line 80
9. `src/components/HydrationTracker.tsx` - line 49

## How to Apply the Fix

For each file, replace:
```typescript
const today = format(new Date(), 'yyyy-MM-dd');
.gte('logged_at', `${today}T00:00:00`)
.lt('logged_at', `${today}T23:59:59.999`)
```

With:
```typescript
import { getLocalDayBoundaries, getLocalDateString } from '@/lib/timezone';

const { start, end } = getLocalDayBoundaries(new Date());
.gte('logged_at', start)
.lte('logged_at', end)
```

## Testing
After deploying:
1. Log a food item at 11:30 PM local time
2. Verify it appears in today's list, not tomorrow's
3. Test across different timezones if possible

## Benefits
- Food logs appear on the correct day for all users regardless of timezone
- Consistent behavior across all time zones
- Uses browser's local time, which is what users expect
