# ⚠️ Runna Calendar vs Weekly Pattern Generator - Conflict Resolution

## 🚨 Problem Identified

Your app has a **weekly pattern generator** (`generate-training-activities` edge function) that:

1. **Deletes ALL activities** for next week (lines 41-47)
2. **Regenerates** them from user's pattern stored in `profiles.activity_level`
3. **Will overwrite** Runna calendar activities! ❌

```typescript
// Current code - DANGEROUS!
await supabaseAdmin
  .from("training_activities")
  .delete()
  .eq("user_id", profile.user_id)
  .gte("date", format(nextWeekStart, "yyyy-MM-dd"))
  .lte("date", format(addDays(nextWeekStart, 6), "yyyy-MM-dd"));
  // ↑ This deletes EVERYTHING including Runna activities!
```

---

## 🎯 Solution: Priority-Based System

### Activity Source Priority

```
1. Runna Calendar (highest) → User explicitly connected external plan
2. Manual Entry → User manually created  
3. Pattern Generator (lowest) → Auto-generated fallback
```

### Updated Database Schema

```sql
ALTER TABLE public.training_activities 
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' 
    CHECK (source IN ('manual', 'calendar', 'pattern', 'google_fit', 'strava'));
```

| source | Meaning | Can be overwritten? |
|--------|---------|---------------------|
| `calendar` | Runna/TrainingPeaks | ❌ No (unless user edits) |
| `manual` | User-created | ❌ No |
| `pattern` | Auto-generated | ✅ Yes (lowest priority) |
| `google_fit` | Actual workout | N/A (is_actual=true) |
| `strava` | Actual workout | N/A (is_actual=true) |

---

## 🔧 Solution Options

### Option 1: Smart Delete (RECOMMENDED)

**Only delete pattern-generated activities**, preserve calendar and manual.

```typescript
// Updated generate-training-activities/index.ts

// Delete ONLY pattern-generated activities for next week
await supabaseAdmin
  .from("training_activities")
  .delete()
  .eq("user_id", profile.user_id)
  .eq("source", "pattern")  // ← Only delete pattern-generated
  .eq("is_actual", false)    // ← Only planned activities
  .gte("date", format(nextWeekStart, "yyyy-MM-dd"))
  .lte("date", format(addDays(nextWeekStart, 6), "yyyy-MM-dd"));

// Generate activities for next week
const activities = [];
for (let i = 0; i < 7; i++) {
  const date = addDays(nextWeekStart, i);
  const pattern = weeklyPattern[i];
  
  // Check if date already has calendar or manual activities
  const { data: existingActivities } = await supabaseAdmin
    .from("training_activities")
    .select("*")
    .eq("user_id", profile.user_id)
    .eq("date", format(date, "yyyy-MM-dd"))
    .eq("is_actual", false)
    .in("source", ["calendar", "manual"]);

  // Only generate pattern activity if no calendar/manual exists
  if (!existingActivities || existingActivities.length === 0) {
    if (pattern && pattern.activities.length > 0) {
      for (const act of pattern.activities) {
        activities.push({
          user_id: profile.user_id,
          date: format(date, "yyyy-MM-dd"),
          activity_type: act.activity_type,
          duration_minutes: act.duration_minutes,
          distance_km: act.distance_km,
          intensity: act.intensity,
          estimated_calories: act.estimated_calories,
          start_time: null,
          notes: null,
          source: "pattern",  // ← Mark as pattern-generated
          is_actual: false
        });
      }
    }
  }
}

if (activities.length > 0) {
  const { error: insertError } = await supabaseAdmin
    .from("training_activities")
    .insert(activities);
  
  if (insertError) throw insertError;
}
```

**Benefits:**
- ✅ Runna activities never deleted
- ✅ Manual activities never deleted  
- ✅ Pattern generator only fills gaps
- ✅ User has full control

**Behavior:**
- User connects Runna → Calendar activities take precedence
- User manually adds workout → Manual takes precedence
- Pattern generator → Only creates where nothing exists

---

### Option 2: Disable Pattern Generator When Calendar Connected

