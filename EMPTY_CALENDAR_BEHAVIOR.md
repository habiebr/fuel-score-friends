# 🔄 Empty Runna Calendar Behavior

**Question:** What happens when Runna calendar is empty?

---

## ✅ **Smart Fallback Logic:**

### **Scenario 1: Runna Calendar Empty**
```
Runna activities: 0 (empty or expired)
Pattern activities: 7 (fills entire week)

Result: User always has a training plan!
```

### **Scenario 2: Runna Has Some Activities**
```
Runna activities: 3 (Tue, Thu, Sat)
Pattern activities: 4 (fills Mon, Wed, Fri, Sun)

Result: Hybrid plan with no gaps
```

### **Scenario 3: Runna Fully Populated**
```
Runna activities: 7 (all days)
Pattern activities: 0 (not needed)

Result: Pure Runna plan
```

---

## 🔍 **Detection Logic:**

```typescript
// In pattern generator:

// 1. Check for Runna activities
const { data: runnaActivities } = await supabase
  .from('training_activities')
  .select('date')
  .eq('user_id', user_id)
  .eq('is_from_runna', true)
  .eq('is_actual', false)
  .gte('date', nextWeekStart)
  .lte('date', nextWeekEnd);

const runnaDates = new Set((runnaActivities || []).map(a => a.date));

console.log(`Runna has ${runnaDates.size} activities for next week`);

// 2. Generate pattern for all dates NOT in Runna
if (runnaDates.size === 0) {
  console.log('✅ Runna calendar empty - generating full week pattern');
}

for (let i = 0; i < 7; i++) {
  const date = addDays(nextWeekStart, i);
  const dateStr = format(date, 'yyyy-MM-dd');
  
  if (runnaDates.has(dateStr)) {
    console.log(`⏭️  Skipping ${dateStr} - has Runna activity`);
    continue; // Skip this date
  }
  
  // Generate pattern for this date (Runna doesn't have it)
  console.log(`✅ Generating pattern for ${dateStr} - no Runna activity`);
  activities.push({
    user_id,
    date: dateStr,
    activity_type: pattern.activity_type,
    is_from_runna: false,
    is_actual: false
  });
}
```

---

## 🎯 **User Experience:**

### **Week 1: Runna Active**
```
Training Plan:
✅ Mon: Tempo run (Runna)
✅ Tue: Rest (Pattern)
✅ Wed: Intervals (Runna)
✅ Thu: Easy run (Pattern)
✅ Fri: Strength (Runna)
✅ Sat: Long run (Runna)
✅ Sun: Rest (Pattern)

Source: 4 Runna + 3 Pattern
```

### **Week 5: Runna Expires**
```
Training Plan:
✅ Mon: Rest (Pattern) ← Pattern takes over
✅ Tue: Run 5k (Pattern)
✅ Wed: Run 5k (Pattern)
✅ Thu: Rest (Pattern)
✅ Fri: Run 8k (Pattern)
✅ Sat: Long 15k (Pattern)
✅ Sun: Rest (Pattern)

Source: 0 Runna + 7 Pattern
No empty days!
```

### **Week 6: User Re-syncs Runna**
```
Training Plan:
✅ Mon: Tempo run (Runna) ← Runna back
✅ Tue: Easy run (Pattern)
✅ Wed: Intervals (Runna)
✅ Thu: Rest (Pattern)
✅ Fri: Hill run (Runna)
✅ Sat: Long run (Runna)
✅ Sun: Rest (Pattern)

Source: 4 Runna + 3 Pattern
Seamless transition!
```

---

## 🔔 **UI Indicators:**

### **When Calendar is Empty:**
```
🟡 Runna Calendar Status: No upcoming activities
   Using pattern generator for next week
   [Sync Now] button to check for updates
```

### **When Calendar is Active:**
```
🟢 Runna Calendar Status: 4 activities next week
   Last synced: 2 hours ago
   [Sync Now] [Disconnect]
```

### **When Calendar is Disconnected:**
```
⚪ Runna Calendar Status: Not connected
   Using pattern generator
   [Connect Runna Calendar]
```

---

## 🚨 **Error Handling:**

### **Invalid URL:**
```
❌ Failed to sync Runna calendar
   Invalid calendar URL
   → Keep existing activities, show error
   → Pattern continues to work
```

### **Network Error:**
```
⚠️ Failed to sync Runna calendar
   Network timeout
   → Keep existing activities, show warning
   → Pattern continues to work
   → Retry button available
```

### **Calendar Deleted:**
```
❌ Runna calendar no longer accessible (404)
   Calendar may have been deleted
   → Clear runna_calendar_url
   → Delete all is_from_runna activities
   → Pattern takes over completely
```

---

## ✅ **Benefits:**

1. **Never Empty:** Pattern ensures user always has a plan
2. **Seamless Fallback:** Runna empty? Pattern fills in automatically
3. **No Manual Work:** User doesn't need to do anything
4. **Smart Sync:** Re-sync Runna anytime, pattern adjusts
5. **Independent Systems:** Pattern and Runna work independently

---

## 🔄 **Automatic Behavior:**

```
State Machine:

┌─────────────────┐
│  Runna Active   │──┐
│  (7 activities) │  │
└─────────────────┘  │
         ↓           │ Expires/Empty
┌─────────────────┐  │
│  Hybrid Mode    │  │
│  (3 Runna +     │  │
│   4 Pattern)    │  │
└─────────────────┘  │
         ↓           │
┌─────────────────┐  │
│  Pattern Only   │←─┘
│  (7 Pattern)    │
└─────────────────┘
         ↑
         │ Re-sync
         │
┌─────────────────┐
│  User Re-syncs  │
│  Runna Calendar │
└─────────────────┘
```

---

## 💡 **Implementation:**

Pattern generator just checks:
```typescript
const runnaDates = getRunnaDates(); // May be empty Set

for (each day) {
  if (!runnaDates.has(day)) {
    generatePattern(day); // Fill the gap
  }
}
```

**If Runna is empty:** All days get pattern  
**If Runna has some:** Only gaps get pattern  
**If Runna is full:** No pattern needed

**Simple and bulletproof!** 🎯

