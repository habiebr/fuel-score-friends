# How to Enable Hydration Tracker

The Hydration Tracker component is currently **temporarily disabled** because it requires a database migration.

## Steps to Enable

### 1. Apply the Database Migration

You have two options:

#### Option A: Via Supabase Dashboard (Recommended)
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/20241006000000_add_hydration_logs.sql`
4. Paste into the SQL Editor
5. Click **Run**

#### Option B: Via Supabase CLI
```bash
supabase db push
```

### 2. Uncomment the Hydration Tracker

Open `src/components/RunnerNutritionDashboard.tsx` and make these changes:

**Line ~85-96**: Uncomment the hydration logs query
```typescript
// Change FROM:
// const { data: hydrationLogs } = await supabase
const hydrationMl = 0;

// Change TO:
const { data: hydrationLogs } = await supabase
  .from('hydration_logs')
  .select('amount_ml')
  .eq('user_id', user.id)
  .gte('logged_at', `${today}T00:00:00`)
  .lte('logged_at', `${today}T23:59:59`);

const hydrationMl = (hydrationLogs || []).reduce((sum, log) => sum + (log.amount_ml || 0), 0);
```

**Line ~181**: Uncomment the component
```typescript
// Change FROM:
{/* <HydrationTracker exerciseCalories={data.calories.exercise} /> */}

// Change TO:
<HydrationTracker exerciseCalories={data.calories.exercise} />
```

### 3. Save and Refresh

The Hydration Tracker will now be fully functional!

## What the Hydration Tracker Does

- Tracks daily water intake
- Quick-add buttons: 250ml, 500ml, 750ml
- Animated water level visualization
- Smart goal: 2L + 3ml per calorie burned
- Saves to database with timestamps
- Shows progress toward daily goal
- Encouragement messages when goal is reached

---

**Note**: The app works perfectly without the Hydration Tracker. This is just one of 8 components in the Runner Nutrition Dashboard. The other 7 components (CalorieRing, MacroProgressBars, NutritionInsights, etc.) are all fully functional!

