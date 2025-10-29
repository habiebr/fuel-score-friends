# 🔀 Runna Calendar Integration - Conflict Resolution Strategy

## 🎯 Problem Statement

How do we handle conflicts between:
1. **Calendar activities** (from Runna ICS sync)
2. **Manual activities** (user-entered in Training page)
3. **Actual activities** (from Google Fit/Strava)

---

## 📊 Current System Analysis

### Existing Architecture ✅

Your app already has an `is_actual` flag system:

```sql
training_activities table:
- is_actual: false  → Planned activities (manual entry)
- is_actual: true   → Actual activities (Google Fit/Strava)
```

**From `update-actual-training` edge function:**
- Actual activities are inserted as **NEW records** (doesn't overwrite planned)
- Both planned and actual can coexist for the same day
- `TrainingCalendar.tsx` displays them side-by-side

---

## 🏗️ Enhanced Architecture

### Three-Layer Activity System

```
Layer 1: CALENDAR PLANNED  (from Runna) - Auto-synced baseline
         ↓
Layer 2: MANUAL PLANNED    (user-edited) - User override
         ↓
Layer 3: ACTUAL            (Google Fit) - What actually happened
```

### New Database Schema Enhancement

Add fields to distinguish activity sources:

```sql
ALTER TABLE training_activities 
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS is_user_edited BOOLEAN DEFAULT false;

-- source values: 'manual', 'calendar', 'google_fit', 'strava'
-- is_user_edited: true if user modified a calendar activity
```

**Complete activity classification:**

| source | is_actual | is_user_edited | is_from_calendar | Meaning |
|--------|-----------|----------------|------------------|---------|
| `calendar` | `false` | `false` | `true` | Auto-synced from Runna |
| `manual` | `false` | `false` | `false` | User-created planned |
| `calendar` | `false` | `true` | `true` | Calendar activity user edited |
| `google_fit` | `true` | `false` | `false` | Actual from Google Fit |
| `strava` | `true` | `false` | `false` | Actual from Strava |

---

## 🎲 Conflict Resolution Rules

### Rule 1: User Edits Take Precedence

**Scenario:** User edits a calendar-synced activity

```typescript
// When user edits a calendar activity
if (activity.is_from_calendar && !activity.is_user_edited) {
  // Mark as user-edited
  activity.is_user_edited = true
  
  // DO NOT overwrite on next calendar sync
  // Keep user's changes
}
```

**Result:** Calendar sync will skip this activity

### Rule 2: Actual Always Wins

**Scenario:** Google Fit has actual data for a date with planned activities

```typescript
// Current behavior (already working):
// - Planned activity: is_actual = false
// - Actual activity: is_actual = true (inserted as new record)
// Both coexist, UI shows comparison

// For scoring: Use actual if available, else planned
const activity = actualActivities[date] || plannedActivities[date]
```

**Result:** Both visible, actual used for nutrition/scoring

### Rule 3: Manual Overrides Calendar

**Scenario:** User manually creates/edits activity on date with calendar activity

```typescript
// Option A: Hide calendar activity when manual exists
if (manualActivity && calendarActivity && !calendarActivity.is_user_edited) {
  // Show manual, hide calendar
  display(manualActivity)
}

// Option B: Show both with visual distinction (RECOMMENDED)
if (manualActivity && calendarActivity) {
  display([
    { ...calendarActivity, type: 'calendar', dimmed: true },
    { ...manualActivity, type: 'manual', highlighted: true }
  ])
}
```

**Result:** User has full control, can see original plan

### Rule 4: Calendar Sync Updates Only Unedited

**Scenario:** Runna calendar sync runs, some activities already exist

```typescript
// During calendar sync
for (const icsEvent of icsEvents) {
  const existingActivity = findActivity(icsEvent.external_id)
  
  if (!existingActivity) {
    // New activity: Insert it
    insertActivity({
      ...parseIcsEvent(icsEvent),
      source: 'calendar',
      is_from_calendar: true,
      is_user_edited: false
    })
  } else if (existingActivity.is_from_calendar && !existingActivity.is_user_edited) {
    // Calendar activity not edited by user: Update it
    updateActivity(existingActivity.id, parseIcsEvent(icsEvent))
  } else {
    // User-edited or manual: Skip (don't overwrite)
    console.log(`Skipping update for ${icsEvent.external_id} - user edited`)
  }
}
```

**Result:** Only auto-synced activities get updated

### Rule 5: Deleted Calendar Events

**Scenario:** Runna plan changes, event removed from calendar

```typescript
// During calendar sync
const currentIcsEventIds = icsEvents.map(e => e.uid)
const existingCalendarActivities = getCalendarActivities()

for (const activity of existingCalendarActivities) {
  if (!currentIcsEventIds.includes(activity.external_id) && !activity.is_user_edited) {
    // Calendar event deleted, not user-edited: Remove it
    deleteActivity(activity.id)
  } else if (!currentIcsEventIds.includes(activity.external_id) && activity.is_user_edited) {
    // Calendar event deleted but user edited: Keep it, mark as manual
    updateActivity(activity.id, { 
      source: 'manual',
      is_from_calendar: false,
      calendar_integration_id: null
    })
  }
}
```

**Result:** Sync reflects current Runna plan, preserves user changes

---

## 🎨 UI/UX Handling

### Training Page - Activity Display

**Visual Hierarchy:**

```
┌─────────────────────────────────────────┐
│  Monday, Oct 20                         │
├─────────────────────────────────────────┤
│                                         │
│  📅 RUNNA PLAN (Calendar)               │  ← Dimmed, background color
│  🏃 Easy Run • 5km • 30m                │
│  Conversational pace, Zone 2            │
│  [Edit]                                 │
│                                         │
│  ✏️ MY PLAN (Manual Override)           │  ← Normal brightness
│  🏃 Easy Run • 7km • 40m                │
│  Pushing a bit more today               │
│  [Edit] [Delete]                        │
│                                         │
│  ✅ ACTUAL (Google Fit)                 │  ← Highlighted, success color
│  🏃 Morning Run • 6.8km • 38m           │
│  Average pace: 5:35/km                  │
│                                         │
└─────────────────────────────────────────┘
```

### Activity Card Indicators

```typescript
// Visual indicators
function ActivityCard({ activity }) {
  const badge = activity.is_actual ? '✅ Completed'
    : activity.source === 'calendar' ? '📅 From Runna'
    : activity.is_user_edited ? '✏️ Custom'
    : '📝 Planned'

  const style = activity.is_actual ? 'success'
    : activity.source === 'calendar' && !activity.is_user_edited ? 'muted'
    : 'default'

  return (
    <Card className={styles[style]}>
      <Badge>{badge}</Badge>
      {/* Activity details */}
    </Card>
  )
}
```

### User Actions

**When user clicks "Edit" on calendar activity:**

```typescript
function handleEditCalendarActivity(activity) {
  showDialog({
    title: 'Edit Calendar Activity',
    message: 'This activity is synced from Runna. Your changes will not sync back to Runna, but will be preserved here.',
    buttons: [
      { label: 'Edit Anyway', action: () => editActivity(activity) },
      { label: 'Create Separate Activity', action: () => duplicateActivity(activity) },
      { label: 'Cancel', action: () => close() }
    ]
  })
}
```

---

## 🔧 Implementation Updates

### Database Migration

```sql
-- Add source tracking and edit detection
ALTER TABLE public.training_activities 
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' 
    CHECK (source IN ('manual', 'calendar', 'google_fit', 'strava', 'manual_override')),
  ADD COLUMN IF NOT EXISTS is_user_edited BOOLEAN DEFAULT false;

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_training_activities_source_edited 
  ON public.training_activities(user_id, date, source, is_user_edited);

-- Update existing records
UPDATE public.training_activities 
SET source = CASE 
  WHEN is_actual = true THEN 'google_fit'
  WHEN is_from_calendar = true THEN 'calendar'
  ELSE 'manual'
END
WHERE source = 'manual';

COMMENT ON COLUMN public.training_activities.source IS 
  'Source of activity: manual (user-created), calendar (Runna/TrainingPeaks), google_fit, strava';

COMMENT ON COLUMN public.training_activities.is_user_edited IS 
  'True if user manually edited a calendar-synced activity';
```

### Updated Calendar Sync Logic

```typescript
// supabase/functions/sync-calendar-ics/index.ts

async function syncCalendarActivities(
  supabase: SupabaseClient,
  calendarIntegration: CalendarIntegration,
  icsEvents: ICSEvent[]
): Promise<SyncResult> {
  const userId = calendarIntegration.user_id
  const calendarId = calendarIntegration.id

  // Get existing calendar activities for this calendar
  const { data: existingActivities } = await supabase
    .from('training_activities')
    .select('*')
    .eq('user_id', userId)
    .eq('calendar_integration_id', calendarId)
    .eq('is_from_calendar', true)

  const existingByExternalId = new Map(
    existingActivities?.map(a => [a.external_id, a]) || []
  )

  const icsEventIds = new Set(icsEvents.map(e => e.uid))
  const activitiesToUpsert = []
  const activitiesToDelete = []
  const activitiesToConvert = []

  // Process ICS events
  for (const icsEvent of icsEvents) {
    const existing = existingByExternalId.get(icsEvent.uid)

    if (!existing) {
      // New calendar event: Insert
      activitiesToUpsert.push({
        ...parseIcsEvent(icsEvent),
        user_id: userId,
        calendar_integration_id: calendarId,
        external_id: icsEvent.uid,
        source: 'calendar',
        is_from_calendar: true,
        is_user_edited: false,
        is_actual: false
      })
    } else if (!existing.is_user_edited) {
      // Existing unedited calendar event: Update
      activitiesToUpsert.push({
        id: existing.id, // Preserve ID for upsert
        ...parseIcsEvent(icsEvent),
        user_id: userId,
        calendar_integration_id: calendarId,
        external_id: icsEvent.uid,
        source: 'calendar',
        is_from_calendar: true,
        is_user_edited: false,
        is_actual: false
      })
    }
    // else: User edited, skip update
  }

  // Handle deleted calendar events
  for (const [externalId, activity] of existingByExternalId) {
    if (!icsEventIds.has(externalId)) {
      if (!activity.is_user_edited) {
        // Not user-edited: Delete
        activitiesToDelete.push(activity.id)
      } else {
        // User-edited: Convert to manual
        activitiesToConvert.push({
          id: activity.id,
          source: 'manual',
          is_from_calendar: false,
          calendar_integration_id: null,
          external_id: null
        })
      }
    }
  }

  // Execute database operations
  if (activitiesToUpsert.length > 0) {
    await supabase
      .from('training_activities')
      .upsert(activitiesToUpsert, {
        onConflict: 'calendar_integration_id,external_id'
      })
  }

  if (activitiesToDelete.length > 0) {
    await supabase
      .from('training_activities')
      .delete()
      .in('id', activitiesToDelete)
  }

  if (activitiesToConvert.length > 0) {
    for (const update of activitiesToConvert) {
      await supabase
        .from('training_activities')
        .update(update)
        .eq('id', update.id)
    }
  }

  return {
    inserted: activitiesToUpsert.filter(a => !a.id).length,
    updated: activitiesToUpsert.filter(a => a.id).length,
    deleted: activitiesToDelete.length,
    converted: activitiesToConvert.length
  }
}
```

### Updated Training.tsx Logic

```typescript
// src/pages/Training.tsx

// When user edits an activity
const handleActivityEdit = async (activity: TrainingActivity) => {
  if (activity.is_from_calendar && !activity.is_user_edited) {
    // Warn user about editing calendar activity
    const confirmed = await confirmDialog({
      title: 'Edit Calendar Activity?',
      message: 'This activity is synced from your Runna calendar. Your changes will be preserved and won\'t be overwritten on next sync.',
      confirmText: 'Edit Anyway',
      cancelText: 'Cancel'
    })

    if (!confirmed) return
  }

  // Save with is_user_edited flag
  await supabase
    .from('training_activities')
    .update({
      ...activity,
      is_user_edited: activity.is_from_calendar ? true : activity.is_user_edited
    })
    .eq('id', activity.id)
}

// Display activities with proper hierarchy
const displayActivities = (activities: TrainingActivity[]) => {
  // Sort by priority: actual > manual > calendar
  const sorted = activities.sort((a, b) => {
    if (a.is_actual !== b.is_actual) return a.is_actual ? -1 : 1
    if (a.source === 'manual' && b.source === 'calendar') return -1
    if (a.source === 'calendar' && b.source === 'manual') return 1
    return 0
  })

  return sorted.map(activity => (
    <ActivityCard
      key={activity.id}
      activity={activity}
      variant={getVariant(activity)}
      badge={getBadge(activity)}
    />
  ))
}

function getVariant(activity: TrainingActivity): 'actual' | 'manual' | 'calendar' {
  if (activity.is_actual) return 'actual'
  if (activity.source === 'manual' || activity.is_user_edited) return 'manual'
  return 'calendar'
}

function getBadge(activity: TrainingActivity): string {
  if (activity.is_actual) return '✅ Completed'
  if (activity.is_user_edited) return '✏️ Custom'
  if (activity.source === 'calendar') return '📅 From Runna'
  return '📝 Planned'
}
```

---

## 🧪 Test Scenarios

### Scenario 1: Fresh Runna Sync
1. User connects Runna calendar
2. Sync pulls 20 upcoming workouts
3. All inserted with `source: 'calendar'`, `is_user_edited: false`
4. ✅ No conflicts, all appear in Training page

### Scenario 2: User Edits Calendar Activity
1. Calendar has "Easy Run 5km"
2. User changes to "Easy Run 7km"
3. Activity marked `is_user_edited: true`
4. Next sync: Activity NOT updated
5. ✅ User's changes preserved

### Scenario 3: User Adds Manual Activity on Same Day
1. Calendar has "Easy Run 5km" on Monday
2. User adds "Strength Training 45m" on Monday
3. Both activities visible
4. ✅ No conflict, both coexist

### Scenario 4: Google Fit Logs Actual Workout
1. Calendar: "Easy Run 5km" (planned)
2. Manual: "Easy Run 7km" (user edited)
3. Google Fit: "Run 6.8km" (actual)
4. All three visible with clear badges
5. ✅ For scoring: Use actual (6.8km)

### Scenario 5: Runna Plan Changes
1. Calendar originally: "Long Run 15km" on Sunday
2. Runna updates plan: "Easy Run 5km" on Sunday
3. User hasn't edited: Activity updated to 5km
4. ✅ Reflects new Runna plan

### Scenario 6: Event Deleted from Runna
1. Calendar activity exists, user edited it
2. Event removed from Runna calendar
3. Activity converted to `source: 'manual'`
4. ✅ User's work not lost

---

## 📱 User Experience Summary

### Clear Communication
- **Badge system** shows activity source
- **Visual hierarchy** emphasizes actual over planned
- **Edit warnings** inform about calendar sync behavior

### User Control
- **Can always edit** calendar activities
- **Edits are preserved** on sync
- **Can add manual activities** alongside calendar
- **Can disconnect calendar** anytime

### Smart Defaults
- **Calendar is baseline** for planning
- **Manual overrides** when user knows better
- **Actual always wins** for scoring/nutrition

---

## ✅ Recommendation

**Use this strategy:**

1. ✅ **Add `source` and `is_user_edited` fields**
2. ✅ **Sync only updates unedited calendar activities**
3. ✅ **Display all activities with visual distinction**
4. ✅ **Warn users when editing calendar activities**
5. ✅ **Preserve user changes on sync**
6. ✅ **Use actual > manual > calendar for nutrition calculations**

This provides:
- **Maximum flexibility** for users
- **Clear visual hierarchy**
- **Preserved user intent**
- **Smart conflict resolution**
- **Seamless Runna integration**

---

## 🚀 Next Steps

1. Apply updated database migration
2. Implement enhanced sync logic
3. Update Training.tsx with badges and warnings
4. Test all conflict scenarios
5. Add user documentation
6. Deploy and monitor

Ready to implement! 🎉

