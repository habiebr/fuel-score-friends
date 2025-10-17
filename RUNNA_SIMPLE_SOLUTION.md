# 🎯 Runna + Pattern Generator - Simple Solution

## 💡 Simplified Approach

**Rule:** Pattern generator is **discarded/skipped** when Runna calendar has an activity for that date.

### Simple Logic

```
For each date:
  Does Runna have an activity? 
    → YES: Use Runna, skip pattern
    → NO: Generate pattern

User manually adds activity?
  → Keep it alongside (or replace pattern if desired)
```

---

## 🔧 Implementation

### Updated generate-training-activities Function

```typescript
// supabase/functions/generate-training-activities/index.ts

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Get all users with activity patterns
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, activity_level")
      .not("activity_level", "is", null);

    if (profilesError) throw profilesError;

    const generationResults = [];
    const today = new Date();
    const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });

    for (const profile of profiles) {
      try {
        const weeklyPattern = JSON.parse(profile.activity_level) as WeeklyPattern[];

        // Check if user has calendar integration
        const { data: calendarActivities } = await supabaseAdmin
          .from("training_activities")
          .select("date")
          .eq("user_id", profile.user_id)
          .eq("is_from_calendar", true)
          .eq("is_actual", false)
          .gte("date", format(nextWeekStart, "yyyy-MM-dd"))
          .lte("date", format(addDays(nextWeekStart, 6), "yyyy-MM-dd"));

        // Create a Set of dates that have calendar activities
        const calendarDates = new Set(
          (calendarActivities || []).map(a => a.date)
        );

        // Delete ONLY pattern-generated activities 
        // (or delete all and regenerate based on calendar presence)
        await supabaseAdmin
          .from("training_activities")
          .delete()
          .eq("user_id", profile.user_id)
          .eq("is_from_calendar", false)  // Not from calendar
          .eq("is_actual", false)          // Not actual workouts
          .gte("date", format(nextWeekStart, "yyyy-MM-dd"))
          .lte("date", format(addDays(nextWeekStart, 6), "yyyy-MM-dd"));

        // Generate activities for next week
        const activities = [];
        for (let i = 0; i < 7; i++) {
          const date = addDays(nextWeekStart, i);
          const dateStr = format(date, "yyyy-MM-dd");
          const pattern = weeklyPattern[i];
          
          // SKIP if calendar has activity for this date
          if (calendarDates.has(dateStr)) {
            console.log(`Skipping ${dateStr} - has Runna activity`);
            continue;
          }
          
          // Generate pattern activity only if no calendar activity
          if (pattern && pattern.activities.length > 0) {
            for (const act of pattern.activities) {
              activities.push({
                user_id: profile.user_id,
                date: dateStr,
                activity_type: act.activity_type,
                duration_minutes: act.duration_minutes,
                distance_km: act.distance_km,
                intensity: act.intensity,
                estimated_calories: act.estimated_calories,
                start_time: null,
                notes: null,
                is_from_calendar: false,
                is_actual: false
              });
            }
          }
        }

        if (activities.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from("training_activities")
            .insert(activities);
          
          if (insertError) throw insertError;
        }

        generationResults.push({
          user_id: profile.user_id,
          success: true,
          activities_generated: activities.length,
          skipped_for_calendar: calendarDates.size
        });

      } catch (error) {
        console.error(`Error generating activities for user ${profile.user_id}:`, error);
        generationResults.push({
          user_id: profile.user_id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      results: generationResults
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
```

---

## 📊 Behavior Examples

### Scenario 1: Full Runna Calendar

```
Pattern: M-Rest, Tu-Run 5k, W-Run 5k, Th-Rest, F-Run 8k, Sa-Long 15k, Su-Rest
Runna:   M-Rest, Tu-Run 8k, W-Strength, Th-Run 5k, F-Rest, Sa-Long 18k, Su-Rest

Result (Next Week):
Monday    → Rest (Runna) ✅ Pattern discarded
Tuesday   → Run 8k (Runna) ✅ Pattern discarded
Wednesday → Strength (Runna) ✅ Pattern discarded
Thursday  → Run 5k (Runna) ✅ Pattern discarded
Friday    → Rest (Runna) ✅ Pattern discarded
Saturday  → Long 18k (Runna) ✅ Pattern discarded
Sunday    → Rest (Runna) ✅ Pattern discarded

Pattern activities generated: 0
```

### Scenario 2: Partial Runna Calendar (Most Common)

```
Pattern: M-Rest, Tu-Run 5k, W-Run 5k, Th-Rest, F-Run 8k, Sa-Long 15k, Su-Rest
Runna:   (only 3 days) Tu-Run 8k, Th-Run 5k, Sa-Long 18k

Result (Next Week):
Monday    → Rest (Pattern) ← Gap filled
Tuesday   → Run 8k (Runna) ✅ Pattern discarded
Wednesday → Run 5k (Pattern) ← Gap filled
Thursday  → Run 5k (Runna) ✅ Pattern discarded
Friday    → Run 8k (Pattern) ← Gap filled
Saturday  → Long 18k (Runna) ✅ Pattern discarded
Sunday    → Rest (Pattern) ← Gap filled

Pattern activities generated: 4
Runna activities: 3
```

