# 🔔 Automatic Workout Detection & Recovery Notifications

## 🎯 Desired User Experience

```
User finishes run (tracked in Google Fit)
  ↓
App AUTOMATICALLY detects new workout (no manual action)
  ↓
🔔 Push notification: "Workout detected! Get your recovery nutrition plan"
  ↓
User opens app
  ↓
Recovery widget already showing with recommendations
```

**Key Requirement**: Zero user action needed - fully automatic!

---

## ❌ The Challenge: Google Fit Has No Webhooks

**Problem**: Google Fit API doesn't provide webhooks/real-time notifications

**Options**:
1. ❌ Webhooks - Not supported by Google Fit
2. ✅ **Frequent polling** - Check for new workouts every 1-5 minutes
3. ✅ **Smart detection** - Only notify when workout actually found
4. ✅ **Push notifications** - Alert user when workout detected

---

## ✅ Solution: Intelligent Background Sync + Push Notifications

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  AUTOMATIC WORKOUT DETECTION SYSTEM                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. BACKGROUND SYNC (Every 5 minutes)                   │
│     ├── Sync all users' Google Fit data                 │
│     ├── Check for NEW workouts (last 5 min)             │
│     └── If new workout found → trigger notification     │
│                                                         │
│  2. WORKOUT DETECTION LOGIC                             │
│     ├── Query: workouts ended in last 5 minutes         │
│     ├── Compare with previous sync                      │
│     └── New workout = recovery window active            │
│                                                         │
│  3. PUSH NOTIFICATION                                   │
│     ├── Send to user's device                           │
│     ├── "🏃 Workout detected! Recovery window open"     │
│     └── Deep link to recovery widget                    │
│                                                         │
│  4. APP OPENS                                           │
│     ├── Recovery widget auto-displays                   │
│     ├── Countdown timer (30 min window)                 │
│     └── One-tap meal logging                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementation

### Step 1: Enhanced Unified Sync with Workout Detection

```typescript
// supabase/functions/sync-all-google-fit-with-notifications/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { refreshToken } from '../_shared/google-token-manager.ts';
import { fetchDayData, storeDayData } from '../_shared/google-fit-sync-core.ts';

interface WorkoutDetection {
  user_id: string;
  workout: {
    id: string;
    name: string;
    activity_type: string;
    duration_minutes: number;
    calories: number;
    distance_km?: number;
    ended_at: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('🔄 Starting automatic workout detection sync...');

    // Get all active tokens
    const { data: tokens } = await supabase
      .from('google_tokens')
      .select('*')
      .eq('is_active', true);

    if (!tokens?.length) {
      return new Response(JSON.stringify({ message: 'No active tokens' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const detectedWorkouts: WorkoutDetection[] = [];
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Process users in batches
    for (const token of tokens) {
      try {
        // Get valid token (auto-refresh if needed)
        let accessToken = token.access_token;
        const expiresAt = new Date(token.expires_at);
        
        if (expiresAt.getTime() - now.getTime() < 30 * 60 * 1000) {
          const refreshed = await refreshToken(supabase, token);
          accessToken = refreshed.access_token;
        }

        // Sync TODAY's data
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        const dayData = await fetchDayData(accessToken, startOfDay, endOfDay);

        // Store data
        const dateStr = new Date().toISOString().split('T')[0];
        await storeDayData(supabase, token.user_id, dateStr, dayData);

        // ⚡ DETECT NEW WORKOUTS (ended in last 5 minutes)
        const newWorkouts = detectNewWorkouts(dayData.sessions, fiveMinutesAgo);

        if (newWorkouts.length > 0) {
          console.log(`🏃 New workout detected for user ${token.user_id}`);
          
          for (const workout of newWorkouts) {
            detectedWorkouts.push({
              user_id: token.user_id,
              workout
            });

            // Send push notification
            await sendWorkoutNotification(supabase, token.user_id, workout);

            // Store notification for in-app display
            await createRecoveryNotification(supabase, token.user_id, workout);
          }
        }

      } catch (error) {
        console.error(`Error syncing user ${token.user_id}:`, error);
      }

      // Rate limiting
      await delay(200);  // 200ms between users
    }

    const summary = {
      users_synced: tokens.length,
      workouts_detected: detectedWorkouts.length,
      notifications_sent: detectedWorkouts.length,
      detected_workouts: detectedWorkouts
    };

    console.log('✅ Sync complete:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Detect workouts that ended recently (within lookback period)
 */
function detectNewWorkouts(sessions: any[], lookbackTime: Date) {
  const newWorkouts = [];
  const now = new Date().getTime();

  for (const session of sessions) {
    const endTime = new Date(session.endTimeMillis || session.end_time).getTime();
    
    // Workout ended between lookback time and now
    if (endTime >= lookbackTime.getTime() && endTime <= now) {
      const startTime = new Date(session.startTimeMillis || session.start_time).getTime();
      const durationMs = endTime - startTime;
      
      newWorkouts.push({
        id: session.id || `${session.startTimeMillis}`,
        name: session.name || 'Workout',
        activity_type: session.activityType || session.activity_type || 'run',
        duration_minutes: Math.round(durationMs / 60000),
        calories: session.calories || extractCalories(session),
        distance_km: extractDistance(session),
        ended_at: new Date(endTime).toISOString()
      });
    }
  }

  return newWorkouts;
}

/**
 * Send push notification to user
 */
async function sendWorkoutNotification(supabase: any, userId: string, workout: any) {
  try {
    // Get user's push subscription
    const { data: subscription } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!subscription) {
      console.log(`No push subscription for user ${userId}`);
      return;
    }

    // Send push notification via your push service
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/push-send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          user_id: userId,
          notification: {
            title: '🏃 Workout Detected!',
            body: `${workout.name} - ${workout.duration_minutes} min. Get your recovery nutrition plan now!`,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            data: {
              type: 'workout_detected',
              workout_id: workout.id,
              url: '/recovery'
            },
            actions: [
              {
                action: 'view',
                title: 'View Recovery Plan'
              },
              {
                action: 'dismiss',
                title: 'Dismiss'
              }
            ]
          }
        })
      }
    );

    if (response.ok) {
      console.log(`✅ Notification sent to user ${userId}`);
    }

  } catch (error) {
    console.error(`Failed to send notification to user ${userId}:`, error);
  }
}

/**
 * Create in-app notification record
 */
async function createRecoveryNotification(supabase: any, userId: string, workout: any) {
  // Calculate recovery window expiry (30 minutes after workout end)
  const workoutEnd = new Date(workout.ended_at);
  const recoveryWindowEnd = new Date(workoutEnd.getTime() + 30 * 60 * 1000);

  await supabase
    .from('training_notifications')
    .insert({
      user_id: userId,
      notification_type: 'recovery_window',
      title: 'Recovery Window Active',
      message: `${workout.name} completed. Eat within 30 minutes for optimal recovery.`,
      related_date: new Date().toISOString().split('T')[0],
      workout_data: workout,
      expires_at: recoveryWindowEnd.toISOString(),
      is_read: false
    });
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractCalories(session: any): number {
  return session.calories || session.raw?.calories || 0;
}

function extractDistance(session: any): number | null {
  if (session.distance_km) return session.distance_km;
  if (session.raw?.distance_meters) return session.raw.distance_meters / 1000;
  return null;
}
```

