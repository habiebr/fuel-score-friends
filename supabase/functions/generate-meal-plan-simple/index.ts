import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== Simple Meal Plan Generation Started ===");

    // Get the JWT token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No Authorization header");
      return new Response(JSON.stringify({ error: "Authorization header missing" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract and decode JWT to get user ID
    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error("Invalid token format");
      }
      const payload = JSON.parse(atob(parts[1]));
      userId = payload.sub;
      console.log(`User ID extracted from JWT: ${userId}`);
    } catch (e) {
      console.error("JWT decode error:", e);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const date = body.date || new Date().toISOString().split('T')[0];
    const trainingActivity = body.trainingActivity || 'rest';
    const trainingDuration = body.trainingDuration || 0;
    const googleFitCalories = body.googleFitCalories || 0;

    console.log(`Generating meal plan for user ${userId} on ${date}`);

    // Check if meal plan already exists
    const { data: existingPlans } = await supabaseAdmin
      .from('daily_meal_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date);

    if (existingPlans && existingPlans.length > 0) {
      console.log("Meal plan already exists, returning existing data");
      return new Response(JSON.stringify({
        success: true,
        mealPlan: {
          date,
          training_load: trainingActivity,
          total_calories: existingPlans.reduce((sum, plan) => sum + plan.recommended_calories, 0),
          meals: existingPlans.reduce((acc, plan) => {
            acc[plan.meal_type] = {
              kcal: plan.recommended_calories,
              cho_g: plan.recommended_carbs_grams,
              protein_g: plan.recommended_protein_grams,
              fat_g: plan.recommended_fat_grams
            };
            return acc;
          }, {})
        },
        message: "Existing meal plan returned"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate new meal plan using SQL function
    const { data: functionResult, error: functionError } = await supabaseAdmin
      .rpc('generate_user_meal_plan', {
        p_user_id: userId,
        p_date: date,
        p_training_activity: trainingActivity,
        p_training_duration: trainingDuration,
        p_google_fit_calories: googleFitCalories
      });

    if (functionError) {
      console.error("Function error:", functionError);
      return new Response(JSON.stringify({ error: functionError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Meal plan generated successfully");

    return new Response(JSON.stringify({
      success: true,
      mealPlan: functionResult,
      message: "Meal plan generated using database function"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error generating meal plan:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});