**Check if user has active calendar integration**, skip pattern generation.

```typescript
// At the start of generate-training-activities/index.ts

for (const profile of profiles) {
  try {
    // Check if user has active calendar integration
    const { data: calendarIntegration } = await supabaseAdmin
      .from("calendar_integrations")
      .select("id")
      .eq("user_id", profile.user_id)
      .eq("is_active", true)
      .maybeSingle();

    if (calendarIntegration) {
      console.log(`User ${profile.user_id} has calendar integration, skipping pattern generation`);
      generationResults.push({
        user_id: profile.user_id,
        success: true,
        skipped: true,
        reason: "Calendar integration active"
      });
      continue;
    }

    // Rest of pattern generation logic...
  }
}
```

**Benefits:**
- ✅ Simple logic
- ✅ Clear separation
- ✅ No conflicts possible

**Drawbacks:**
- ⚠️ User can't mix pattern + calendar
- ⚠️ All-or-nothing approach

---

### Option 3: Hybrid Approach (BEST)

**Combine Option 1 + Option 2**

```typescript
for (const profile of profiles) {
  try {
    // Check if user has active calendar integration
    const { data: calendarIntegration } = await supabaseAdmin
      .from("calendar_integrations")
      .select("id")
      .eq("user_id", profile.user_id)
      .eq("is_active", true)
      .maybeSingle();

    const weeklyPattern = JSON.parse(profile.activity_level) as WeeklyPattern[];

    // Delete ONLY pattern-generated activities
    await supabaseAdmin
      .from("training_activities")
      .delete()
      .eq("user_id", profile.user_id)
      .eq("source", "pattern")
      .eq("is_actual", false)
      .gte("date", format(nextWeekStart, "yyyy-MM-dd"))
      .lte("date", format(addDays(nextWeekStart, 6), "yyyy-MM-dd"));

    // Generate pattern activities
    const activities = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(nextWeekStart, i);
      const pattern = weeklyPattern[i];
      
      // Check existing activities (calendar, manual, or user-edited)
      const { data: existingActivities } = await supabaseAdmin
        .from("training_activities")
        .select("*")
        .eq("user_id", profile.user_id)
        .eq("date", format(date, "yyyy-MM-dd"))
        .eq("is_actual", false);

      // Filter to high-priority activities
      const hasHighPriorityActivity = existingActivities?.some(
        a => a.source === "calendar" || a.source === "manual" || a.is_user_edited
      );

      // Only generate if no high-priority activity exists
      if (!hasHighPriorityActivity && pattern?.activities.length > 0) {
        for (const act of pattern.activities) {
          activities.push({
            user_id: profile.user_id,
            date: format(date, "yyyy-MM-dd"),
            activity_type: act.activity_type,
            duration_minutes: act.duration_minutes,
            distance_km: act.distance_km,
            intensity: act.intensity,
            estimated_calories: act.estimated_calories,
            start_time: null,
            notes: calendarIntegration 
              ? `Auto-generated (backup for ${format(date, "MMM d")})` 
              : null,
            source: "pattern",
            is_actual: false,
            is_from_calendar: false
          });
        }
      }
    }

    if (activities.length > 0) {
      await supabaseAdmin.from("training_activities").insert(activities);
    }

    generationResults.push({
      user_id: profile.user_id,
      success: true,
      activities_generated: activities.length,
      has_calendar: !!calendarIntegration
    });
  } catch (error) {
    // Error handling...
  }
}
```

**Benefits:**
- ✅ Pattern generator fills gaps only
- ✅ Runna calendar always takes priority
- ✅ Manual entries preserved
- ✅ Pattern as fallback/backup
- ✅ Flexible for users

---

## 🎨 User Experience

### Scenario 1: User Has Runna Calendar

```
Pattern in Goals: M-Rest, Tu-Run 5k, W-Run 5k, Th-Rest...
Runna Calendar: M-Rest, Tu-Run 8k, W-Strength, Th-Run 5k...

Result:
Monday: Rest (Runna) ✅
Tuesday: Run 8k (Runna) ✅ Pattern skipped
Wednesday: Strength (Runna) ✅ Pattern skipped
Thursday: Run 5k (Runna) ✅ Pattern skipped
```

