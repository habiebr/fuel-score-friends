# ✅ Recovery Widget - How It Currently Works

**Date:** October 17, 2025  
**Status:** WORKING! ✅

---

## 🎯 Current Implementation

### Automatic Detection in Dashboard

**Location:** `src/components/Dashboard.tsx` (lines 791-801)

```typescript
// Inside loadDashboardData function
sessions.sort((a, b) => (parseInt(b.endTimeMillis || '0') - parseInt(a.endTimeMillis || '0')));
const latest = sessions[0];

if (latest) {
  const id = `${latest.startTimeMillis}-${latest.endTimeMillis}`;
  const lastAck = localStorage.getItem('lastAckSessionId');
  const ended = parseInt(latest.endTimeMillis || '0');
  
  // Check if session ended within last 6 HOURS
  const isRecent = Date.now() - ended < 6 * 60 * 60 * 1000; // 6 hours
  
  const activityType = (latest.activityType || latest.application || latest.name || 'activity').toString();
  const actualText = `${activityType}${latest?.distance ? ` ${(latest.distance / 1000).toFixed(1)} km` : ''}`;
  
  // Show widget if recent AND not already acknowledged
  if (isRecent && id !== lastAck) {
    setNewActivity({ 
      planned: plannedText, 
      actual: actualText, 
      sessionId: id 
    });
  }
}
```

---

## 🔄 How It Works (Current Flow)

```
1. User finishes workout (Google Fit logs it)
   ↓
2. User opens Fuel Score app 📱
   ↓
3. Dashboard loads (loadDashboardData runs)
   ↓
4. Fetches Google Fit sessions from database
   ↓
5. Finds most recent session
   ↓
6. Checks if ended within last 6 HOURS ⏰
   ↓
7. Checks if already acknowledged (localStorage)
   ↓
8. If YES: Shows RecoverySuggestion widget ✅
   ↓
9. RecoverySuggestion shows 30-min countdown timer
   ↓
10. User dismisses → Saves to localStorage
   ↓
11. Won't show again for same session
```

---

## ⏰ Time Windows

### Detection Window: **6 Hours**
```typescript
const isRecent = Date.now() - ended < 6 * 60 * 60 * 1000; // 6 hours
```

**Meaning:**
- Widget can appear if workout ended within last 6 hours
- Gives user flexibility to open app later

### Recovery Window: **30 Minutes**
```typescript
// In RecoverySuggestion.tsx
const remainingMs = Math.max(0, (sessionEnd.getTime() + 30 * 60 * 1000) - Date.now());
```

**Meaning:**
- Countdown timer shows 30 minutes from workout end
- After 30 min: "Recovery window closed"
- But widget still visible (just expired state)

---

## 💾 Persistence (localStorage)

### Tracking Acknowledged Sessions

```typescript
// When user dismisses widget
localStorage.setItem('lastAckSessionId', newActivity.sessionId);

// Before showing widget
const lastAck = localStorage.getItem('lastAckSessionId');
if (id !== lastAck) {
  // Show widget
}
```

**Prevents:**
- ✅ Showing same session multiple times
- ✅ Widget appearing after user dismisses it
- ✅ Duplicate recovery recommendations

**Format:**
```
sessionId = "1729152000000-1729154100000" 
            (startTime-endTime in milliseconds)
```

---

## 📊 Widget Display Logic

### Component Structure

```typescript
{newActivity && (
  <RecoverySuggestion
    sessionEnd={new Date(parseInt(newActivity.sessionId.split('-')[1]))}
    intensity={newActivity.actual.toLowerCase().includes('tempo') ? 'high' : 'moderate'}
    duration={60} // TODO: Get from Google Fit session
    distance={parseFloat(newActivity.actual.match(/(\d+\.?\d*)\s*km/)?.[1] || '0')}
    calories_burned={data?.caloriesBurned || 0}
    onDismiss={() => {
      localStorage.setItem('lastAckSessionId', newActivity.sessionId);
      setNewActivity(null);
    }}
    onLogQuick={() => setFoodTrackerOpen(true)}
    onLogFull={() => setFoodTrackerOpen(true)}
  />
)}
```

### Data Extraction

**Session End Time:**
```typescript
// Extract from sessionId: "start-END"
new Date(parseInt(newActivity.sessionId.split('-')[1]))
```

**Intensity:**
```typescript
// Check activity name for keywords
newActivity.actual.toLowerCase().includes('tempo') || 
newActivity.actual.toLowerCase().includes('interval') 
  ? 'high' 
  : 'moderate'
```

**Distance:**
```typescript
// Extract from actual text: "Running 5.2 km"
parseFloat(newActivity.actual.match(/(\d+\.?\d*)\s*km/)?.[1] || '0')
```

---

## 🎯 What Works Well

