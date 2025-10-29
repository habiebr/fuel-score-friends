# 🔀 Runna Calendar Integration - Conflict Resolution Strategy

## 🎯 Clarified Architecture

### Two-Layer System

**Layer 1: PLANNED Activities** (`is_actual = false`)
- Source: Runna calendar (auto-synced)
- Source: Manual entry (user-created)
- Purpose: What you **plan** to do

**Layer 2: ACTUAL Activities** (`is_actual = true`)
- Source: Google Fit (wearables)
- Source: Strava (wearables)
- Purpose: What you **actually did**

---

## 📊 Database Schema

### Current Fields (Already Exist)
```sql
training_activities:
- is_actual: BOOLEAN DEFAULT false
  → false = Planned (Runna OR manual)
  → true = Actual (Google Fit/Strava)

- is_from_calendar: BOOLEAN DEFAULT false (we're adding this)
- calendar_integration_id: UUID (we're adding this)
- external_id: TEXT (we're adding this)
```

### New Fields Needed
```sql
ALTER TABLE public.training_activities 
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' 
    CHECK (source IN ('manual', 'calendar', 'google_fit', 'strava')),
  ADD COLUMN IF NOT EXISTS is_user_edited BOOLEAN DEFAULT false;
```

### Complete Classification

| is_actual | source | is_user_edited | Meaning |
|-----------|--------|----------------|---------|
| `false` | `calendar` | `false` | **Runna plan (auto-synced)** |
| `false` | `calendar` | `true` | **Runna plan (user edited)** |
| `false` | `manual` | `false` | **Manual planned activity** |
| `true` | `google_fit` | N/A | **Google Fit actual workout** |
| `true` | `strava` | N/A | **Strava actual workout** |

---

## 🎯 Simple Conflict Resolution

### Conflict Type 1: Multiple PLANNED Activities (Same Day)

**Scenario:** Runna calendar + Manual entry on same day

```
Monday:
- Runna Plan: Easy Run 5km (is_actual=false, source=calendar)
- Manual Plan: Tempo Run 8km (is_actual=false, source=manual)
```

**Resolution:**
- ✅ **Show both** (user might have multiple workouts planned)
- ✅ Visual distinction (Runna badge vs Manual badge)
- ✅ For nutrition: Use TOTAL of both

```typescript
// Display both with badges
const plannedActivities = activities.filter(a => !a.is_actual)

plannedActivities.forEach(activity => {
  const badge = activity.source === 'calendar' ? '📅 Runna Plan' : '📝 Manual Plan'
  display(activity, badge)
})

// For nutrition calculation: Sum all planned
const totalPlannedCalories = plannedActivities.reduce(
  (sum, a) => sum + a.estimated_calories, 
  0
)
```

### Conflict Type 2: PLANNED vs ACTUAL (Same Day)

**Scenario:** Planned workout + actual workout logged by Google Fit

```
Monday:
- Runna Plan: Easy Run 5km (is_actual=false)
- Google Fit: Actual Run 6.8km (is_actual=true)
```

**Resolution:**
- ✅ **Show both** (comparison is valuable)
- ✅ For nutrition/scoring: **Use ACTUAL only**

```typescript
// Display both for comparison
const planned = activities.filter(a => !a.is_actual)
const actual = activities.filter(a => a.is_actual)

// Show planned (dimmed)
planned.forEach(a => display(a, { style: 'dimmed', badge: '📅 Planned' }))

// Show actual (highlighted)
actual.forEach(a => display(a, { style: 'success', badge: '✅ Completed' }))

// For nutrition: Use actual only
const caloriesForNutrition = actual.length > 0 
  ? actual.reduce((sum, a) => sum + a.estimated_calories, 0)
  : planned.reduce((sum, a) => sum + a.estimated_calories, 0)
```

### Conflict Type 3: User Edits Runna Activity

**Scenario:** User changes Runna-synced activity

```
Before edit:
- Runna: Easy Run 5km (is_actual=false, source=calendar, is_user_edited=false)

User changes to 7km:
- Updated: Easy Run 7km (is_actual=false, source=calendar, is_user_edited=true)
```

