# 🚀 Runna Calendar Integration - Quick Start Guide

## ✅ Yes, We Can Sync with Runna!

Based on analysis of Runna's ICS calendar format, **full integration is possible and straightforward**.

---

## 📋 What We Can Extract from Runna

From the example calendar (`https://cal.runna.com/b25a39a81e9c65ab7b0b30489398cfd3.ics`):

✅ **Workout Date** (from DTSTART)  
✅ **Workout Type** (Walk Run, Easy Run, Tempo, etc.)  
✅ **Distance** (extracted from summary: "• 2.3km")  
✅ **Duration** (from `X-WORKOUT-ESTIMATED-DURATION` field - 1800 seconds = 30 mins)  
✅ **Intensity** (parsed from description: "conversational pace" = low)  
✅ **Detailed Instructions** (warm up, intervals, cool down)  
✅ **Week Number** (from UID: `plan_week_1_WALK_RUN_0`)  
✅ **User Timezone** (from `X-USER-TIMEZONE: Australia/Melbourne`)  

---

## 🎯 Benefits for Your App

### 1. **Automatic Training Plan Import**
- Users connect Runna calendar once
- All planned workouts sync automatically
- No manual entry needed

### 2. **Smart Nutrition Planning**
- Adjust calorie targets based on upcoming workouts
- Pre-training fueling recommendations
- Post-training recovery nutrition

### 3. **Better Scoring**
- Compare planned vs actual workouts
- Account for training load in nutrition scoring
- Track training plan adherence

### 4. **Progressive Overload Tracking**
- See weekly progression (2.3km → 2.6km → 3.3km)
- Monitor training volume
- Prevent overtraining with proper fueling

---

## 🔧 Implementation Status

### ✅ Already Built (Ready to Use)
- `training_activities` table exists
- Training UI for viewing/editing workouts
- Google Fit & Strava integration patterns to follow
- Edge Functions infrastructure

### 📝 To Build (Phase 1 - MVP)
- [ ] Database migration (calendar_integrations table)
- [ ] Edge function for ICS parsing
- [ ] Frontend hook (useCalendarSync)
- [ ] UI component for calendar connection
- [ ] Deploy and test

**Estimated Time:** 4-6 hours for MVP

---

## 📊 Sample Data from Runna

### Example Event
```
Date: 2025-10-20
Workout: My First Run
Type: Walk Run
Distance: 2.3 km
Duration: 25-30 mins (1800 seconds)
Instructions:
  - 5 mins walking warm up
  - Repeat 6x: 1 min running, 1.5 mins walking
  - 5 mins walking cool down
Intensity: Conversational pace (low)
```

**Maps to your database:**
```sql
INSERT INTO training_activities (
  user_id,
  date,
  activity_type,
  distance_km,
  duration_minutes,
  intensity,
  estimated_calories,
  notes,
  is_from_calendar,
  external_id,
  calendar_integration_id
) VALUES (
  'user-uuid',
  '2025-10-20',
  'run',
  2.3,
  30,
  'low',
  138, -- calculated: 2.3km * 60 * 0.8 (low intensity)
  'My First Run: 5 mins walking warm up...',
  true,
  'UPCOMING_PLAN_WORKOUT-f99400e5-5fa2-477c-804f-31cd899aed7e_plan_week_1_WALK_RUN_0',
  'calendar-integration-uuid'
);
```

---

## 🏗️ Architecture

```
Runna ICS Calendar URL
         ↓
[Edge Function: sync-calendar-ics]
         ↓
Parse ICS events (ical.js library)
         ↓
Map to training_activities schema
         ↓
Upsert to database
         ↓
Display in Training page
         ↓
Use for nutrition planning
```

---

## 🎨 User Experience

### Setup Flow (One-Time)
1. User goes to **Integrations** page
2. Clicks **"Connect Training Calendar"**
3. Selects **"Runna"** from provider dropdown
4. Pastes their Runna calendar URL
5. Clicks **"Connect"**
6. System syncs all future workouts
7. Workouts appear in **Training** page

