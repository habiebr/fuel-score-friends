# 🏃 Runna Calendar Integration - Clear Implementation

**Goal:** User pastes Runna ICS URL → Activities auto-populate as "from Runna"  
**Clarity:** `is_from_runna=TRUE` makes it explicit!

---

## 📊 **Database Schema (Clear Naming):**

### **profiles table:**
```sql
runna_calendar_url      TEXT      -- e.g., https://cal.runna.com/xxx.ics
runna_last_synced_at    TIMESTAMP -- When was it last synced?
```

### **training_activities table:**
```sql
is_from_runna    BOOLEAN  -- TRUE = Runna, FALSE = Manual/Pattern
is_actual        BOOLEAN  -- TRUE = Wearable data, FALSE = Planned
```

**Clear separation:**
- `is_from_runna=TRUE` → Came from Runna calendar
- `is_from_runna=FALSE` → Manual or pattern-generated
- `is_actual=TRUE` → Actual workout from Google Fit/Strava
- `is_actual=FALSE` → Planned workout

---

## 🎯 **Activity Sources (Crystal Clear):**

| Source | is_from_runna | is_actual | Description |
|--------|---------------|-----------|-------------|
| **Runna Calendar** | `TRUE` | `FALSE` | Imported from Runna ICS |
| **Pattern Generator** | `FALSE` | `FALSE` | Auto-generated from user pattern |
| **Manual Entry** | `FALSE` | `FALSE` | User typed it manually |
| **Google Fit** | `FALSE` | `TRUE` | Actual workout from wearable |
| **Strava** | `FALSE` | `TRUE` | Actual workout from Strava |

---

## 🔧 **Implementation:**

### **1. Database Migration** ✅
```sql
-- File: supabase/migrations/20251017000003_add_runna_calendar_support.sql

ALTER TABLE profiles
ADD COLUMN runna_calendar_url TEXT,
ADD COLUMN runna_last_synced_at TIMESTAMPTZ;

ALTER TABLE training_activities
ADD COLUMN is_from_runna BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_training_activities_runna
ON training_activities(user_id, date, is_from_runna)
WHERE is_from_runna = TRUE;
```

### **2. Edge Function: `sync-runna-calendar`**
```typescript
// supabase/functions/sync-runna-calendar/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { user_id, calendar_url } = await req.json();
    
    // 1. Fetch ICS file from Runna
    const icsResponse = await fetch(calendar_url);
    const icsText = await icsResponse.text();
    
    // 2. Parse ICS
    const events = parseICS(icsText);
    
    // 3. Delete old Runna activities (for refresh)
    await supabase
      .from('training_activities')
      .delete()
      .eq('user_id', user_id)
      .eq('is_from_runna', true)  // ✅ Only delete Runna activities
      .gte('date', new Date().toISOString().split('T')[0]);
    
    // 4. Insert new Runna activities
    const activities = events.map(event => ({
      user_id,
      date: event.date,
      activity_type: event.summary, // e.g., "Tempo run"
      duration_minutes: parseDuration(event.duration),
      distance_km: parseDistance(event.description),
      notes: event.description,
      is_from_runna: true,  // ✅ Mark as from Runna
      is_actual: false
    }));
    
    await supabase
      .from('training_activities')
      .insert(activities);
    
    // 5. Update sync timestamp
    await supabase
      .from('profiles')
      .update({ 
        runna_calendar_url: calendar_url,
        runna_last_synced_at: new Date().toISOString()
      })
      .eq('user_id', user_id);
    
    return new Response(JSON.stringify({
      success: true,
      activities_synced: activities.length
    }));
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500
    });
  }
});

function parseICS(icsText: string) {
  const events = [];
  const lines = icsText.split('\n');
  let currentEvent = null;
  
  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (currentEvent) events.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('DTSTART:')) {
        currentEvent.date = line.split(':')[1].substring(0, 8); // YYYYMMDD
      } else if (line.startsWith('SUMMARY:')) {
        currentEvent.summary = line.split(':')[1].trim();
      } else if (line.startsWith('DESCRIPTION:')) {
        currentEvent.description = line.split(':')[1].trim();
      } else if (line.startsWith('X-WORKOUT-ESTIMATED-DURATION:')) {
        currentEvent.duration = line.split(':')[1].trim();
      }
    }
  }
  
  return events;
}
```

### **3. Update Pattern Generator**
```typescript
// supabase/functions/generate-training-activities/index.ts

// Check which dates have Runna activities
const { data: runnaActivities } = await supabase
  .from('training_activities')
  .select('date')
  .eq('user_id', user_id)
  .eq('is_from_runna', true)  // ✅ Explicit: from Runna
  .eq('is_actual', false)
  .gte('date', nextWeekStart)
  .lte('date', nextWeekEnd);

const runnaDates = new Set(runnaActivities.map(a => a.date));

// Generate pattern activities, skip Runna dates
for (let i = 0; i < 7; i++) {
  const date = addDays(nextWeekStart, i);
  const dateStr = format(date, 'yyyy-MM-dd');
  
  // ✅ Skip if Runna has this date
  if (runnaDates.has(dateStr)) {
    console.log(`Skipping ${dateStr} - has Runna activity`);
    continue;
  }
  
  // Generate pattern activity
  activities.push({
    user_id,
    date: dateStr,
    activity_type: pattern.activity_type,
    duration_minutes: pattern.duration,
    is_from_runna: false,  // ✅ Not from Runna
    is_actual: false
  });
}
```

