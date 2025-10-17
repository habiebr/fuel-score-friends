# 🏃 Runna ICS Calendar Integration - Implementation Plan

## 🎯 Overview

Runna provides shareable ICS (iCalendar) URLs that users can subscribe to. This integration will:

✅ Allow users to connect their Runna training calendar  
✅ Automatically sync training plans to `training_activities` table  
✅ Use training data for nutrition planning and scoring  
✅ Update automatically via scheduled sync  
✅ Support multiple calendar sources (Runna, TrainingPeaks, etc.)

---

## 📊 Current State Analysis

### Existing Infrastructure
- ✅ `training_activities` table exists with schema:
  - `date`, `activity_type`, `start_time`, `duration_minutes`, `distance_km`
  - `intensity`, `estimated_calories`, `notes`
- ✅ Training UI for manual entry (`src/pages/Training.tsx`)
- ✅ Google Fit & Strava integrations as reference patterns
- ✅ Edge Functions infrastructure for backend processing

### What's Needed
- ❌ ICS parsing library (not in package.json)
- ❌ Calendar URL storage in database
- ❌ ICS fetch & parse edge function
- ❌ UI for calendar connection
- ❌ Sync hook/service
- ❌ Event mapping logic (ICS → training_activities)

---

## 🏗️ Technical Architecture

### 1. ICS Calendar Format

ICS files contain calendar events in standard format:

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Runna//Training Plan//EN

BEGIN:VEVENT
UID:runna-event-12345
DTSTART:20251020T060000Z
DTEND:20251020T070000Z
SUMMARY:Easy Run - 5km
DESCRIPTION:Easy pace recovery run\nZone 2\nDuration: 30-35 mins
LOCATION:Outdoor
STATUS:CONFIRMED
END:VEVENT

BEGIN:VEVENT
UID:runna-event-12346
DTSTART:20251021
SUMMARY:Rest Day
DESCRIPTION:Active recovery - light stretching optional
END:VEVENT

END:VCALENDAR
```

### 2. Parsing Strategy

**ICS Parsing Library Options:**

| Library | Pros | Cons | Recommendation |
|---------|------|------|----------------|
| `ical.js` | Robust, well-maintained, good docs | Larger bundle | ⭐ **Best choice** |
| `node-ical` | Simple API, lightweight | Node-only, less features | Good for edge functions |
| `ical-parser` | Very lightweight | Limited features | Too basic |

**Recommended: `ical.js`** for comprehensive ICS support

### 3. Event Mapping Logic

Map ICS events to `training_activities`:

```typescript
ICS Event Field          → training_activities Field
─────────────────────────────────────────────────────
SUMMARY                  → activity_type (parsed) + notes
DTSTART                  → date + start_time
DTEND/DURATION          → duration_minutes
DESCRIPTION              → notes (extract distance, intensity)
UID                      → external_id (new field - for sync tracking)
```

**Activity Type Detection (from SUMMARY or DESCRIPTION):**
- Contains "run", "jog" → `activity_type: 'run'`
- Contains "rest", "recovery day" → `activity_type: 'rest'`
- Contains "strength", "weights", "gym" → `activity_type: 'strength'`
- Contains "cross", "bike", "swim", "cardio" → `activity_type: 'cardio'`
- Default → `activity_type: 'other'`

**Distance Extraction:**
- Regex: `/(\d+(?:\.\d+)?)\s*(km|mi|k)/i`
- Convert miles to km if needed

**Intensity Detection:**
- "easy", "recovery", "zone 1", "zone 2" → `intensity: 'low'`
- "tempo", "threshold", "zone 3", "zone 4" → `intensity: 'high'`
- Default → `intensity: 'moderate'`

---

## 📦 Database Schema Updates

### New Table: `calendar_integrations`

```sql
CREATE TABLE IF NOT EXISTS public.calendar_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'runna', 'trainingpeaks', 'final_surge', 'custom'
  calendar_url TEXT NOT NULL, -- ICS feed URL
  calendar_name TEXT, -- User-friendly name
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT, -- 'success', 'error', 'pending'
  sync_error TEXT, -- Error details if sync failed
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, calendar_url)
);

-- Indexes
CREATE INDEX idx_calendar_integrations_user ON calendar_integrations(user_id);
CREATE INDEX idx_calendar_integrations_active ON calendar_integrations(user_id, is_active);