### Ongoing Sync
- **Manual**: Click "Sync" button to refresh
- **Auto** (future): Daily cron job syncs calendars
- **Conflict handling**: Calendar events can be edited, marked as "custom edited"

---

## 📱 UI Mockup

```
┌─────────────────────────────────────┐
│  🗓️  Training Calendar              │
├─────────────────────────────────────┤
│                                     │
│  Connected Calendars                │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 🏃 Runna Training Plan        │ │
│  │ Last synced: 2 hours ago      │ │
│  │                               │ │
│  │ [🔄 Sync]  [⚙️]  [🗑️ Remove] │ │
│  └───────────────────────────────┘ │
│                                     │
│  [+ Connect Training Calendar]      │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔐 Security & Privacy

### Calendar URL Privacy
- ✅ URLs stored encrypted in database
- ✅ RLS policies prevent cross-user access
- ✅ URLs never logged or exposed in errors
- ✅ User can disconnect anytime

### Data Ownership
- ✅ User controls when to sync
- ✅ Can edit calendar-imported workouts
- ✅ Can delete calendar connection
- ✅ Deleting connection doesn't delete workouts (becomes manual)

---

## 🧪 Testing Checklist

### With Your Calendar
- [ ] Fetch calendar URL successfully
- [ ] Parse all events (no errors)
- [ ] Extract distance correctly (2.3km, 3.7km, etc.)
- [ ] Calculate duration from X-WORKOUT-ESTIMATED-DURATION
- [ ] Detect "run" activity type correctly
- [ ] Set intensity to "low" for conversational pace
- [ ] Store all events in training_activities table
- [ ] No duplicates on re-sync
- [ ] Handle calendar URL changes
- [ ] Error handling for invalid URLs

---

## 📦 Dependencies Needed

Add to `package.json`:
```json
{
  "dependencies": {
    "ical.js": "^2.0.1"
  }
}
```

For Deno edge function:
```typescript
import ICAL from 'https://esm.sh/ical.js@2'
```

---

## 🎯 Next Steps

### Phase 1: MVP (This Sprint)
1. ✅ Analyze Runna ICS format (DONE)
2. Apply database migration
3. Create sync-calendar-ics edge function
4. Build useCalendarSync hook
5. Add CalendarIntegrationCard component
6. Test with your Runna calendar
7. Deploy to production

### Phase 2: Enhancement (Next Sprint)
- Auto-sync via cron job (daily)
- Support TrainingPeaks calendars
- Conflict resolution UI
- Calendar preview before import
- Sync history/logs

### Phase 3: Advanced (Future)
- Two-way sync (mark workouts complete in Runna)
- Multiple calendars (Runna + TrainingPeaks)
- Calendar merge/priority rules
- Export workouts to calendar

---

## 💡 Key Insights

### Why This Is Easy
1. **Standard Format**: Runna uses standard ICS (no proprietary API)
2. **Rich Data**: Includes duration, distance, instructions
3. **Stable UIDs**: Unique IDs for each event (prevents duplicates)
4. **Timezone Support**: Custom field for user timezone
5. **No Auth Needed**: Public calendar URL (user controls sharing)

### Why This Is Valuable
1. **Saves Time**: No manual workout entry
2. **Better Planning**: Nutrition adjusts to training plan
3. **Compliance**: Track if user follows their plan
4. **Motivation**: See upcoming workouts
5. **Integration**: Connect training with nutrition seamlessly

---

## 🎉 Conclusion

**YES - You can absolutely sync with Runna calendars!**

The integration is:
- ✅ **Feasible** - Standard ICS format
- ✅ **Straightforward** - Clear data structure  
- ✅ **Valuable** - Enhances your nutrition app
- ✅ **Fast** - ~4-6 hours to MVP
- ✅ **Scalable** - Works for other calendar providers too

Ready to implement? See `RUNNA_ICS_INTEGRATION_PLAN.md` for detailed implementation guide.