### **4. Frontend UI**
```typescript
// src/pages/AppIntegrations.tsx

<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Calendar className="h-5 w-5" />
      Runna Training Calendar
    </CardTitle>
    <CardDescription>
      Import your Runna training plan automatically
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Connection Status */}
    {runnaUrl ? (
      <div className="flex items-center gap-2 text-sm text-success">
        <Check className="h-4 w-4" />
        <span>Connected</span>
        <span className="text-muted-foreground">
          Last synced: {formatDistanceToNow(runnaLastSync)} ago
        </span>
      </div>
    ) : (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span>Not connected</span>
      </div>
    )}
    
    {/* ICS URL Input */}
    <div className="space-y-2">
      <Label htmlFor="runna-url">Runna Calendar URL (ICS)</Label>
      <Input
        id="runna-url"
        placeholder="https://cal.runna.com/xxx.ics"
        value={runnaUrl}
        onChange={(e) => setRunnaUrl(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        Find this in Runna app → Settings → Export Calendar
      </p>
    </div>
    
    {/* Actions */}
    <div className="flex gap-2">
      <Button 
        onClick={handleSyncRunna}
        disabled={!runnaUrl || isSyncing}
      >
        {isSyncing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Syncing...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-2" />
            {runnaUrl ? 'Sync Now' : 'Connect'}
          </>
        )}
      </Button>
      
      {runnaUrl && (
        <Button 
          variant="outline"
          onClick={handleDisconnectRunna}
        >
          Disconnect
        </Button>
      )}
    </div>
  </CardContent>
</Card>
```

---

## 📊 **Clear Examples:**

### **Example 1: Full Runna Week**
```
Pattern: Mon-Rest, Tue-Run 5k, Wed-Run 5k, Thu-Rest, Fri-Run 8k, Sat-Long 15k, Sun-Rest
Runna:   Mon-Rest, Tue-Run 8k, Wed-Tempo, Thu-Run 5k, Fri-Rest, Sat-Long 18k, Sun-Rest

Result (Database):
Monday    → is_from_runna=TRUE  (Runna)
Tuesday   → is_from_runna=TRUE  (Runna)
Wednesday → is_from_runna=TRUE  (Runna)
Thursday  → is_from_runna=TRUE  (Runna)
Friday    → is_from_runna=TRUE  (Runna)
Saturday  → is_from_runna=TRUE  (Runna)
Sunday    → is_from_runna=TRUE  (Runna)

Pattern activities generated: 0 (all from Runna)
```

### **Example 2: Partial Runna (Most Common)**
```
Pattern: Mon-Rest, Tue-Run 5k, Wed-Run 5k, Thu-Rest, Fri-Run 8k, Sat-Long 15k, Sun-Rest
Runna:   (only 3 days) Tue-Run 8k, Thu-Run 5k, Sat-Long 18k

Result (Database):
Monday    → is_from_runna=FALSE (Pattern fills gap)
Tuesday   → is_from_runna=TRUE  (Runna)
Wednesday → is_from_runna=FALSE (Pattern fills gap)
Thursday  → is_from_runna=TRUE  (Runna)
Friday    → is_from_runna=FALSE (Pattern fills gap)
Saturday  → is_from_runna=TRUE  (Runna)
Sunday    → is_from_runna=FALSE (Pattern fills gap)

Pattern activities: 4
Runna activities: 3
```

### **Example 3: With Actual Workouts**
```
Planned:
  Monday → is_from_runna=TRUE, is_actual=FALSE (Runna plans 8k)

After workout:
  Monday → is_from_runna=TRUE, is_actual=FALSE (Runna planned 8k)
  Monday → is_from_runna=FALSE, is_actual=TRUE (Actually ran 7.5k per Google Fit)
  
Both shown! Planned vs Actual
```

---

## 🔍 **Query Examples:**

### **Get Runna activities only:**
```sql
SELECT * FROM training_activities
WHERE user_id = 'xxx'
AND is_from_runna = TRUE
AND is_actual = FALSE;
```

### **Get pattern activities only:**
```sql
SELECT * FROM training_activities
WHERE user_id = 'xxx'
AND is_from_runna = FALSE
AND is_actual = FALSE;
```

### **Get actual workouts:**
```sql
SELECT * FROM training_activities
WHERE user_id = 'xxx'
AND is_actual = TRUE;
```

### **Get all planned workouts (Runna + Pattern):**
```sql
SELECT * FROM training_activities
WHERE user_id = 'xxx'
AND is_actual = FALSE
ORDER BY date, is_from_runna DESC; -- Runna first
```

---

## ✅ **Benefits of Clear Naming:**

| Naming | Clarity |
|--------|---------|
| `is_from_runna` | ✅ "This is from Runna" - crystal clear! |
| `is_from_calendar` | ❌ "Which calendar?" - ambiguous |
| `runna_calendar_url` | ✅ "Runna's calendar URL" - explicit |
| `calendar_url` | ❌ "Any calendar?" - generic |

---

## 🎯 **Summary:**

**Clear Sources:**
- `is_from_runna=TRUE` → From Runna calendar
- `is_from_runna=FALSE` → Manual or pattern
- `is_actual=TRUE` → From wearable (Google Fit/Strava)

**Clear Flow:**
1. User pastes Runna ICS URL
2. Backend syncs: `is_from_runna=TRUE`
3. Pattern fills gaps: `is_from_runna=FALSE`
4. Wearables track actual: `is_actual=TRUE`

**No confusion!** Every activity source is explicit. 🎉

---

Ready to implement with clear naming? 🚀

