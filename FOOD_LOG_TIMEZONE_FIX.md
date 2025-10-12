# Food Log Timezone Fix - October 13, 2025

## Issue
Food logs were showing on the wrong day in the diary/history view. For example, a food logged on Sunday would appear under Saturday.

## Root Cause

In `src/pages/Meals.tsx` line 220, the code was using simple string slicing to extract the date from timestamps:

```typescript
// ❌ BEFORE - WRONG
const day = (log.logged_at || '').slice(0, 10);
```

### Why This Failed:

1. **Database Storage**: Food logs are stored with UTC timestamps
   - Example: Sunday 1:00 AM WIB (Indonesian time) = Saturday 18:00 PM UTC
   - Stored as: `2025-10-12T18:00:00Z` (Saturday in UTC)

2. **String Slicing**: The `.slice(0, 10)` just takes the first 10 characters
   - Takes: `2025-10-12` from `2025-10-12T18:00:00Z`
   - Result: Shows food on **Saturday** (wrong!)
   - Should be: **Sunday** (when user actually logged it)

3. **Timezone Conversion Missing**: No conversion from UTC to local time

## Solution

Changed to use proper date conversion that accounts for timezone:

```typescript
// ✅ AFTER - CORRECT
const day = format(new Date(log.logged_at), 'yyyy-MM-dd');
```

### How This Works:

1. `new Date(log.logged_at)` - Creates Date object from UTC timestamp
2. Date object automatically converts to browser's local timezone
3. `format(..., 'yyyy-MM-dd')` - Extracts date in **local timezone**

### Example:
- Stored: `2025-10-12T18:00:00Z` (Saturday 18:00 UTC)
- Local time: Sunday 01:00 WIB (UTC+7)
- Extracted date: `2025-10-13` ✅ (Sunday - correct!)

## Files Changed

### Fixed:
- ✅ `src/pages/Meals.tsx` (line 220) - Weekly diary grouping

### Already Correct:
- ✅ `src/pages/MealHistory.tsx` (line 92) - Using `format(new Date(...), 'yyyy-MM-dd')`
- ✅ `src/components/WeeklyNutritionTrends.tsx` (line 52) - Using `format(new Date(...), 'yyyy-MM-dd')`
- ✅ `src/components/MealTimeline.tsx` - Using timezone utilities

## Testing

After deploying, verify:

1. **Log a food today** (Sunday, October 13, 2025)
2. **Go to Meals → History tab**
3. **Check the weekly view**
4. **Food should appear under Sunday**, not Saturday

## Technical Details

### Date-fns `format()` Function
```typescript
import { format } from 'date-fns';

// This respects the Date object's timezone
const date = new Date('2025-10-12T18:00:00Z'); // UTC timestamp
const local = format(date, 'yyyy-MM-dd'); // '2025-10-13' in WIB
```

### Why This Pattern Works
- `new Date()` in JavaScript is timezone-aware
- It stores the timestamp internally but displays in local time
- `format()` from date-fns uses the Date object's local representation
- This automatically handles all timezone conversions

## Related Files

- `src/lib/timezone.ts` - Timezone utility functions
- `TIMEZONE_FIX_SUMMARY.md` - Previous timezone fixes

## Deployment

- **Commit**: `699dfb1`
- **Deployed**: https://e656b371.nutrisync-beta.pages.dev
- **Date**: October 13, 2025

## Prevention

Going forward, **NEVER use string slicing** for extracting dates from timestamps:

```typescript
// ❌ NEVER DO THIS
const date = timestamp.slice(0, 10);
const date = timestamp.substring(0, 10);
const date = timestamp.split('T')[0];

// ✅ ALWAYS DO THIS
const date = format(new Date(timestamp), 'yyyy-MM-dd');
```

Or use the timezone utilities:

```typescript
import { utcToLocalDateString } from '@/lib/timezone';

const date = utcToLocalDateString(timestamp);
```

## Summary

The issue was a simple but critical mistake: extracting dates from UTC timestamps without converting to local timezone first. This is now fixed and food logs will appear on the correct day in the diary.