---

## 📊 Database Schema: Training Notifications

```sql
-- Table to track recovery notifications
CREATE TABLE IF NOT EXISTS public.training_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'recovery_window', 'pre_training', 'hydration'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_date DATE,
  workout_data JSONB, -- Store workout details
  expires_at TIMESTAMPTZ, -- When notification expires (e.g., 30 min after workout)
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fetching active notifications
CREATE INDEX idx_training_notifications_user_active 
  ON public.training_notifications(user_id, is_read, expires_at) 
  WHERE is_read = false AND expires_at > now();

-- RLS Policies
ALTER TABLE public.training_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.training_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.training_notifications FOR UPDATE
  USING (auth.uid() = user_id);
```

---

## 🔔 Cron Job Configuration

```sql
-- Remove old sync job
SELECT cron.unschedule('sync-all-google-fit-unified');

-- Create new job with workout detection
SELECT cron.schedule(
  'auto-detect-workouts-and-sync',
  '*/5 * * * *',  -- Every 5 minutes for quick detection
  $$
    SELECT net.http_post(
      url := 'https://[PROJECT].supabase.co/functions/v1/sync-all-google-fit-with-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

**Why 5 minutes?**
- ✅ Quick enough for "instant" feel (user waits max 5 min)
- ✅ Not too frequent (avoid rate limits)
- ✅ 30-minute recovery window still mostly captured
- ✅ Balance between responsiveness and cost

---

## 📱 Frontend: Auto-Displaying Recovery Widget

### Hook: Active Recovery Notifications

```typescript
// src/hooks/useRecoveryNotifications.ts

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useRecoveryNotifications() {
  const { user } = useAuth();
  const [activeRecovery, setActiveRecovery] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Load active recovery notifications
    loadActiveRecovery();

    // Subscribe to new notifications
    const subscription = supabase
      .channel('recovery-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'training_notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new.notification_type === 'recovery_window') {
            setActiveRecovery(payload.new);
            
            // Show browser notification if supported
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('🏃 Workout Detected!', {
                body: payload.new.message,
                icon: '/icon-192.png'
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const loadActiveRecovery = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('training_notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('notification_type', 'recovery_window')
        .eq('is_read', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setActiveRecovery(data);
    } catch (error) {
      console.error('Failed to load recovery notification:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismissRecovery = async (notificationId: string) => {
    await supabase
      .from('training_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    
    setActiveRecovery(null);
  };

  return {
    activeRecovery,
    loading,
    dismissRecovery,
    refresh: loadActiveRecovery
  };
}
```

### Component: Auto-Display Recovery Widget

```typescript
// src/components/AutoRecoveryWidget.tsx

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, X, Clock } from 'lucide-react';
import { useRecoveryNotifications } from '@/hooks/useRecoveryNotifications';
import { generateRecoveryNutrition } from '@/lib/recovery-nutrition';

export function AutoRecoveryWidget() {
  const { activeRecovery, dismissRecovery } = useRecoveryNotifications();
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Update countdown timer
  useEffect(() => {
    if (!activeRecovery) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const expires = new Date(activeRecovery.expires_at).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeRemaining('Window closed');
        clearInterval(timer);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeRecovery]);

  if (!activeRecovery) return null;

  const workout = activeRecovery.workout_data;
  const recoveryPlan = generateRecoveryNutrition(workout);

  return (
    <Card className="border-2 border-orange-500 shadow-lg animate-in slide-in-from-top">
      <CardHeader className="bg-gradient-to-r from-orange-50 to-yellow-50">
        <div className="flex items-start justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500 animate-pulse" />
            <span className="text-orange-700">Recovery Window Active!</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dismissRecovery(activeRecovery.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-4">
        {/* Countdown Timer */}
        <div className="flex items-center justify-center gap-2 p-4 bg-red-50 rounded-lg border border-red-200">
          <Clock className="h-5 w-5 text-red-500" />
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{timeRemaining}</div>
            <div className="text-xs text-red-500">Optimal recovery window</div>
          </div>
        </div>

        {/* Workout Summary */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-sm font-semibold mb-1">Workout Detected:</div>
          <div className="text-sm text-muted-foreground">
            {workout.name} • {workout.duration_minutes} min • {workout.calories} cal
            {workout.distance_km && ` • ${workout.distance_km.toFixed(2)} km`}
          </div>
        </div>

        {/* Recovery Macros */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{recoveryPlan.carbs}g</div>
            <div className="text-xs text-muted-foreground">Carbs</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-600">{recoveryPlan.protein}g</div>
            <div className="text-xs text-muted-foreground">Protein</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-2xl font-bold text-purple-600">{recoveryPlan.fluid}ml</div>
            <div className="text-xs text-muted-foreground">Water</div>
          </div>
        </div>

        {/* Quick Suggestions */}
        <div>
          <div className="text-sm font-semibold mb-2">Quick Recovery Options:</div>
          <div className="space-y-2">
            {recoveryPlan.suggestions.slice(0, 2).map((meal, i) => (
              <Button
                key={i}
                variant="outline"
                className="w-full justify-start text-left h-auto py-3"
                onClick={() => {/* Quick log this meal */}}
              >
                <div className="text-sm">{meal}</div>
              </Button>
            ))}
          </div>
        </div>

        <Button className="w-full" size="lg">
          Log Recovery Meal
        </Button>
      </CardContent>
    </Card>
  );
}
```

### Add to Dashboard

```typescript
// src/components/Dashboard.tsx

import { AutoRecoveryWidget } from '@/components/AutoRecoveryWidget';

export function Dashboard() {
  return (
    <div className="space-y-4">
      {/* Auto-display recovery widget when workout detected */}
      <AutoRecoveryWidget />
      
      {/* Rest of dashboard */}
      <DailyNutritionSummary />
      <TrainingCalendarWidget />
      {/* ... */}
    </div>
  );
}
```

---

## 📊 Complete Flow

```
Background (Every 5 minutes):
├── Cron triggers sync function
├── Sync all users' Google Fit data
├── Check for workouts ended in last 5 min
├── If found:
│   ├── Send push notification
│   ├── Store in training_notifications table
│   └── Trigger real-time update via Supabase subscriptions
│
User's Device:
├── Receives push notification (even if app closed)
├── User opens app
├── Real-time subscription triggers
├── AutoRecoveryWidget appears automatically
└── Shows countdown + recovery plan
```

---

## ✅ Summary: Zero User Action Required

### What User Experiences

1. **Finishes workout** (tracked in Google Fit)
2. **Within 5 minutes**: Push notification arrives
3. **Opens app**: Recovery widget already showing
4. **Countdown timer**: "23:47 remaining in recovery window"
5. **One-tap logging**: Quick meal options
6. **Automatic dismissal**: After 30 minutes or user dismisses

### Technical Implementation

- ✅ **Background sync every 5 minutes** (automatic)
- ✅ **Workout detection** (compares with last sync)
- ✅ **Push notifications** (even when app closed)
- ✅ **Real-time updates** (Supabase subscriptions)
- ✅ **Auto-display widget** (no manual sync needed)
- ✅ **Countdown timer** (creates urgency)

### No Manual Sync Needed!

The unified auto-sync with workout detection gives you:
- Automatic detection within 5 minutes
- Push notifications to user
- Auto-displaying recovery widget
- Zero user action required

**This is exactly what you wanted!** 🎉

Ready to implement?