### Scenario 2: User Has Partial Runna Calendar

```
Pattern: M-Rest, Tu-Run 5k, W-Run 5k, Th-Rest, F-Run 8k, Sa-Long 15k, Su-Rest
Runna: (only 3 days planned) Tu-Run 8k, Th-Run 5k, Sa-Long 15k

Result:
Monday: Rest (Pattern) ← Gap filled
Tuesday: Run 8k (Runna) ✅
Wednesday: Run 5k (Pattern) ← Gap filled
Thursday: Run 5k (Runna) ✅
Friday: Run 8k (Pattern) ← Gap filled
Saturday: Long 15k (Runna) ✅
Sunday: Rest (Pattern) ← Gap filled
```

### Scenario 3: User Manually Overrides

```
Runna: Tuesday - Run 5k
User manually changes to: Tuesday - Tempo Run 8k

Pattern generator next week:
Tuesday: User's manual entry preserved ✅ Pattern skipped
```

---

## 🗓️ When Does Pattern Generator Run?

Looking at the code, this function needs to be **triggered** (it's not a cron job yet). Typically called:
- Weekly (cron job or scheduled task)
- When user updates their pattern in Goals page
- Manually via API call

**Recommendation:** 
- Run weekly on Sundays to generate next week
- Skip dates that already have calendar/manual activities

---

## 📋 Migration & Implementation

### Step 1: Update Database

```sql
-- Add source field to existing migration
ALTER TABLE public.training_activities 
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' 
    CHECK (source IN ('manual', 'calendar', 'pattern', 'google_fit', 'strava'));

-- Update existing records
UPDATE public.training_activities 
SET source = CASE 
  WHEN is_actual = true THEN 'google_fit'
  WHEN is_from_calendar = true THEN 'calendar'
  ELSE 'pattern'  -- Assume existing planned activities are from pattern
END
WHERE source = 'manual';

-- Index
CREATE INDEX IF NOT EXISTS idx_training_activities_source_priority 
  ON public.training_activities(user_id, date, source, is_actual);
```

### Step 2: Update generate-training-activities Function

Replace with Option 3 (Hybrid Approach) code above.

### Step 3: Update Goals.tsx

When user saves pattern, mark activities as `source: 'pattern'`:

```typescript
// In Goals.tsx saveTrainingPlan function
const rows: any[] = [];
for (const d of datesOfWeek) {
  const dateStr = format(d, 'yyyy-MM-dd');
  for (const act of activitiesByDate[dateStr] || []) {
    rows.push({
      user_id: user.id,
      date: dateStr,
      activity_type: act.activity_type,
      // ... other fields
      source: 'pattern',  // ← Mark as pattern
      is_actual: false
    });
  }
}
```

### Step 4: Update Training.tsx

Show source badge:

```typescript
function getActivityBadge(activity: TrainingActivity) {
  if (activity.is_actual) return '✅ Completed';
  if (activity.source === 'calendar') return '📅 Runna Plan';
  if (activity.source === 'manual') return '📝 Manual';
  if (activity.source === 'pattern') return '🔄 Weekly Pattern';
  return '📝 Planned';
}
```

---

## ✅ Summary & Recommendation

### Use **Option 3: Hybrid Approach**

**Why:**
1. ✅ **Flexible** - Works with or without Runna
2. ✅ **Safe** - Never overwrites calendar/manual activities
3. ✅ **Smart** - Fills gaps automatically
4. ✅ **User control** - All sources can coexist

**Priority System:**
```
1. Calendar (Runna) - Highest priority
2. Manual - User created
3. Pattern - Auto-fill gaps only
```

**Changes Required:**
1. Add `source` field to database ✅
2. Update `generate-training-activities` function ✅
3. Update Goals.tsx to mark pattern activities ✅
4. Update Training.tsx to show source badges ✅

**Result:**
- Pattern generator becomes a **smart fallback**
- Never conflicts with Runna
- User has ultimate control
- Everything works together seamlessly

Ready to implement! 🚀

