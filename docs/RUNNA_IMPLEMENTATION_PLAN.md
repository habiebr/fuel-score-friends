# 🏃 Runna ICS Integration - Implementation Plan

**Date:** October 17, 2025  
**Goal:** Allow users to paste Runna ICS URL → Auto-populate weekly training plan

---

## 📋 **What We Need to Build:**

### 1. **Frontend: ICS URL Input** (20 min)
- Add input field on App Integrations page
- "Paste your Runna calendar link here"
- Button: "Connect Calendar"
- Show sync status (last synced, next activities)

### 2. **Backend: ICS Parser** (40 min)
- Edge function: `parse-runna-calendar`
- Fetch ICS file from URL
- Parse VEVENT entries
- Extract: date, activity_type, duration, description
- Store in `training_activities` with `is_from_calendar=true`

### 3. **Database** ✅ (Already Done!)
- Migration exists: `20251016000000_add_calendar_integration.sql`
- Adds `calendar_url` to profiles
- Adds `is_from_calendar` to training_activities

### 4. **Conflict Resolution** (10 min)
- Update `generate-training-activities`
- Skip pattern generation for dates with calendar activities
- Pattern fills gaps only

---

## 🎯 **User Flow:**

```
1. User goes to Settings → Integrations
2. Finds "Runna Calendar" section
3. Pastes ICS URL: https://cal.runna.com/xxx.ics
4. Clicks "Connect Calendar"
5. Backend fetches & parses ICS
6. Training activities populated for next 4 weeks
7. Pattern generator skips dates with Runna activities
8. User sees unified calendar with both sources
```

---

## 🔧 **Implementation Steps:**

### Step 1: Apply Database Migration
```sql
-- Already created: supabase/migrations/20251016000000_add_calendar_integration.sql
-- Adds calendar_url to profiles
-- Adds is_from_calendar to training_activities
```

### Step 2: Create ICS Parser Edge Function
```typescript
// supabase/functions/parse-runna-calendar/index.ts
// - Fetch ICS from URL
// - Parse with ical.js or custom parser
// - Extract workout details
// - Store in training_activities
```

### Step 3: Update Frontend
```typescript
// src/pages/AppIntegrations.tsx
// Add Runna Calendar section
// Input for ICS URL
// Sync button
// Status display
```

### Step 4: Update Pattern Generator
```typescript
// supabase/functions/generate-training-activities/index.ts
// Skip dates that have is_from_calendar=true
// Pattern fills gaps only
```

---

## 📊 **ICS Format (from your example):**

```ics
BEGIN:VEVENT
DTSTART:20251028T190000Z
DTEND:20251028T200000Z
SUMMARY:Tempo run
DESCRIPTION:Warm up for 10 minutes, ...
X-WORKOUT-ESTIMATED-DURATION:PT1H
UID:...
END:VEVENT
```

**We extract:**
- `DTSTART` → date & time
- `SUMMARY` → activity_type (e.g., "Tempo run")
- `DESCRIPTION` → notes
- `X-WORKOUT-ESTIMATED-DURATION` → duration_minutes
- Calculate distance if mentioned in description

---

## ✅ **Conflict Resolution Strategy:**

**Simple Rule:** If Runna has activity for a date → Skip pattern generator

```
Monday:
  - Runna: ✅ Tempo run 8km
  - Pattern: ❌ Skipped
  - Result: Tempo run 8km (from Runna)

Tuesday:
  - Runna: ❌ No activity
  - Pattern: ✅ Easy run 5km
  - Result: Easy run 5km (from Pattern)

Wednesday:
  - Runna: ✅ Intervals
  - Manual: ✅ Strength training
  - Pattern: ❌ Skipped
  - Result: Both Intervals + Strength (from Runna + Manual)
```

---

## 🧪 **Testing Plan:**

1. **Test with full calendar** (all 7 days)
   - Pattern should generate 0 activities

2. **Test with partial calendar** (3 days)
   - Pattern should fill 4 gap days

3. **Test with no calendar**
   - Pattern should generate all 7 days

4. **Test calendar update**
   - Change ICS URL
   - Should replace old Runna activities

5. **Test manual additions**
   - User adds manual activity
   - Should coexist with Runna/Pattern

---

## 📁 **Files to Create/Modify:**

### New Files:
- `supabase/functions/parse-runna-calendar/index.ts` ← ICS parser
- `src/components/RunnaCalendarIntegration.tsx` ← UI component

### Modified Files:
- `src/pages/AppIntegrations.tsx` ← Add Runna section
- `supabase/functions/generate-training-activities/index.ts` ← Skip logic

### Existing:
- `supabase/migrations/20251016000000_add_calendar_integration.sql` ✅

---

## ⏱️ **Time Estimate:**

| Task | Time |
|------|------|
| Apply migration | 5 min |
| Create ICS parser edge function | 40 min |
| Update frontend UI | 20 min |
| Update pattern generator | 10 min |
| Testing | 15 min |
| **Total** | **90 min** |

---

## 🚀 **Deploy Steps:**

1. Apply database migration
2. Deploy edge function (`parse-runna-calendar`)
3. Update and deploy frontend
4. Update and deploy pattern generator
5. Test with your Runna calendar

---

## 💡 **Optional Enhancements (Future):**

- Auto-refresh calendar daily
- Show calendar sync status
- Handle calendar errors gracefully
- Support multiple calendar sources
- Calendar disconnect option

---

## ✅ **Ready to Implement?**

The architecture is solid and simple:
- ✅ User pastes ICS URL
- ✅ Backend fetches and parses
- ✅ Stores as calendar activities
- ✅ Pattern fills gaps
- ✅ User sees unified view

**Start with Step 1?** Let's apply the migration and build the ICS parser! 🏗️

