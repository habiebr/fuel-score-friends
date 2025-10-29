# ⚡ Instant Recovery Nutrition - Sync Architecture

## 🎯 Use Case

**Scenario**: User finishes a run, wants immediate recovery nutrition advice

**Requirements**:
1. ⚡ **Instant sync** (not wait for 10-min batch)
2. 🏃 **Real-time data** (just-completed workout)
3. 🍎 **Recovery recommendations** (what to eat now)
4. 📊 **Accurate metrics** (distance, duration, intensity)

---

## 🏗️ Architecture: Dual-Mode Sync

### Two Sync Paths (Both Supported!)

```
┌─────────────────────────────────────────────────────┐
│  SYNC MODES                                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. AUTO SYNC (Background - Unified)                │
│     Every 10 minutes                                │
│     ├── Refresh expiring tokens                     │
│     ├── Sync all users (last 7 days)                │
│     └── Store in database                           │
│     Use: Keep data up-to-date                       │
│                                                     │
│  2. INSTANT SYNC (User-Triggered)                   │
│     On-demand (button click or auto-detect)         │
│     ├── Get valid token (shared token manager)      │
│     ├── Sync TODAY ONLY (fast)                      │
│     ├── Return data immediately                     │
│     └── Trigger recovery UI                         │
│     Use: Post-workout recovery nutrition            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Key Point**: Unified architecture **IMPROVES** instant sync by:
- ✅ Shared token manager (guaranteed valid token)
- ✅ Simpler code (reuse sync-core logic)
- ✅ Better reliability (no token expiry issues)

---

## ⚡ Implementation: Instant Recovery Sync

### Keep Existing `fetch-google-fit-data` - Enhanced

```typescript
// supabase/functions/fetch-google-fit-data/index.ts
// NOW SIMPLIFIED with shared token manager

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getValidToken } from '../_shared/google-token-manager.ts';
import { fetchDayData, storeDayData } from '../_shared/google-fit-sync-core.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) throw new Error('Unauthorized');

    console.log(`⚡ Instant sync for user: ${user.id}`);

    // Get valid token (auto-refresh if needed)
    // ✨ This is now ONE LINE thanks to shared module!
    const accessToken = await getValidToken(supabase, user.id);

    // Fetch TODAY's data
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const dayData = await fetchDayData(accessToken, startOfDay, endOfDay);

    // Store data
    const dateStr = new Date().toISOString().split('T')[0];
    await storeDayData(supabase, user.id, dateStr, dayData);

    // Detect if workout just completed
    const recentWorkout = detectRecentWorkout(dayData.sessions);

    return new Response(JSON.stringify({
      success: true,
      data: dayData,
      recent_workout: recentWorkout,
      // Include recovery recommendations if workout detected
      recovery_needed: !!recentWorkout,
      synced_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Instant sync error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Detect if a workout was completed in last 30 minutes
 */
function detectRecentWorkout(sessions: any[]) {
  const now = new Date().getTime();
  const thirtyMinutesAgo = now - (30 * 60 * 1000);

  for (const session of sessions) {
    const endTime = new Date(session.endTimeMillis || session.end_time).getTime();
    
    // Workout ended in last 30 minutes
    if (endTime >= thirtyMinutesAgo && endTime <= now) {
      return {
        activity_type: session.activityType || session.activity_type,
        name: session.name,
        duration_minutes: Math.round((endTime - new Date(session.startTimeMillis || session.start_time).getTime()) / 60000),
        ended_at: new Date(endTime).toISOString(),
        calories: session.calories || extractCalories(session),
        distance_km: extractDistance(session)
      };
    }
  }

  return null;
}
```

**Benefits of Unified Architecture:**
- ✅ **Reduced from 468 lines → ~200 lines** (token logic moved to shared module)
- ✅ **No token expiry issues** (getValidToken handles it)
- ✅ **Fast** (only syncs today)
- ✅ **Reliable** (reuses tested sync-core)

---

## 🎨 Frontend: Instant Recovery Flow

### User Experience

```
User finishes workout
  ↓
App detects workout end (or user taps "Sync")
  ↓
⚡ Instant sync (< 2 seconds)
  ↓
Detect recent workout
  ↓
Show recovery nutrition recommendations
```

### Implementation

```typescript
// src/hooks/useInstantRecoverySync.ts

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useInstantRecoverySync() {
  const [syncing, setSyncing] = useState(false);
  const [recentWorkout, setRecentWorkout] = useState<any>(null);
  const { toast } = useToast();

  const syncForRecovery = async () => {
    setSyncing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) throw new Error('Not authenticated');

      // Call instant sync function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-google-fit-data`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) throw new Error('Sync failed');

      const result = await response.json();

      // Check for recent workout
      if (result.recent_workout) {
        setRecentWorkout(result.recent_workout);
        
        toast({
          title: '🏃 Workout Detected!',
          description: `${result.recent_workout.name} - ${result.recent_workout.duration_minutes} min`,
        });

        // Trigger recovery nutrition recommendations
        return {
          hasWorkout: true,
          workout: result.recent_workout,
          data: result.data
        };
      }

      return {
        hasWorkout: false,
        data: result.data
      };

    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    } finally {
      setSyncing(false);
    }
  };

  return {
    syncForRecovery,
    syncing,
    recentWorkout
  };
}
```

### Component: Post-Workout Recovery Widget

```typescript
// src/components/PostWorkoutRecoveryWidget.tsx

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Apple, Zap } from 'lucide-react';
import { useInstantRecoverySync } from '@/hooks/useInstantRecoverySync';
import { generateRecoveryNutrition } from '@/lib/recovery-nutrition';