**Resolution:**
- ✅ Mark `is_user_edited = true`
- ✅ **Skip on next sync** (don't overwrite user changes)

```typescript
// When user edits
async function handleEdit(activity: TrainingActivity) {
  if (activity.source === 'calendar' && !activity.is_user_edited) {
    // Warn user
    const confirmed = await showWarning(
      'This is from Runna. Your changes will be preserved but won\'t sync back to Runna.'
    )
    if (!confirmed) return
  }

  await supabase
    .from('training_activities')
    .update({
      ...editedValues,
      is_user_edited: activity.source === 'calendar' ? true : false
    })
    .eq('id', activity.id)
}

// During calendar sync - skip user-edited
for (const icsEvent of icsEvents) {
  const existing = findActivity(icsEvent.external_id)
  
  if (existing && existing.is_user_edited) {
    // Skip - user has modified it
    console.log('Skipping user-edited activity')
    continue
  }
  
  // Otherwise update it
  upsertActivity(icsEvent)
}
```

---

## 🎨 UI Display Strategy

### Training Page Layout

```
┌─────────────────────────────────────────────────┐
│  Monday, Oct 20, 2025                           │
├─────────────────────────────────────────────────┤
│                                                 │
│  📅 RUNNA PLAN                                  │ ← is_actual=false, source=calendar
│  🏃 Easy Run • 5km • 30 min • Zone 2            │
│  [Edit] [Details]                               │
│                                                 │
│  📝 MY WORKOUT                                  │ ← is_actual=false, source=manual
│  💪 Strength Training • 45 min                  │
│  [Edit] [Delete]                                │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  ✅ COMPLETED (Google Fit)                      │ ← is_actual=true, source=google_fit
│  🏃 Morning Run • 6.8km • 38 min                │
│  Avg pace: 5:35/km • HR: 152 bpm               │
│                                                 │
│  💡 Tip: You ran 1.8km more than planned!       │ ← Smart comparison
│                                                 │
└─────────────────────────────────────────────────┘
```

### Visual Hierarchy

```typescript
function getActivityStyle(activity: TrainingActivity) {
  if (activity.is_actual) {
    return {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-500',
      badge: '✅ Completed',
      badgeColor: 'bg-green-500'
    }
  }
  
  if (activity.source === 'calendar') {
    return {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-300',
      badge: activity.is_user_edited ? '📅✏️ Runna (Edited)' : '📅 Runna Plan',
      badgeColor: 'bg-blue-500'
    }
  }
  
  return {
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
    badge: '📝 Manual Plan',
    badgeColor: 'bg-gray-500'
  }
}
```

---

## 🔄 Calendar Sync Logic

### Smart Sync Algorithm

```typescript
async function syncRunnaCalendar(
  calendarId: string,
  icsEvents: ICSEvent[]
) {
  // 1. Get existing calendar activities
  const existing = await getCalendarActivities(calendarId)
  const existingMap = new Map(existing.map(a => [a.external_id, a]))
  
  const toInsert = []
  const toUpdate = []
  const toDelete = []
  
  // 2. Process ICS events
  for (const event of icsEvents) {
    const existingActivity = existingMap.get(event.uid)
    
    if (!existingActivity) {
      // New event: Insert
      toInsert.push({
        ...parseIcsEvent(event),
        is_actual: false,  // ← Always false for calendar
        source: 'calendar',
        is_from_calendar: true,
        is_user_edited: false
      })
    } else if (!existingActivity.is_user_edited) {
      // Existing, not edited: Update
      toUpdate.push({
        id: existingActivity.id,
        ...parseIcsEvent(event)
      })
    }
    // else: User edited, skip
  }
  
  // 3. Find deleted events
  const currentEventIds = new Set(icsEvents.map(e => e.uid))
  for (const activity of existing) {
    if (!currentEventIds.has(activity.external_id)) {
      if (!activity.is_user_edited) {
        // Event deleted from Runna, not edited: Delete
        toDelete.push(activity.id)
      } else {
        // Event deleted but user edited: Keep as manual
        await convertToManual(activity.id)
      }
    }
  }
  
  // 4. Execute changes
  if (toInsert.length > 0) {
    await supabase.from('training_activities').insert(toInsert)
  }
  
  if (toUpdate.length > 0) {
    for (const update of toUpdate) {
      await supabase
        .from('training_activities')
        .update(update)
        .eq('id', update.id)
    }
  }
  
  if (toDelete.length > 0) {
    await supabase
      .from('training_activities')
      .delete()
      .in('id', toDelete)
  }
  
  return {
    inserted: toInsert.length,
    updated: toUpdate.length,
    deleted: toDelete.length
  }
}
```

---

## 📊 Nutrition Calculation Priority

### For Daily Calorie Targets

```typescript
function calculateDailyCalorieTarget(date: string) {
  const activities = getActivitiesForDate(date)
  
  // Separate planned and actual
  const actual = activities.filter(a => a.is_actual)
  const planned = activities.filter(a => !a.is_actual)
  
  // Use actual if available, else planned
  const activitiesToUse = actual.length > 0 ? actual : planned
  
  const trainingCalories = activitiesToUse.reduce(
    (sum, a) => sum + a.estimated_calories,
    0
  )
  
  return baseCalories + trainingCalories
}
```

### For Scoring

```typescript
function scoreDailyTraining(date: string) {
  const activities = getActivitiesForDate(date)
  
  const actual = activities.filter(a => a.is_actual)
  const planned = activities.filter(a => !a.is_actual)
  
  if (actual.length === 0 && planned.length === 0) {
    // No plan, no workout
    return { score: 50, message: 'No training planned or logged' }
  }
  
  if (actual.length === 0 && planned.length > 0) {
    // Planned but not done
    return { score: 30, message: 'Planned workout not completed' }
  }
  
  if (actual.length > 0 && planned.length === 0) {
    // Unplanned workout
    return { score: 80, message: 'Workout completed (unplanned)' }
  }
  
  // Both planned and actual exist - compare
  const plannedDistance = planned.reduce((sum, a) => sum + (a.distance_km || 0), 0)
  const actualDistance = actual.reduce((sum, a) => sum + (a.distance_km || 0), 0)
  
  const adherence = actualDistance / plannedDistance
  
  if (adherence >= 0.9 && adherence <= 1.1) {
    return { score: 100, message: 'Perfect plan adherence!' }
  } else if (adherence >= 0.8) {
    return { score: 90, message: 'Good plan adherence' }
  } else {
    return { score: 70, message: 'Completed workout (different from plan)' }
  }
}
```

---

## 🧪 Test Scenarios

### Scenario 1: Fresh Runna Sync ✅
```
Action: User connects Runna calendar
Result:
- 20 activities inserted
- All have: is_actual=false, source='calendar', is_user_edited=false
- Visible in Training page with 📅 badge
```

### Scenario 2: User Edits Runna Activity ✅
```
Before: Easy Run 5km (from Runna)
Action: User changes to 7km
After: Easy Run 7km (is_user_edited=true)
Next Sync: Activity NOT overwritten
Result: User changes preserved
```

### Scenario 3: Manual + Calendar Same Day ✅
```
Monday:
- Runna: Easy Run 5km (source=calendar)
- Manual: Strength 45m (source=manual)
Result: Both shown, both used for nutrition
```

### Scenario 4: Plan + Actual Same Day ✅
```
Monday:
- Planned: Easy Run 5km (is_actual=false, source=calendar)
- Actual: Run 6.8km (is_actual=true, source=google_fit)
Display: Both visible with different badges
Nutrition: Uses actual (6.8km)
Scoring: 100 (plan completed, slight variation)
```

### Scenario 5: Runna Plan Changes ✅
```
Original: Long Run 15km
Runna updates to: Easy Run 5km
User hasn't edited: Activity updated to 5km
User had edited: Activity NOT updated
Result: Reflects current Runna plan OR preserves user edit
```

### Scenario 6: Runna Event Deleted ✅
```
Activity exists: Easy Run 5km (not edited)
Event removed from Runna calendar
Result: Activity deleted from database

Activity exists: Easy Run 7km (user edited)
Event removed from Runna calendar
Result: Converted to source='manual', kept in database
```

---

## 🎯 Key Principles

### 1. Clear Separation
- **Planned** (`is_actual=false`) = Runna OR Manual
- **Actual** (`is_actual=true`) = Wearables ONLY

### 2. Source Tracking
- `source` field distinguishes WHO created the planned activity
- Calendar vs Manual, not Planned vs Actual

### 3. User Control
- User can edit calendar activities
- Edits marked with `is_user_edited=true`
- Syncs respect user edits (don't overwrite)

### 4. Visual Clarity
- Badges show source clearly
- Actual activities highlighted
- Planned activities normal/dimmed

### 5. Smart Nutrition
- Prefer actual over planned for calculations
- If no actual, use planned
- Multiple activities = sum them all

---

## 📋 Migration SQL

```sql
-- Add new fields to training_activities
ALTER TABLE public.training_activities 
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' 
    CHECK (source IN ('manual', 'calendar', 'google_fit', 'strava')),
  ADD COLUMN IF NOT EXISTS is_user_edited BOOLEAN DEFAULT false;

-- Create index
CREATE INDEX IF NOT EXISTS idx_training_activities_source 
  ON public.training_activities(user_id, date, source, is_actual);

-- Update existing records to set correct source
UPDATE public.training_activities 
SET source = CASE 
  WHEN is_actual = true THEN 'google_fit'  -- Existing actual from Google Fit
  WHEN is_from_calendar = true THEN 'calendar'  -- If we already had calendar field
  ELSE 'manual'  -- Everything else is manual
END
WHERE source = 'manual';

-- Comments
COMMENT ON COLUMN public.training_activities.source IS 
  'Source: manual (user), calendar (Runna/TrainingPeaks), google_fit, strava';
  
COMMENT ON COLUMN public.training_activities.is_user_edited IS 
  'True if user edited a calendar-synced activity (prevents overwrite on sync)';
```

---

## ✅ Summary

**Simple Two-Layer System:**

```
PLANNED (is_actual=false)
├── Calendar source (Runna)
│   ├── Auto-synced (is_user_edited=false) → Updates on sync
│   └── User-edited (is_user_edited=true) → Preserved on sync
└── Manual source (User-created)

ACTUAL (is_actual=true)
├── Google Fit
└── Strava
```

**For Nutrition/Scoring:**
- ✅ Prefer ACTUAL over PLANNED
- ✅ If no ACTUAL, use PLANNED (calendar + manual combined)
- ✅ Show both for comparison/motivation

**No Complex Conflicts:**
- Calendar activities are just planned activities from a different source
- They work alongside manual planned activities
- Actual activities (wearables) are completely separate layer
- Clear visual distinction makes it intuitive for users

Ready to implement! 🚀

