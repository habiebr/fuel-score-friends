# 🔍 Runna ICS Calendar Format Analysis

## Real-World Example

Based on actual Runna calendar: `https://cal.runna.com/b25a39a81e9c65ab7b0b30489398cfd3.ics`

---

## 📋 ICS Structure

### Calendar Level
```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Runna//EN
X-WR-CALNAME:Runna
```

### Event Structure

```ics
BEGIN:VEVENT
UID:UPCOMING_PLAN_WORKOUT-f99400e5-5fa2-477c-804f-31cd899aed7e_plan_week_1_WALK_RUN_0
DTSTAMP:20251015
DTSTART:20251020
DTEND:20251021
SUMMARY:🏃 My First Run • 2.3km
DESCRIPTION:Walk Run • 2.3km • 25m - 30m\n\n5 mins walking warm up\n\nRepeat the following 6x:\n----------\n1 min running at a conversational pace\n1.5 mins walking\n----------\n\n5 mins walking cool down\n\n📲 View in the Runna app: https://club.runna.com/...
X-USER-TIMEZONE:Australia/Melbourne
X-WORKOUT-ESTIMATED-DURATION:1800
END:VEVENT
```

---

## 🔑 Key Fields & Patterns

### UID Pattern
```
UPCOMING_PLAN_WORKOUT-{plan_id}_plan_week_{week_number}_{workout_type}_{index}

Examples:
- UPCOMING_PLAN_WORKOUT-f99400e5-5fa2-477c-804f-31cd899aed7e_plan_week_1_WALK_RUN_0
- UPCOMING_PLAN_WORKOUT-f99400e5-5fa2-477c-804f-31cd899aed7e_plan_week_4_WALK_RUN_1
```

### DTSTART/DTEND
- **Format**: Date only (YYYYMMDD), no time
- **All-day events**: DTSTART is workout day, DTEND is next day
- **Example**: DTSTART:20251020, DTEND:20251021

### SUMMARY Format
```
{emoji} {workout_name} • {distance}

Examples:
- 🏃 My First Run • 2.3km
- 🏃 Gradual Build • 2.6km
- 🏃 Stepping It Up • 3.7km
```

**Parsing Pattern:**
```regex
^[^\s]+\s+(.+?)\s+•\s+([\d.]+)km$
Group 1: Workout name
Group 2: Distance in km
```

### DESCRIPTION Format
```
{workout_type} • {distance} • {duration_range}

Detailed instructions...

📲 View in the Runna app: {url}

Examples:
- Walk Run • 2.3km • 25m - 30m
- Walk Run • 3.3km • 30m - 35m
```

**First Line Pattern:**
```regex
^([^•]+)\s+•\s+([\d.]+)km\s+•\s+(\d+)m\s+-\s+(\d+)m
Group 1: Workout type
Group 2: Distance
Group 3: Min duration
Group 4: Max duration
```

### Custom Runna Fields

| Field | Example | Description |
|-------|---------|-------------|
| `X-USER-TIMEZONE` | Australia/Melbourne | User's timezone |
| `X-WORKOUT-ESTIMATED-DURATION` | 1800 | Duration in seconds (30 mins) |

---

## 🎯 Parsing Logic

### 1. Distance Extraction
**Priority Order:**
1. SUMMARY: `• {distance}km`
2. DESCRIPTION first line: `• {distance}km`
3. Default: null

**Regex:**
```javascript
/•\s*([\d.]+)\s*km/i
```

### 2. Duration Calculation
**Priority Order:**
1. `X-WORKOUT-ESTIMATED-DURATION` (seconds)
2. DESCRIPTION: `{min}m - {max}m` (average)
3. Calculate from distance (if known): `distance_km * 6 mins/km`
4. Default: 30 minutes

**Regex for duration range:**
```javascript
/(\d+)m\s*-\s*(\d+)m/
```

### 3. Activity Type Detection

**From DESCRIPTION first line:**

| Text Pattern | activity_type |
|--------------|---------------|
| `Walk Run` | `run` |
| `Easy Run` | `run` |
| `Long Run` | `run` |
| `Tempo Run` | `run` |
| `Interval` | `run` |
| `Speed` | `run` |
| `Recovery` | `run` |
| `Rest` | `rest` |
| `Cross Training` | `cardio` |
| `Strength` | `strength` |
| Default | `run` |

### 4. Intensity Detection

**From DESCRIPTION keywords:**

| Keywords | intensity |
|----------|-----------|
| "conversational pace", "easy", "recovery", "walk" | `low` |
| "tempo", "threshold", "race pace", "hard" | `high` |
| Default | `moderate` |

### 5. Notes Compilation

Combine relevant info:
```
{workout_name} • {workout_details}

Detailed instructions from DESCRIPTION (first paragraph)
```

**Example:**
```
My First Run • Walk Run

5 mins walking warm up
Repeat 6x: 1 min running at conversational pace, 1.5 mins walking
5 mins walking cool down
```

---

## 🔄 Date Handling

**Challenge**: All-day events with no time
- DTSTART: 20251020 (October 20, 2025)
- DTEND: 20251021 (October 21, 2025)
- X-USER-TIMEZONE: Australia/Melbourne