### Scenario 3: No Runna Calendar

```
Pattern: M-Rest, Tu-Run 5k, W-Run 5k, Th-Rest, F-Run 8k, Sa-Long 15k, Su-Rest
Runna:   (not connected)

Result (Next Week):
Monday    → Rest (Pattern)
Tuesday   → Run 5k (Pattern)
Wednesday → Run 5k (Pattern)
Thursday  → Rest (Pattern)
Friday    → Run 8k (Pattern)
Saturday  → Long 15k (Pattern)
Sunday    → Rest (Pattern)

Pattern activities generated: 7
```

### Scenario 4: User Manual Override

```
Pattern: Tuesday - Run 5k
Runna:   Tuesday - Run 8k
User:    Manually adds "Tempo Run 10k" on Tuesday

Current week: User's manual activity stays
Next week generation:
  - Runna has Tuesday activity → Pattern discarded
  - Result: Only Runna's "Run 8k" generated for next Tuesday

User can manually add again if desired.
```

---

## 🎯 Key Benefits

### Simplicity
- ✅ **Single rule**: Calendar present? Don't generate pattern
- ✅ **No complex priority system**
- ✅ **Easy to understand**
- ✅ **Easy to debug**

### User Experience
- ✅ **Runna is source of truth** when connected
- ✅ **Pattern fills gaps** automatically
- ✅ **No duplicate activities** on same date
- ✅ **User can still add manual activities** anytime

### Technical
- ✅ **Minimal code changes**
- ✅ **No new database fields required** (optional)
- ✅ **Backward compatible**
- ✅ **Fast query** (just check calendar dates)

---

## 🤔 Trade-offs

### What You Lose
- ⚠️ **Can't have both** pattern and Runna for same date
- ⚠️ **Pattern always discarded** when Runna exists
- ⚠️ **User manual additions** on same date as Runna = 2 activities

### What You Gain
- ✅ **Simplicity**
- ✅ **Clear behavior**
- ✅ **No conflicts**
- ✅ **Pattern as pure fallback**

---

## 📋 Decision Matrix

| Scenario | With Pattern + Runna | Behavior |
|----------|----------------------|----------|
| Runna for date | ✅ Keep Runna | ❌ Discard pattern |
| No Runna for date | ⬜ Gap | ✅ Generate pattern |
| Manual + Runna | ✅ Both shown | Pattern irrelevant |
| Manual only | ✅ Keep manual | Pattern irrelevant |

---

## 🔄 Alternative: Allow Both (Optional)

If you want to allow pattern + Runna coexistence:

```typescript
// Check for calendar activities
const { data: calendarActivities } = await supabaseAdmin
  .from("training_activities")
  .select("date, activity_type")
  .eq("user_id", profile.user_id)
  .eq("is_from_calendar", true)
  .eq("is_actual", false)
  .gte("date", format(nextWeekStart, "yyyy-MM-dd"))
  .lte("date", format(addDays(nextWeekStart, 6), "yyyy-MM-dd"));

const calendarByDate = new Map();
(calendarActivities || []).forEach(a => {
  if (!calendarByDate.has(a.date)) {
    calendarByDate.set(a.date, []);
  }
  calendarByDate.get(a.date).push(a.activity_type);
});

// When generating
for (let i = 0; i < 7; i++) {
  const date = addDays(nextWeekStart, i);
  const dateStr = format(date, "yyyy-MM-dd");
  const pattern = weeklyPattern[i];
  const calendarActivities = calendarByDate.get(dateStr) || [];
  
  if (pattern && pattern.activities.length > 0) {
    for (const act of pattern.activities) {
      // Check if this activity type already exists from calendar
      const typeExists = calendarActivities.includes(act.activity_type);
      
      if (!typeExists) {
        // Only add if activity type not from calendar
        activities.push({...});
      } else {
        console.log(`Skipping ${act.activity_type} on ${dateStr} - exists in Runna`);
      }
    }
  }
}
```

**Result:** Run from Runna + Strength from Pattern can coexist.

---

## ✅ Recommended Approach

### **Simple Discard (RECOMMENDED)**

**Implementation:**
1. ✅ Check which dates have Runna activities
2. ✅ Delete ALL pattern activities for next week
3. ✅ Generate pattern ONLY for dates without Runna
4. ✅ Done!

**Code Changes:**
- Update `generate-training-activities/index.ts` (60 lines)
- No database migration needed (optional `source` field for clarity)
- No UI changes needed

**Result:**
```
Runna Calendar = Primary
Pattern Generator = Fallback for gaps
User Manual = Anytime additions
```

---

## 🚀 Next Steps

1. **Update generate-training-activities function** (code above)
2. **Test with:**
   - User with full Runna calendar
   - User with partial Runna calendar
   - User with no Runna calendar
3. **Optional:** Add UI indicator showing "Runna" vs "Pattern"
4. **Deploy**

**Estimated time:** 30 minutes

Ready to implement? This is much cleaner than the complex priority system! 🎉