export function PostWorkoutRecoveryWidget() {
  const { syncForRecovery, syncing, recentWorkout } = useInstantRecoverySync();
  const [recoveryPlan, setRecoveryPlan] = useState<any>(null);

  // Auto-detect on mount (optional)
  useEffect(() => {
    checkForRecentWorkout();
  }, []);

  const checkForRecentWorkout = async () => {
    const result = await syncForRecovery();
    
    if (result.hasWorkout) {
      // Generate recovery nutrition
      const plan = generateRecoveryNutrition(result.workout);
      setRecoveryPlan(plan);
    }
  };

  if (!recentWorkout) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Recovery Nutrition
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Finish a workout? Get instant recovery recommendations!
          </p>
          <Button 
            onClick={checkForRecentWorkout} 
            disabled={syncing}
            className="w-full"
          >
            {syncing ? 'Checking...' : 'Check for Workout'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-500">
      <CardHeader className="bg-orange-50">
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Recovery Window Active! 🏃
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Workout Summary */}
          <div>
            <h3 className="font-semibold mb-2">Recent Workout</h3>
            <div className="text-sm text-muted-foreground">
              <p>{recentWorkout.name}</p>
              <p>{recentWorkout.duration_minutes} minutes • {recentWorkout.calories} cal</p>
              {recentWorkout.distance_km && (
                <p>{recentWorkout.distance_km.toFixed(2)} km</p>
              )}
            </div>
          </div>

          {/* Recovery Recommendations */}
          {recoveryPlan && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Apple className="h-4 w-4" />
                Recovery Nutrition
              </h3>
              
              {/* Timing */}
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-sm font-medium">⏰ Eat within 30-45 minutes</p>
                <p className="text-xs text-muted-foreground">
                  Optimal recovery window closes soon!
                </p>
              </div>

              {/* Macros */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {recoveryPlan.carbs}g
                  </p>
                  <p className="text-xs text-muted-foreground">Carbs</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {recoveryPlan.protein}g
                  </p>
                  <p className="text-xs text-muted-foreground">Protein</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">
                    {recoveryPlan.fluid}ml
                  </p>
                  <p className="text-xs text-muted-foreground">Water</p>
                </div>
              </div>

              {/* Suggestions */}
              <div>
                <p className="text-sm font-medium mb-2">Quick Recovery Meals:</p>
                <ul className="space-y-1">
                  {recoveryPlan.suggestions.map((meal: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      • {meal}
                    </li>
                  ))}
                </ul>
              </div>

              <Button className="w-full" variant="default">
                Log Recovery Meal
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 🔄 Recovery Nutrition Logic

```typescript
// src/lib/recovery-nutrition.ts

interface Workout {
  activity_type: string;
  duration_minutes: number;
  distance_km?: number;
  calories: number;
}

interface RecoveryPlan {
  carbs: number;  // grams
  protein: number;  // grams
  fluid: number;  // ml
  suggestions: string[];
  timing: string;
}

export function generateRecoveryNutrition(workout: Workout): RecoveryPlan {
  // Base calculations
  const durationHours = workout.duration_minutes / 60;
  
  // Carbs: 1-1.2g per kg body weight (estimate 70kg)
  // Protein: 0.25-0.3g per kg body weight
  const baseCarbs = Math.round(70 * 1.0 * durationHours);
  const baseProtein = Math.round(70 * 0.3);
  
  // Adjust based on intensity (calories burned per minute)
  const intensity = workout.calories / workout.duration_minutes;
  const intensityMultiplier = intensity > 10 ? 1.2 : 1.0;
  
  const carbs = Math.round(baseCarbs * intensityMultiplier);
  const protein = Math.round(baseProtein * intensityMultiplier);
  
  // Fluid: 150% of sweat loss (estimate 500ml per 30min)
  const sweatLoss = (workout.duration_minutes / 30) * 500;
  const fluid = Math.round(sweatLoss * 1.5);

  // Generate suggestions based on macros
  const suggestions = generateMealSuggestions(carbs, protein);

  return {
    carbs,
    protein,
    fluid,
    suggestions,
    timing: 'Within 30-45 minutes for optimal recovery'
  };
}

function generateMealSuggestions(carbs: number, protein: number): string[] {
  const suggestions = [];

  // Quick options
  if (carbs <= 40 && protein <= 20) {
    suggestions.push('Greek yogurt (200g) with banana and honey');
    suggestions.push('Protein smoothie with oats and berries');
    suggestions.push('Peanut butter toast (2 slices) with milk');
  } else if (carbs <= 60 && protein <= 30) {
    suggestions.push('Chicken rice bowl (1 cup rice, 100g chicken)');
    suggestions.push('Tuna sandwich with fruit smoothie');
    suggestions.push('Pasta with lean beef and vegetables');
  } else {
    suggestions.push('Large chicken rice bowl (1.5 cups rice, 150g chicken)');
    suggestions.push('Protein shake + rice + banana');
    suggestions.push('Recovery meal: Rice, grilled fish, vegetables, fruit');
  }

  return suggestions;
}
```

---

## 📊 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  INSTANT RECOVERY NUTRITION FLOW                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. User Finishes Workout                               │
│     ↓                                                   │
│  2. Options:                                            │
│     a) Auto-detect (check on app open)                  │
│     b) Manual button ("Sync Workout")                   │
│     c) Push notification (if enabled)                   │
│     ↓                                                   │
│  3. Call fetch-google-fit-data                          │
│     ├── Get valid token (auto-refresh if needed)        │
│     ├── Fetch TODAY only (fast ~1-2 sec)                │
│     └── Detect recent workout (last 30 min)             │
│     ↓                                                   │
│  4. If workout detected:                                │
│     ├── Calculate recovery macros                       │
│     ├── Generate meal suggestions                       │
│     └── Show recovery widget                            │
│     ↓                                                   │
│  5. User logs recovery meal                             │
│     └── Updates nutrition tracking                      │
│                                                         │
│  Meanwhile (in background):                             │
│  - Unified auto-sync runs every 10 min                  │
│  - Keeps all historical data up-to-date                 │
│  - Handles token refresh automatically                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## ⚡ Performance: Instant vs Auto Sync