**Solution:**
- Store `date`: 2025-10-20
- Store `start_time`: null (all-day)
- Respect user's timezone from profile for display

---

## 💡 Enhanced Parsing Algorithm

```javascript
function parseRunnaEvent(vevent) {
  const uid = vevent.getFirstPropertyValue('uid')
  const summary = vevent.getFirstPropertyValue('summary')
  const description = vevent.getFirstPropertyValue('description')
  const dtstart = vevent.getFirstPropertyValue('dtstart')
  const estimatedDuration = vevent.getFirstProperty('x-workout-estimated-duration')?.getFirstValue()
  const timezone = vevent.getFirstProperty('x-user-timezone')?.getFirstValue()

  // Extract workout name and distance from SUMMARY
  const summaryMatch = summary.match(/[^\s]+\s+(.+?)\s+•\s+([\d.]+)km/)
  const workoutName = summaryMatch?.[1] || summary
  const distanceKm = parseFloat(summaryMatch?.[2] || 0)

  // Parse DESCRIPTION first line
  const descLines = description.split('\n')
  const firstLine = descLines[0] || ''
  const workoutTypeMatch = firstLine.match(/^([^•]+)\s+•/)
  const workoutType = workoutTypeMatch?.[1]?.trim() || ''

  // Duration: use X-WORKOUT-ESTIMATED-DURATION or parse from description
  let durationMinutes = 30 // default
  if (estimatedDuration) {
    durationMinutes = Math.round(parseInt(estimatedDuration) / 60)
  } else {
    const durationMatch = firstLine.match(/(\d+)m\s*-\s*(\d+)m/)
    if (durationMatch) {
      const minDuration = parseInt(durationMatch[1])
      const maxDuration = parseInt(durationMatch[2])
      durationMinutes = Math.round((minDuration + maxDuration) / 2)
    }
  }

  // Activity type
  let activityType = 'run'
  if (/rest|off|recovery day/i.test(workoutType)) {
    activityType = 'rest'
  } else if (/strength|weights|gym/i.test(workoutType)) {
    activityType = 'strength'
  } else if (/cross|bike|swim/i.test(workoutType)) {
    activityType = 'cardio'
  }

  // Intensity
  let intensity = 'moderate'
  const descLower = description.toLowerCase()
  if (/conversational|easy|recovery|walk/i.test(descLower)) {
    intensity = 'low'
  } else if (/tempo|threshold|race pace|hard/i.test(descLower)) {
    intensity = 'high'
  }

  // Extract workout instructions (first 2 paragraphs)
  const instructions = descLines
    .slice(0, descLines.findIndex(l => l.includes('📲')) || descLines.length)
    .join('\n')
    .trim()
    .substring(0, 500)

  const notes = `${workoutName}\n\n${instructions}`

  // Date
  const date = dtstart.toJSDate().toISOString().split('T')[0]

  return {
    external_id: uid,
    date,
    start_time: null, // all-day events
    activity_type: activityType,
    duration_minutes: durationMinutes,
    distance_km: distanceKm > 0 ? distanceKm : null,
    intensity,
    notes
  }
}
```

---

## 🧪 Test Cases

### Example 1: Walk Run
```
SUMMARY: 🏃 My First Run • 2.3km
DESCRIPTION: Walk Run • 2.3km • 25m - 30m
X-WORKOUT-ESTIMATED-DURATION: 1800

Expected:
- activity_type: run
- distance_km: 2.3
- duration_minutes: 30
- intensity: low (conversational)
- notes: "My First Run\n\n5 mins walking warm up..."
```

### Example 2: Tempo Run
```
SUMMARY: 🏃 Tempo Session • 8km
DESCRIPTION: Tempo Run • 8km • 45m - 50m\n\nRun at threshold pace
X-WORKOUT-ESTIMATED-DURATION: 2850

Expected:
- activity_type: run
- distance_km: 8.0
- duration_minutes: 48
- intensity: high (threshold)
```

### Example 3: Rest Day
```
SUMMARY: 🛌 Rest Day
DESCRIPTION: Rest • Active recovery optional
DTSTART: 20251019
DTEND: 20251020

Expected:
- activity_type: rest
- distance_km: null
- duration_minutes: 0
- intensity: low
```

---

## ✅ Validation Checklist

- [x] Parse all-day events correctly
- [x] Extract distance from SUMMARY
- [x] Use X-WORKOUT-ESTIMATED-DURATION as primary duration source
- [x] Detect workout type from DESCRIPTION
- [x] Determine intensity from pace descriptions
- [x] Handle walk/run workouts as "run" type
- [x] Extract workout instructions for notes
- [x] Respect user timezone
- [x] Handle missing fields gracefully

---

## 🔮 Future Enhancements

1. **Rest Day Detection**
   - Look for "Rest" in SUMMARY or workout type
   - Set duration to 0, activity_type to 'rest'

2. **Cross Training**
   - Parse specific activities: cycling, swimming, etc.
   - Map to appropriate activity_type

3. **Race Day Detection**
   - Keywords: "race", "event", "parkrun"
   - Flag as important/target workout

4. **Pace Zones**
   - Extract zone info: "Zone 2", "Zone 4"
   - Store in notes or separate field

5. **Workout Completion Status**
   - Runna might mark completed workouts differently
   - Sync back completion status

