# 🏃 Runna Integration — Quick Start

**✅ Everything is deployed!** Just apply the migration and test.

---

## 📋 **1-Minute Setup:**

### **Step 1: Apply Migration (30 seconds)**
Go to: **https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/sql/new**

Paste and run:
```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS runna_calendar_url TEXT,
ADD COLUMN IF NOT EXISTS runna_last_synced_at TIMESTAMPTZ;

ALTER TABLE public.training_activities
ADD COLUMN IF NOT EXISTS is_from_runna BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_training_activities_runna
ON public.training_activities(user_id, date, is_from_runna)
WHERE is_from_runna = TRUE;
```

### **Step 2: Test (30 seconds)**
1. Visit: **https://app.nutrisync.id/integrations**
2. See "Runna Training Calendar" section
3. Paste your ICS URL: `https://cal.runna.com/xxx.ics`
4. Click "Connect Calendar"
5. Done! ✨

---

## ✨ **What You'll See:**

### **App Integrations Page:**
```
┌─────────────────────────────────────┐
│ 🏃 Runna Training Calendar          │
│                                     │
│ [Input: Calendar URL]               │
│ [Button: Connect Calendar]          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🚴 Strava          [Coming Soon]    │
│ Track runs, rides, and workouts     │
│ [Button: Disabled]                  │
└─────────────────────────────────────┘
```

### **Training Page:**
Activities from Runna will appear with pattern filling gaps!

---

## 🧪 **Test Cases:**

### **Test 1: Full Runna Week**
- Paste Runna ICS URL with 7 activities
- **Expected:** All 7 from Runna, 0 from pattern

### **Test 2: Partial Runna Week**
- Paste Runna ICS URL with 3 activities
- **Expected:** 3 from Runna, 4 from pattern (fills gaps!)

### **Test 3: Empty Calendar**
- Use expired Runna URL (no future activities)
- **Expected:** Message says "No future activities", pattern creates full week

---

## 📊 **Check What's Working:**

```sql
-- See all your activities with sources
SELECT 
  date,
  activity_type,
  CASE 
    WHEN is_from_runna THEN '🏃 Runna'
    WHEN is_actual THEN '⌚ Actual'
    ELSE '🤖 Pattern'
  END as source
FROM training_activities
WHERE user_id = 'YOUR_USER_ID'
ORDER BY date DESC;
```

---

## 🎯 **Empty Calendar = Smart Fallback:**

```
Week 1: Runna active
  Mon: Tempo (Runna)
  Tue: Rest (Pattern)  ← Pattern fills gap
  Wed: Long run (Runna)
  ...

Week 5: Runna expires
  Mon: Rest (Pattern)  ← Pattern takes over
  Tue: Run 5k (Pattern)
  Wed: Run 5k (Pattern)
  ...                   User never sees empty week!
```

---

## 🚨 **If Something's Wrong:**

### **Migration didn't work?**
```sql
-- Check if columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'training_activities' 
AND column_name = 'is_from_runna';
```

### **UI not showing Runna section?**
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Check Cloudflare Pages deployment status
- Clear browser cache

### **"Invalid calendar URL" error?**
- URL must end with `.ics`
- Must be from `cal.runna.com`
- Check URL is public (not expired)

---

**That's it!** Apply migration → Test → Done! 🎉

📚 Full docs: `RUNNA_DEPLOYMENT_SUMMARY.md`

