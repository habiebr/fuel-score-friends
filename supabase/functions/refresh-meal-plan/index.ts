import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";
import { calculateTDEE } from "../_shared/nutrition.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const today = new Date().toISOString().split('T')[0];

    // Find users with wearable updates in last 15 minutes
    const { data: updatedWearables } = await supabaseAdmin
      .from('wearable_data')
      .select('user_id, date, calories_burned, steps, updated_at')
      .eq('date', today)
      .gte('updated_at', fifteenMinAgo);

    const userIds = Array.from(new Set((updatedWearables || []).map(w => w.user_id)));
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ refreshed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch profiles for these users
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('user_id, weight, height, age, activity_level, fitness_goals, target_date, fitness_level, meal_plan_refresh_mode, timezone')
      .in('user_id', userIds);

    let refreshed = 0;

    for (const profile of profiles || []) {
      const mode = (profile?.meal_plan_refresh_mode || 'daily_6am').toLowerCase();
      // Determine if we should refresh for this profile now
      let shouldRefresh = false;

      if (mode === 'every_15m') {
        // Always refresh on each trigger for users who opted-in
        shouldRefresh = true;
      } else {
        // daily_6am by user timezone: check if now is within the same 15-min window as 06:00 local time
        const tz = profile?.timezone || 'UTC';
        try {
          const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
          const parts = fmt.formatToParts(now);
          const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
          const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
          // Trigger if local time is between 06:00 and 06:14 inclusive
          if (hour === 6 && minute < 15) {
            shouldRefresh = true;
          }
        } catch (_) {
          // Fallback: UTC 06:00 window
          const uhour = now.getUTCHours();
          const umin = now.getUTCMinutes();
          if (uhour === 6 && umin < 15) shouldRefresh = true;
        }
      }

      if (!shouldRefresh) continue;
      // wearable for this user
      const wearable = (updatedWearables || []).find(w => w.user_id === profile.user_id);

      const fitnessGoal = profile?.fitness_goals?.[0];
      const weekPlan = profile?.activity_level ? JSON.parse(profile.activity_level) : null;

      const tdee = calculateTDEE({
        weightKg: profile?.weight,
        heightCm: profile?.height,
        ageYears: profile?.age,
        activityLevel: profile?.activity_level,
        wearableCaloriesToday: wearable?.calories_burned || 0,
        fitnessGoal,
        weekPlan,
      });

      // Reuse generate-meal-plan AI if available via HTTP call to our own endpoint
      const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-meal-plan`;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !serviceKey) continue;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`
        },
        body: JSON.stringify({ date: today })
      });

      if (res.ok) {
        refreshed += 1;
      }
    }

    return new Response(JSON.stringify({ refreshed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


