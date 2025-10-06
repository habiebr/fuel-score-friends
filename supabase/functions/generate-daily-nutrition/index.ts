import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";
import { generateUserMealPlan, mealPlanToDbRecords } from "../_shared/meal-planner.ts";
import { UserProfile } from "../_shared/nutrition-unified.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Starting daily nutrition generation for all users");

    // Get all users with profiles
    const { data: profiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select("user_id, weight_kg, height_cm, age, sex");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} users to process`);

    const today = new Date().toISOString().split("T")[0];
    let successCount = 0;
    let errorCount = 0;

    // Process each user
    for (const profile of profiles || []) {
      try {
        console.log(`Processing user ${profile.user_id}`);

        // Build user profile and generate via unified service
        const userProfile: UserProfile = {
          weightKg: profile.weight_kg || 70,
          heightCm: profile.height_cm || 170,
          age: profile.age || 30,
          sex: (profile.sex || 'male') as 'male' | 'female',
        };

        const plan = await generateUserMealPlan({
          userId: profile.user_id,
          date: today,
          userProfile,
          trainingActivity: 'rest',
          googleFitCalories: 0,
          useAI: false,
        });

        const records = mealPlanToDbRecords(profile.user_id, plan);
        const { error: insertError } = await supabaseClient
          .from('daily_meal_plans')
          .upsert(records, { onConflict: 'user_id,date,meal_type' });

        if (insertError) {
          console.error(`Error inserting meal plan for user ${profile.user_id}:`, insertError);
        }

        successCount++;
        console.log(`✓ Generated nutrition plan for user ${profile.user_id}`);
      } catch (userError) {
        errorCount++;
        console.error(`✗ Error processing user ${profile.user_id}:`, userError);
      }
    }

    console.log(`Daily nutrition generation complete: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: profiles?.length || 0,
        successCount,
        errorCount,
        date: today,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-daily-nutrition:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