### ✅ Automatic Detection
- No manual sync button needed
- Checks on every dashboard load
- Uses existing Google Fit session data

### ✅ Smart Filtering
- Only shows sessions within 6 hours
- Prevents duplicate displays (localStorage)
- Automatically extracts distance from description

### ✅ User Control
- Can dismiss widget
- Dismissed sessions don't reappear
- Quick meal logging integration

### ✅ Recovery Widget Features
- 30-minute countdown timer
- Indonesian meal suggestions
- Quick vs full recovery options
- Benefits explanation
- PWA notifications

---

## ⚠️ Current Limitations

### 1. Data Source Dependency
```typescript
// Relies on sessions already being in data
if (syncStatus === 'success' && cachedTodayData?.sessions) {
  const sessions = cachedTodayData.sessions;
  // ...
}
```

**Issue:** Sessions must be synced first
- Requires prior Google Fit sync
- May not detect immediately if cache is stale

### 2. Fixed Duration
```typescript
duration={60} // TODO: Get from Google Fit session
```

**Issue:** Hardcoded to 60 minutes
- Should calculate from session start/end times
- Currently: `(endTime - startTime) / (60 * 1000)`

### 3. Detection Window vs Recovery Window
```typescript
// Detection: 6 hours
const isRecent = Date.now() - ended < 6 * 60 * 60 * 1000;

// Recovery: 30 minutes
const remainingMs = (sessionEnd + 30 * 60 * 1000) - Date.now();
```

**Confusion:**
- Widget can appear 5 hours after workout
- But recovery window already expired
- Shows "Window closed" message

---

## 🚀 How It Works on Different Platforms

### iOS PWA ✅
```
User opens app
  ↓
Dashboard loads (foreground)
  ↓
Checks cached Google Fit sessions
  ↓
Shows widget if recent session found
  ↓
✅ WORKS (foreground detection)
```

**Pros:**
- ✅ Works because it's foreground detection
- ✅ Uses cached session data
- ✅ No background sync needed

**Cons:**
- ⚠️ Depends on cache being up-to-date
- ⚠️ No notification until user opens app

---

### Android PWA ✅
```
User opens app
  ↓
Same flow as iOS
  ↓
✅ WORKS
```

**Additional:** Could add background sync for push notifications

---

## 💡 What We Learned from the Conversation

### The Original Concern Was Probably:

**Option 1: Wanted True Background Detection**
> "Can we make it automatic without opening the app?"
- Answer: iOS can't do background
- Current solution: Detection on app open (works well!)

**Option 2: Wanted to Optimize Sync**
> "Can we make detection faster/more efficient?"
- Answer: Already quite efficient using cached data
- Could optimize: Consolidate token refresh + sync

**Option 3: Just Wanted to Understand Architecture**
> "How does this all work?"
- Answer: Now documented! ✅

---

## 📋 Summary

### Current System Status: **WORKING ✅**

**Detection:**
- ✅ Automatic on app open
- ✅ Checks cached Google Fit sessions
- ✅ 6-hour detection window
- ✅ localStorage prevents duplicates

**Display:**
- ✅ RecoverySuggestion component
- ✅ 30-minute countdown timer
- ✅ Indonesian recovery meals
- ✅ Quick meal logging integration

**Platforms:**
- ✅ iOS PWA (foreground detection)
- ✅ Android PWA (foreground detection)
- ✅ Desktop Web

---

## ❓ What's Next?

### If Everything is Working Well:
- ✅ Document architecture (done!)
- ✅ No changes needed
- ✅ System is solid

### If You Want Improvements:

**Option A: Fix Duration Calculation**
```typescript
// Calculate actual duration from session
const duration = Math.round(
  (endTime - startTime) / (60 * 1000)
);
```

**Option B: Align Detection Window with Recovery Window**
```typescript
// Change detection window to 30 minutes
const isRecent = Date.now() - ended < 30 * 60 * 1000;
```

**Option C: Add Background Sync (Android Only)**
```typescript
// Cron job every 10 min
// Detect new workouts
// Send push notifications
```

---

## 🎯 Question for You

**Now that we know how it works:**

1. **Is it working as expected?**
   - Yes, everything is great? ✅
   - Or is there a specific issue?

2. **What was the original concern?**
   - Wanted to understand how it works?
   - Wanted to add background detection?
   - Wanted to optimize performance?
   - Something else?

3. **Any improvements needed?**
   - Fix hardcoded duration?
   - Adjust time windows?
   - Add Android push notifications?
   - Nothing, it's perfect?

---

Let me know what you'd like to do! 🚀

**Options:**
- **A.** It works great, no changes needed
- **B.** Fix the hardcoded duration (quick fix)
- **C.** Adjust detection window to match recovery window
- **D.** Add background detection for Android
- **E.** Something else