| Feature | Instant Sync | Auto Sync (Unified) |
|---------|-------------|---------------------|
| **Trigger** | User button/auto-detect | Cron every 10 min |
| **Scope** | TODAY only | Last 7 days |
| **Speed** | ~1-2 seconds | ~5-10 seconds |
| **Use Case** | Recovery nutrition | Keep data updated |
| **Token Refresh** | Shared module ✅ | Shared module ✅ |
| **API Calls** | 1 per user request | Batch for all users |

**Key Point**: Both use the same token manager, so instant sync is **more reliable** with unified architecture!

---

## ✅ Benefits of Unified Architecture for Recovery

### Before (Current)
```
Instant sync:
├── Has its own token refresh logic (100 lines)
├── Token might expire during sync
├── Redundant with auto-sync token logic
└── Hard to maintain
```

### After (Unified)
```
Instant sync:
├── Uses shared token manager (1 line)
├── Token guaranteed valid
├── Reuses sync-core logic
└── Simple and reliable

Auto sync:
├── Different use case (batch vs instant)
├── Same token manager
└── No conflicts
```

---

## 🚀 Implementation Checklist

### Phase 1: Unified Auto Sync (Foundation)
- [ ] Create `google-token-manager.ts` shared module
- [ ] Create `sync-all-google-fit` unified function
- [ ] Update cron job to single unified sync

### Phase 2: Enhance Instant Sync (Recovery)
- [ ] Simplify `fetch-google-fit-data` with shared token manager
- [ ] Add `detectRecentWorkout` function
- [ ] Return recovery-needed flag

### Phase 3: Recovery Nutrition UI
- [ ] Create `useInstantRecoverySync` hook
- [ ] Create `PostWorkoutRecoveryWidget` component
- [ ] Implement `generateRecoveryNutrition` logic
- [ ] Add to Dashboard

### Phase 4: Polish
- [ ] Auto-detect on app open
- [ ] Push notifications for recovery window
- [ ] Recovery meal quick-log
- [ ] Track recovery nutrition compliance

---

## 🎯 Summary

**Question**: How to do instant sync with unified architecture?

**Answer**: Unified architecture **IMPROVES** instant sync!

✅ **Keep both sync modes:**
- Auto sync (every 10 min) - background updates
- Instant sync (user-triggered) - recovery nutrition

✅ **Both use shared token manager:**
- No duplication
- More reliable
- Simpler code

✅ **Instant sync becomes faster:**
- Token refresh handled by shared module
- Less code to maintain
- Better error handling

**Result**: Best of both worlds! 🎉

Ready to implement? This gives you:
1. Efficient auto-sync (unified)
2. Fast instant sync (recovery)
3. Shared reliable token management
4. Better user experience

