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

    const generationResults: any[] = [];
    const today = new Date();
    const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });

    for (const profile of profiles) {
      try {
        const weeklyPattern = JSON.parse(profile.activity_level) as WeeklyPattern[];

        // Check for Runna activities for next week
        const { data: runnaActivities } = await supabaseAdmin
          .from("training_activities")
          .select("date")
          .eq("user_id", profile.user_id)
          .eq("is_from_runna", true)
          .eq("is_actual", false)
          .gte("date", format(nextWeekStart, "yyyy-MM-dd"))
          .lte("date", format(addDays(nextWeekStart, 6), "yyyy-MM-dd"));

        // Create Set of dates that have Runna activities
        const runnaDates = new Set(
          (runnaActivities || []).map(a => a.date)
        );

        console.log(`User ${profile.user_id}: Runna has ${runnaDates.size} activities for next week`);

        // Delete ONLY pattern-generated activities (not Runna, not actual, not manual)
        await supabaseAdmin
          .from("training_activities")
          .delete()
          .eq("user_id", profile.user_id)
          .eq("is_from_runna", false)
          .eq("is_actual", false)
          .gte("date", format(nextWeekStart, "yyyy-MM-dd"))
          .lte("date", format(addDays(nextWeekStart, 6), "yyyy-MM-dd"));

        // Generate activities for next week, skipping Runna dates
        const activities = [];
        let skippedCount = 0;
        
        for (let i = 0; i < 7; i++) {
          const date = addDays(nextWeekStart, i);
          const dateStr = format(date, "yyyy-MM-dd");
          const pattern = weeklyPattern[i];
          
          // Skip if Runna has an activity for this date
          if (runnaDates.has(dateStr)) {
            console.log(`⏭️  Skipping ${dateStr} - has Runna activity`);
            skippedCount++;
            continue;
          }
          
          // Generate pattern activity for this date (Runna doesn't have it)
          if (pattern && pattern.activities.length > 0) {
            for (const act of pattern.activities) {
              activities.push({
                user_id: profile.user_id,
                date: dateStr,
                activity_type: act.activity_type,
                duration_minutes: act.duration_minutes,
                distance_km: act.distance_km,
                intensity: act.intensity,
                estimated_calories: act.estimated_calories,
                start_time: null,
                notes: null,
                is_from_runna: false,
                is_actual: false
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
          activities_generated: activities.length,
          skipped_for_runna: skippedCount
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