import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/env.ts";
import { generateUserMealPlan, mealPlanToDbRecords } from "../_shared/meal-planner.ts";
import { UserProfile } from "../_shared/nutrition-unified.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== Daily meal generation started ===");

  try {
    // Create admin client with service role key
    const supabaseAdmin = getSupabaseAdmin();

    // Get all users with required profile fields
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, weight_kg, height_cm, age, sex');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    if (!users || users.length === 0) {
      console.log('No users found for meal generation');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No users found for meal generation',
        generated: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let generatedCount = 0;
    const today = new Date().toISOString().split('T')[0];

    // Process each user
    for (const user of users) {
      try {
        console.log(`Generating meal plan for user: ${user.user_id}`);

        // Check if meal plan already exists for today
        const { data: existingPlan } = await supabaseAdmin
          .from('daily_meal_plans')
          .select('id')
          .eq('user_id', user.user_id)
          .eq('date', today)
          .maybeSingle();

        if (existingPlan) {
          console.log(`Meal plan already exists for user ${user.user_id} on ${today}`);
          continue;
        }

        // Build user profile
        const profile: UserProfile = {
          weightKg: user.weight_kg || 70,
          heightCm: user.height_cm || 170,
          age: user.age || 30,
          sex: (user.sex || 'male') as 'male' | 'female',
        };

        // Fetch Google Fit data for today (if any)
        const { data: fit } = await supabaseAdmin
          .from('google_fit_data')
          .select('calories_burned')
          .eq('user_id', user.user_id)
          .eq('date', today)
          .maybeSingle();

        // Generate meal plan using unified service (no AI for batch)
        const plan = await generateUserMealPlan({
          userId: user.user_id,
          date: today,
          userProfile: profile,
          trainingActivity: 'rest',
          googleFitCalories: fit?.calories_burned || 0,
          useAI: false,
        });

        const records = mealPlanToDbRecords(user.user_id, plan);
        const { error: saveError } = await supabaseAdmin
          .from('daily_meal_plans')
          .upsert(records, { onConflict: 'user_id,date,meal_type' });

        if (saveError) {
          console.error(`Error saving meal plan for user ${user.user_id}:`, saveError);
        } else {
          console.log(`Meal plan generated successfully for user ${user.user_id}`);
          generatedCount++;
        }
      } catch (userError) {
        console.error(`Error processing user ${user.user_id}:`, userError);
        // Continue with next user
      }
    }

    console.log(`Daily meal generation completed. Generated ${generatedCount} meal plans.`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Generated ${generatedCount} meal plans for ${users.length} users`,
      generated: generatedCount,
      total_users: users.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Error in daily meal generation:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Removed legacy helpers: now using shared meal-planner
