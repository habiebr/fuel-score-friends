import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/env.ts";
import { addDays, startOfWeek, format, addWeeks } from "https://esm.sh/date-fns@2.30.0";

interface WeeklyPattern {
  day: string;
  activities: {
    activity_type: string;
    duration_minutes: number;
    distance_km: number | null;
    intensity: string;
    estimated_calories: number;
  }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Get all users with activity patterns
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, activity_level")
      .not("activity_level", "is", null);

    if (profilesError) throw profilesError;

    const generationResults = [];
    const today = new Date();
    const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });

    for (const profile of profiles) {
      try {
        const weeklyPattern = JSON.parse(profile.activity_level) as WeeklyPattern[];

        // Delete any existing activities for next week
        await supabaseAdmin
          .from("training_activities")
          .delete()
          .eq("user_id", profile.user_id)
          .gte("date", format(nextWeekStart, "yyyy-MM-dd"))
          .lte("date", format(addDays(nextWeekStart, 6), "yyyy-MM-dd"));

        // Generate activities for next week based on pattern
        const activities = [];
        for (let i = 0; i < 7; i++) {
          const date = addDays(nextWeekStart, i);
          const pattern = weeklyPattern[i];
          
          if (pattern && pattern.activities.length > 0) {
            for (const act of pattern.activities) {
              activities.push({
                user_id: profile.user_id,
                date: format(date, "yyyy-MM-dd"),
                activity_type: act.activity_type,
                duration_minutes: act.duration_minutes,
                distance_km: act.distance_km,
                intensity: act.intensity,
                estimated_calories: act.estimated_calories,
                start_time: null,
                notes: null
              });
            }
          }
        }

        if (activities.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from("training_activities")
            .insert(activities);
          
          if (insertError) throw insertError;
        }

        generationResults.push({
          user_id: profile.user_id,
          success: true,
          activities_generated: activities.length
        });

      } catch (error) {
        console.error(`Error generating activities for user ${profile.user_id}:`, error);
        generationResults.push({
          user_id: profile.user_id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      results: generationResults
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});