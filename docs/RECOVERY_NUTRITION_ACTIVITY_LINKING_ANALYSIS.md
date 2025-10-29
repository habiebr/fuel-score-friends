# Recovery Nutrition Activity Linking Analysis

## Current State: ❌ NO ACTIVITY LINKING

### Problem Identified

The recovery nutrition food suggestions are **NOT linked to the specific activity** that triggered them.

## Evidence

### 1. **Database Schema (`food_logs` table)**

```sql
CREATE TABLE public.food_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  food_name TEXT NOT NULL,
  meal_type TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein_grams INTEGER,
  carbs_grams INTEGER,
  fat_grams INTEGER,
  serving_size TEXT,
  logged_at TIMESTAMP WITH TIME ZONE
);
```

**Missing fields:**
- ❌ No `activity_id` column
- ❌ No `session_id` column  
- ❌ No `recovery_meal` flag
- ❌ No `triggered_by_activity` reference

### 2. **RecoverySuggestion Component**

**Props passed:**
```tsx
interface RecoverySuggestionProps {
  sessionEnd: Date;
  intensity: string;
  duration: number;
  distance?: number;
  calories_burned: number;
  onDismiss: () => void;
  onLogQuick?: () => void;
  onLogFull?: () => void;
}
```

**What's missing:**
- ❌ No `activityId` prop
- ❌ No `sessionId` prop
- ❌ No way to link food log back to the activity

### 3. **Dashboard Implementation**

```tsx
{newActivity && (
  <RecoverySuggestion
    sessionEnd={new Date(parseInt(newActivity.sessionId.split('-')[1]))}
    intensity={...}
    duration={60}
    distance={...}
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

**Issues:**
- ✅ `sessionId` exists in `newActivity` state
- ❌ `sessionId` is NOT passed to RecoverySuggestion component
- ❌ `sessionId` is only used for localStorage dismissal tracking
- ❌ Food logger opens with NO context about which activity triggered it

### 4. **Food Logging Flow**

When user clicks "Log Quick" or "Log Full":
```tsx
onLogQuick={() => setFoodTrackerOpen(true)}
onLogFull={() => setFoodTrackerOpen(true)}
```

**Problem:**
- Opens `FoodTrackerDialog` with no parameters
- No activity reference passed
- No way to associate the logged food with the triggering activity

## Impact

### What This Means:

1. **❌ Cannot track recovery compliance**
   - Can't see which activities had proper recovery nutrition
   - Can't measure time from activity end to recovery meal

2. **❌ Cannot analyze recovery patterns**
   - No data on which activity types get proper recovery
   - Can't correlate recovery nutrition with next-day performance

3. **❌ Cannot provide personalized insights**
   - Can't say "You recovered well after last Tuesday's run"
   - Can't compare recovery nutrition quality across different workouts

4. **❌ Cannot enforce recovery window**
   - Food logged could be unrelated to the activity
   - No way to verify it was actually recovery nutrition

5. **❌ Lost coaching opportunity**
   - Can't show "Your recovery after intervals is 80% compliant"
   - Can't recommend improvements based on activity type

## Proposed Solution

### Phase 1: Database Schema Update

Add columns to `food_logs` table:

```sql
ALTER TABLE public.food_logs 
  ADD COLUMN activity_id UUID REFERENCES wearable_data(id) ON DELETE SET NULL,
  ADD COLUMN session_id TEXT, -- Google Fit session ID
  ADD COLUMN is_recovery_meal BOOLEAN DEFAULT FALSE,
  ADD COLUMN recovery_window_minutes INTEGER; -- Time from activity end to meal logged
```

### Phase 2: Update RecoverySuggestion Component

```tsx
interface RecoverySuggestionProps {
  sessionEnd: Date;
  sessionId: string; // ADD THIS
  activityId?: string; // ADD THIS
  intensity: string;
  duration: number;
  distance?: number;
  calories_burned: number;
  onDismiss: () => void;
  onLogQuick?: (context: RecoveryContext) => void; // ADD CONTEXT
  onLogFull?: (context: RecoveryContext) => void; // ADD CONTEXT
}

interface RecoveryContext {
  sessionId: string;
  activityId?: string;
  sessionEnd: Date;
  intensity: string;
  calories_burned: number;
  isRecoveryMeal: true;
}
```

### Phase 3: Update FoodTrackerDialog

```tsx
interface FoodTrackerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recoveryContext?: RecoveryContext; // ADD THIS
}

