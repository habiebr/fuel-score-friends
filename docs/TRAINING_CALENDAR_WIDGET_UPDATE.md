# Training Calendar Widget Logic Update

**Date:** October 12, 2025  
**Status:** ✅ IMPLEMENTED

## Change Summary

Updated the Training Calendar page to properly separate **actual activity detection** (top widget) from **weekly planning view** (bottom calendar).

## Before vs After

### ❌ Before
- Top widget **always shown** regardless of actual activity
- Showed "Planned Training" even when no actual data existed
- Confusing UX - two widgets showing similar information

### ✅ After
- Top widget **only appears when Google Fit activity is detected for today**
- Weekly view below shows planned activities that get replaced when actual data comes in
- Clear separation: Actual (top) vs Plan (bottom)

## Implementation

### Updated: `src/pages/TrainingCalendar.tsx`

**Logic Added:**
```typescript
{/* Today's Training Widget - Only show when actual Google Fit activity is detected */}
{(() => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayActivities = activitiesByDate[today] || [];
  const hasActualActivityToday = todayActivities.some(a => a.is_actual);
  
  // Only render the widget if there's actual activity detected for today
  return hasActualActivityToday ? (
    <div className="mb-6">
      <TrainingNutritionWidget
        selectedDate={new Date()}
        activities={Object.values(activitiesByDate).flat()}
        tomorrowActivities={activitiesByDate[format(addDays(new Date(), 1), 'yyyy-MM-dd')] || []}
      />
    </div>
  ) : null;
})()}
```

## User Experience Flow

### Scenario 1: No Activity Yet (Morning)
```
┌─────────────────────────────────┐
│  Training Calendar              │
│  Weekly view of your training   │
├─────────────────────────────────┤
│  [Prev] [Next]                  │
├─────────────────────────────────┤
│                                 │ ← NO TOP WIDGET
│  Week of 10/06 - 10/12         │
│                                 │
│  DAY 1 - Monday                 │
│  Rest day — keep nutrition on   │
│  point.                         │
│                                 │
│  DAY 2 - Tuesday                │
│  🏃 Run - 5 km - moderate       │ ← PLANNED
│                                 │
└─────────────────────────────────┘
```

### Scenario 2: After Workout (Google Fit Synced)
```
┌─────────────────────────────────┐
│  Training Calendar              │
│  Weekly view of your training   │
├─────────────────────────────────┤
│  [Prev] [Next]                  │
├─────────────────────────────────┤
│  ⚡ Actual Training ✓ Completed│ ← TOP WIDGET APPEARS
│  Run                            │
│  72 min  621 kcal              │
│  moderate intensity             │
├─────────────────────────────────┤
│  Week of 10/06 - 10/12         │
│                                 │
│  DAY 1 - Monday                 │
│  Rest day — keep nutrition on   │
│  point.                         │
│                                 │
│  DAY 2 - Tuesday  [Actual Data]│
│  ✅ Run - 72 min - 621 kcal    │ ← REPLACED WITH ACTUAL
│  04:52 AM start                 │
│  Actual: Running                │
│                                 │
└─────────────────────────────────┘
```

## Key Features

### 1. **Conditional Top Widget**
- **Shows:** Only when `is_actual === true` for today's date
- **Purpose:** Highlight completed workout with nutrition recommendations
- **Badge:** "✓ Completed" to confirm actual activity

### 2. **Weekly Planning View**
- **Always Shows:** 7 days of the week
- **Planned Activities:** Gray/normal styling
- **Actual Activities:** Green badge "Actual Data" + checkmark
- **Replacement Logic:** When actual data arrives, planned activity is replaced

### 3. **Data Priority**
- Actual activities take precedence over planned
- Database query orders by `is_actual DESC` (actual first)
- Frontend logic filters to ensure only one activity per day (actual wins)

## Benefits

✅ **Clear Mental Model**
- Top = What you DID (actual)
- Bottom = What you PLANNED (diary/calendar)

✅ **No Redundancy**
- Widget only appears when meaningful (actual data exists)
- Reduces visual clutter on rest days

✅ **Instant Feedback**
- User completes workout → syncs → widget appears
- Immediate confirmation of activity tracking

✅ **Planning Context**
- Weekly view always visible for planning
- Easy to see upcoming workouts
- Clear distinction between planned vs actual

## Technical Details

### Activity Detection
```typescript
const hasActualActivityToday = todayActivities.some(a => a.is_actual);
```

### Data Source
- `is_actual` flag comes from `training_activities` table
- Set by Google Fit sync functions when storing workout data
- Distinguishes synced activities from manually planned ones

### Render Logic
- **Conditional rendering** using IIFE (Immediately Invoked Function Expression)
- Checks today's date against `activitiesByDate` map
- Returns widget component or `null`

## Testing Checklist

- [x] Top widget hidden when no actual activity
- [x] Top widget appears after Google Fit sync
- [x] Weekly view always visible
- [x] Planned activities show normally
- [x] Actual activities marked with badge
- [x] Navigation (Prev/Next) works correctly

## Related Files

- `src/pages/TrainingCalendar.tsx` - Main calendar page (updated)
- `src/components/TrainingNutritionWidget.tsx` - Top widget component
- `src/hooks/useGoogleFitSync.ts` - Syncs actual activity data
- Database: `training_activities` table with `is_actual` column