-- RLS Policies
ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own calendars"
  ON calendar_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own calendars"
  ON calendar_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own calendars"
  ON calendar_integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own calendars"
  ON calendar_integrations FOR DELETE
  USING (auth.uid() = user_id);
```

### Update `training_activities` Table

Add fields to track external calendar sync:

```sql
-- Add columns to training_activities
ALTER TABLE training_activities 
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS calendar_integration_id UUID REFERENCES calendar_integrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_from_calendar BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Index for efficient sync lookups
CREATE INDEX IF NOT EXISTS idx_training_activities_external_id 
  ON training_activities(calendar_integration_id, external_id);

-- Unique constraint: one external event per calendar
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_activities_calendar_external_unique
  ON training_activities(calendar_integration_id, external_id)
  WHERE calendar_integration_id IS NOT NULL;
```

---

## 🔧 Implementation Components

### 1. Edge Function: `sync-calendar-ics`

**File**: `supabase/functions/sync-calendar-ics/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ICAL from 'https://esm.sh/ical.js@2'

interface SyncRequest {
  calendar_integration_id?: string; // Sync specific calendar
  user_id?: string; // Sync all user calendars (admin)
}

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const body = await req.json() as SyncRequest

    // Fetch active calendars to sync
    let query = supabase
      .from('calendar_integrations')
      .select('*')
      .eq('is_active', true)

    if (body.calendar_integration_id) {
      query = query.eq('id', body.calendar_integration_id)
    } else {
      query = query.eq('user_id', user.id)
    }

    const { data: calendars, error: calendarsError } = await query
    if (calendarsError) throw calendarsError

    const results = []

    for (const calendar of calendars || []) {
      try {
        // Fetch ICS file
        const icsResponse = await fetch(calendar.calendar_url)
        if (!icsResponse.ok) {
          throw new Error(`Failed to fetch calendar: ${icsResponse.statusText}`)
        }

        const icsText = await icsResponse.text()
        
        // Parse ICS
        const jcalData = ICAL.parse(icsText)
        const comp = new ICAL.Component(jcalData)
        const vevents = comp.getAllSubcomponents('vevent')

        const activities = []

        for (const vevent of vevents) {
          const event = new ICAL.Event(vevent)
          
          // Extract event data
          const uid = event.uid
          const summary = event.summary || ''
          const description = event.description || ''
          const startDate = event.startDate
          const endDate = event.endDate
          
          if (!startDate) continue

          // Calculate date and time
          const date = startDate.toJSDate().toISOString().split('T')[0]
          const startTime = startDate.hour !== undefined 
            ? `${String(startDate.hour).padStart(2, '0')}:${String(startDate.minute).padStart(2, '0')}`
            : null

          // Calculate duration
          let durationMinutes = 0
          if (endDate) {
            const diffMs = endDate.toJSDate().getTime() - startDate.toJSDate().getTime()
            durationMinutes = Math.round(diffMs / (1000 * 60))
          }

          // Parse activity type
          const activityType = detectActivityType(summary, description)
          
          // Parse distance
          const distanceKm = extractDistance(summary, description)
          
          // Parse intensity
          const intensity = detectIntensity(summary, description)
          
          // Estimate calories (using same logic as Training.tsx)
          const estimatedCalories = calculateCalories(activityType, durationMinutes, distanceKm, intensity)

          activities.push({
            user_id: calendar.user_id,
            calendar_integration_id: calendar.id,
            external_id: uid,
            is_from_calendar: true,
            date,
            start_time: startTime,
            activity_type: activityType,
            duration_minutes: durationMinutes || 30, // Default to 30 if not specified
            distance_km: distanceKm,
            intensity,
            estimated_calories: estimatedCalories,
            notes: description ? description.substring(0, 500) : summary,
            last_synced_at: new Date().toISOString()
          })
        }

        // Upsert activities (update existing, insert new)
        if (activities.length > 0) {
          const { error: upsertError } = await supabase
            .from('training_activities')
            .upsert(activities, {
              onConflict: 'calendar_integration_id,external_id',
              ignoreDuplicates: false
            })

          if (upsertError) throw upsertError
        }

        // Update calendar sync status
        await supabase
          .from('calendar_integrations')
          .update({
            last_synced_at: new Date().toISOString(),
            sync_status: 'success',
            sync_error: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', calendar.id)

        results.push({
          calendar_id: calendar.id,
          status: 'success',
          activities_synced: activities.length
        })

      } catch (err) {
        // Update calendar with error
        await supabase
          .from('calendar_integrations')
          .update({
            sync_status: 'error',
            sync_error: err.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', calendar.id)

        results.push({
          calendar_id: calendar.id,
          status: 'error',
          error: err.message
        })
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Calendar sync error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// Helper functions
function detectActivityType(summary: string, description: string): string {
  const text = `${summary} ${description}`.toLowerCase()
  
  if (/\b(run|jog|running)\b/i.test(text)) return 'run'
  if (/\b(rest|recovery day|off)\b/i.test(text)) return 'rest'
  if (/\b(strength|weights|gym|resistance)\b/i.test(text)) return 'strength'
  if (/\b(bike|cycle|swim|cross|cardio|hiit)\b/i.test(text)) return 'cardio'
  
  return 'other'
}

function extractDistance(summary: string, description: string): number | null {
  const text = `${summary} ${description}`
  const match = text.match(/(\d+(?:\.\d+)?)\s*(km|mi|k|mile)/i)
  
  if (match) {
    const value = parseFloat(match[1])
    const unit = match[2].toLowerCase()
    
    // Convert miles to km
    if (unit.includes('mi')) {
      return Math.round(value * 1.60934 * 100) / 100
    }
    return value
  }
  
  return null
}

function detectIntensity(summary: string, description: string): string {
  const text = `${summary} ${description}`.toLowerCase()
  
  if (/\b(easy|recovery|zone [12]|light)\b/i.test(text)) return 'low'
  if (/\b(tempo|threshold|zone [45]|hard|race)\b/i.test(text)) return 'high'
  
  return 'moderate'
}

function calculateCalories(activityType: string, duration: number, distance: number | null, intensity: string): number {
  const caloriesPerMinute: Record<string, number> = {
    rest: 0,
    run: 10,
    strength: 6,
    cardio: 8,
    other: 7,
  }
  
  const mult: Record<string, number> = { 
    low: 0.8, 
    moderate: 1.0, 
    high: 1.2 
  }
  
  if (activityType === 'run' && distance && distance > 0) {
    return Math.round(60 * distance * mult[intensity])
  }
  
  return Math.round((caloriesPerMinute[activityType] || 7) * duration * mult[intensity])
}
```

### 2. Frontend Hook: `useCalendarSync`

**File**: `src/hooks/useCalendarSync.ts`

```typescript
import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export interface CalendarIntegration {
  id: string
  user_id: string
  provider: 'runna' | 'trainingpeaks' | 'final_surge' | 'custom'
  calendar_url: string
  calendar_name: string | null
  is_active: boolean
  last_synced_at: string | null
  sync_status: string | null
  sync_error: string | null
}

export function useCalendarSync() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const getCalendars = async (): Promise<CalendarIntegration[]> => {
    if (!user) return []

    const { data, error } = await supabase
      .from('calendar_integrations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  const addCalendar = async (
    provider: string,
    calendarUrl: string,
    calendarName?: string
  ): Promise<CalendarIntegration> => {
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('calendar_integrations')
      .insert({
        user_id: user.id,
        provider,
        calendar_url: calendarUrl,
        calendar_name: calendarName,
        is_active: true
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  const removeCalendar = async (calendarId: string): Promise<void> => {
    const { error } = await supabase
      .from('calendar_integrations')
      .delete()
      .eq('id', calendarId)
      .eq('user_id', user!.id)

    if (error) throw error
  }

  const syncCalendar = async (calendarId?: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated')

    setSyncing(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) throw new Error('No auth token')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-calendar-ics`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ calendar_integration_id: calendarId })
        }
      )

      if (!response.ok) {
        throw new Error('Calendar sync failed')
      }

      const result = await response.json()
      return result
    } finally {
      setSyncing(false)
    }
  }

  const toggleCalendar = async (calendarId: string, isActive: boolean): Promise<void> => {
    const { error } = await supabase
      .from('calendar_integrations')
      .update({ is_active: isActive })
      .eq('id', calendarId)
      .eq('user_id', user!.id)

    if (error) throw error
  }

  return {
    getCalendars,
    addCalendar,
    removeCalendar,
    syncCalendar,
    toggleCalendar,
    loading,
    syncing
  }
}
```

### 3. UI Component: Calendar Integration Card

**File**: `src/components/CalendarIntegrationCard.tsx`

```typescript
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, Link2, RefreshCw, Trash2, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useCalendarSync } from '@/hooks/useCalendarSync'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function CalendarIntegrationCard() {
  const { toast } = useToast()
  const { getCalendars, addCalendar, removeCalendar, syncCalendar, syncing } = useCalendarSync()
  const [calendars, setCalendars] = useState<any[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [provider, setProvider] = useState<string>('runna')
  const [calendarUrl, setCalendarUrl] = useState('')
  const [calendarName, setCalendarName] = useState('')

  useEffect(() => {
    loadCalendars()
  }, [])

  const loadCalendars = async () => {
    try {
      const data = await getCalendars()
      setCalendars(data)
    } catch (error) {
      console.error('Failed to load calendars:', error)
    }
  }

  const handleAddCalendar = async () => {
    try {
      await addCalendar(provider, calendarUrl, calendarName || undefined)
      toast({
        title: 'Calendar Added',
        description: 'Your training calendar has been connected successfully!'
      })
      setShowAddForm(false)
      setCalendarUrl('')
      setCalendarName('')
      loadCalendars()
    } catch (error) {
      toast({
        title: 'Failed to Add Calendar',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  const handleSync = async (calendarId: string) => {
    try {
      await syncCalendar(calendarId)
      toast({
        title: 'Sync Complete',
        description: 'Your training calendar has been synced!'
      })
      loadCalendars()
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  const handleRemove = async (calendarId: string) => {
    try {
      await removeCalendar(calendarId)
      toast({
        title: 'Calendar Removed',
        description: 'Calendar connection has been removed.'
      })
      loadCalendars()
    } catch (error) {
      toast({
        title: 'Failed to Remove Calendar',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Training Calendar
        </CardTitle>
        <CardDescription>
          Connect your Runna or other training calendar to automatically sync workouts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing calendars */}
        {calendars.map((cal) => (
          <div key={cal.id} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <div className="font-medium">{cal.calendar_name || cal.provider}</div>
              <div className="text-sm text-muted-foreground">
                {cal.last_synced_at
                  ? `Last synced: ${new Date(cal.last_synced_at).toLocaleString()}`
                  : 'Not synced yet'}
              </div>
              {cal.sync_status === 'error' && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{cal.sync_error}</AlertDescription>
                </Alert>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSync(cal.id)}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRemove(cal.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {/* Add calendar form */}
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} className="w-full">
            <Link2 className="h-4 w-4 mr-2" />
            Connect Training Calendar
          </Button>
        )}

        {showAddForm && (
          <div className="space-y-4 p-4 border rounded-lg">
            <div>
              <Label>Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="runna">Runna</SelectItem>
                  <SelectItem value="trainingpeaks">TrainingPeaks</SelectItem>
                  <SelectItem value="final_surge">Final Surge</SelectItem>
                  <SelectItem value="custom">Custom ICS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Calendar URL (ICS link)</Label>
              <Input
                type="url"
                placeholder="https://..."
                value={calendarUrl}
                onChange={(e) => setCalendarUrl(e.target.value)}
              />
            </div>

            <div>
              <Label>Calendar Name (Optional)</Label>
              <Input
                placeholder="My Marathon Training"
                value={calendarName}
                onChange={(e) => setCalendarName(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAddCalendar} className="flex-1">
                Add Calendar
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddForm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                <strong>How to get your calendar URL:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li><strong>Runna:</strong> Settings → Calendar → Share → Copy ICS link</li>
                  <li><strong>TrainingPeaks:</strong> Calendar → Settings → Export → Copy ICS URL</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## 🔄 Sync Strategy

### Auto-Sync Options

1. **Manual Sync** (MVP)
   - User clicks "Sync" button in UI
   - Immediate feedback

2. **Scheduled Sync** (Future)
   - Cron job runs daily at midnight
   - Syncs all active calendars
   - Similar to Google Fit auto-sync

```sql
-- Cron job for daily calendar sync
SELECT cron.schedule(
  'sync-all-calendars-daily',
  '0 0 * * *', -- Daily at midnight
  $$
  SELECT net.http_post(
    url := 'https://[PROJECT].supabase.co/functions/v1/sync-calendar-ics',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

3. **Webhook Sync** (Future Enhancement)
   - If calendar provider supports webhooks
   - Real-time updates when events change

---

## 📋 Implementation Checklist

### Phase 1: Core Integration (MVP)
- [ ] Add `ical.js` to package.json
- [ ] Create database migration for `calendar_integrations` table
- [ ] Update `training_activities` table with calendar fields
- [ ] Create `sync-calendar-ics` edge function
- [ ] Deploy edge function to Supabase
- [ ] Create `useCalendarSync` hook
- [ ] Create `CalendarIntegrationCard` component
- [ ] Add component to AppIntegrations page
- [ ] Test with Runna calendar URL
- [ ] Update TypeScript types

### Phase 2: UI Enhancement
- [ ] Add calendar status indicators
- [ ] Show sync history/logs
- [ ] Conflict resolution UI (calendar vs manual edits)
- [ ] Bulk delete calendar activities
- [ ] Calendar preview before sync

### Phase 3: Advanced Features
- [ ] Auto-sync via cron job
- [ ] Multiple calendar support
- [ ] Calendar priority/merge rules
- [ ] Activity mapping customization
- [ ] Export to calendar (reverse sync)

---

## ⚠️ Edge Cases & Considerations

### 1. **Conflict Resolution**
- **Problem**: User manually edits calendar-synced activity
- **Solution**: Add `is_edited` flag, skip overwriting edited activities

### 2. **Duplicate Detection**
- **Problem**: Same workout from multiple sources (Runna + Google Fit)
- **Solution**: Match by date+time+activity, prefer actual over planned

### 3. **Calendar URL Expiration**
- **Problem**: ICS URL might change or expire
- **Solution**: Detect 404/401 errors, notify user to update URL

### 4. **Privacy & Security**
- **Problem**: Calendar URLs might contain sensitive data
- **Solution**: Store encrypted, use RLS, don't log URLs

### 5. **Performance**
- **Problem**: Large calendars (1+ year of events)
- **Solution**: Only sync future + past 30 days by default

---

## 🧪 Testing Plan

### Manual Testing
1. Get Runna ICS URL from test account
2. Add calendar via UI
3. Verify activities appear in Training page
4. Test sync updates existing activities
5. Test removing calendar
6. Test invalid calendar URLs

### Edge Function Testing
```bash
# Test sync-calendar-ics locally
curl -X POST \
  http://localhost:54321/functions/v1/sync-calendar-ics \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"calendar_integration_id": "uuid-here"}'
```

---

## 📖 User Documentation

### How to Connect Runna Calendar

1. **Get Your Calendar URL from Runna:**
   - Open Runna app
   - Go to Settings → Calendar
   - Tap "Share Calendar"
   - Copy the ICS link

2. **Connect in Fuel Score:**
   - Go to Integrations page
   - Click "Training Calendar" section
   - Click "Connect Training Calendar"
   - Select "Runna" as provider
   - Paste your ICS URL
   - Give it a name (optional)
   - Click "Add Calendar"

3. **Sync Your Workouts:**
   - Click "Sync" button to fetch latest workouts
   - Your training plan will appear in Training page
   - Nutrition targets will adjust based on upcoming workouts

---

## 🎯 Success Metrics

- ✅ Successfully parse Runna ICS calendars
- ✅ Sync 90%+ of calendar events correctly
- ✅ Map activity types with 85%+ accuracy
- ✅ Sync completes in < 10 seconds
- ✅ Zero data loss or corruption
- ✅ User-friendly error messages

---

## 🚀 Next Steps

1. **Review this plan** with stakeholders
2. **Get Runna test account** with sample calendar
3. **Start with Phase 1 MVP** implementation
4. **Test thoroughly** before production
5. **Monitor adoption** and iterate

---

## 📚 References

- [ICS Specification (RFC 5545)](https://datatracker.ietf.org/doc/html/rfc5545)
- [ical.js Documentation](https://github.com/kewisch/ical.js)
- [Runna App](https://www.runna.com/)
- [iCalendar Format Examples](https://icalendar.org/validator.html)