// When logging food:
const foodLogData = {
  ...standardFields,
  activity_id: recoveryContext?.activityId,
  session_id: recoveryContext?.sessionId,
  is_recovery_meal: !!recoveryContext,
  recovery_window_minutes: recoveryContext 
    ? Math.floor((Date.now() - recoveryContext.sessionEnd.getTime()) / 60000)
    : null
};
```

### Phase 4: Dashboard Integration

```tsx
<RecoverySuggestion
  sessionEnd={new Date(parseInt(newActivity.sessionId.split('-')[1]))}
  sessionId={newActivity.sessionId} // ADD THIS
  activityId={newActivity.activityId} // ADD THIS (need to include in state)
  intensity={...}
  duration={60}
  distance={...}
  calories_burned={data?.caloriesBurned || 0}
  onDismiss={() => {
    localStorage.setItem('lastAckSessionId', newActivity.sessionId);
    setNewActivity(null);
  }}
  onLogQuick={(context) => {
    setRecoveryContext(context); // NEW STATE
    setFoodTrackerOpen(true);
  }}
  onLogFull={(context) => {
    setRecoveryContext(context); // NEW STATE
    setFoodTrackerOpen(true);
  }}
/>

<FoodTrackerDialog 
  open={foodTrackerOpen} 
  onOpenChange={setFoodTrackerOpen}
  recoveryContext={recoveryContext} // PASS CONTEXT
/>
```

## Benefits After Implementation

### 1. **Recovery Compliance Tracking**
```sql
-- See which activities had recovery meals logged
SELECT 
  w.activity_type,
  w.date,
  w.calories_burned,
  f.food_name,
  f.recovery_window_minutes,
  CASE 
    WHEN f.recovery_window_minutes <= 30 THEN 'Optimal'
    WHEN f.recovery_window_minutes <= 120 THEN 'Good'
    ELSE 'Late'
  END as recovery_timing
FROM wearable_data w
LEFT JOIN food_logs f ON f.activity_id = w.id AND f.is_recovery_meal = TRUE
WHERE w.user_id = :user_id
  AND w.date >= NOW() - INTERVAL '30 days'
ORDER BY w.date DESC;
```

### 2. **Recovery Insights**
- "You've logged recovery nutrition for 8/10 high-intensity workouts this month"
- "Your average recovery window is 45 minutes (optimal: <30 min)"
- "Runs over 10km have 90% recovery compliance vs 60% for shorter runs"

### 3. **Personalized Recommendations**
- "After tempo runs, you typically eat within 20 minutes - great job!"
- "You missed recovery nutrition after your last interval session"
- "Your recovery protein intake averages 25g - right on target"

### 4. **Training Correlation**
- Link recovery quality to next workout performance
- Identify if poor recovery affects subsequent training
- Track recovery patterns around race weeks

## Implementation Priority

**Priority: HIGH**

**Why:**
- Core feature gap affecting product value
- Data collection should start ASAP (can't backfill)
- Relatively simple implementation
- High impact on user insights and coaching

## Migration Strategy

### Step 1: Database Migration
```sql
-- Add new columns with defaults
ALTER TABLE public.food_logs 
  ADD COLUMN IF NOT EXISTS activity_id UUID,
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS is_recovery_meal BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recovery_window_minutes INTEGER;

-- Add index for recovery meal queries
CREATE INDEX IF NOT EXISTS idx_food_logs_recovery 
  ON public.food_logs(user_id, is_recovery_meal, logged_at DESC);

-- Add foreign key (optional, allows NULL for non-recovery meals)
ALTER TABLE public.food_logs
  ADD CONSTRAINT fk_food_logs_activity
  FOREIGN KEY (activity_id) 
  REFERENCES wearable_data(id) 
  ON DELETE SET NULL;
```

### Step 2: Component Updates (3 files)
1. `RecoverySuggestion.tsx` - Add context props
2. `FoodTrackerDialog.tsx` - Accept and save recovery context
3. `Dashboard.tsx` - Pass session/activity IDs

### Step 3: Analytics Dashboard (Future)
- Recovery compliance widget
- Recovery timing charts
- Activity-recovery correlation graphs

## Estimated Effort

- Database migration: **15 minutes**
- Component updates: **2 hours**
- Testing: **1 hour**
- **Total: ~3-4 hours**

## Next Steps

1. ✅ Approve this proposal
2. Create database migration file
3. Update TypeScript types
4. Update components
5. Test end-to-end flow
6. Deploy and start collecting data

---

**Would you like me to implement this activity linking feature?**
