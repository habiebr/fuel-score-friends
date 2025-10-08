// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};
import { getSupabaseAdmin, getGroqKey } from "../_shared/env.ts";
import {
  generateUserMealPlan,
  mealPlanToDbRecords,
  type MealPlanOptions
} from "../_shared/meal-planner.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== Unified Meal Plan Generation Started ===");

  try {
    console.log("1. Extracting user from JWT...");
    
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
    
    // Decode JWT (it's a base64 encoded JSON in the middle part)
    let userId: string;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error("Invalid token format");
      }
      const payload = JSON.parse(atob(parts[1]));
      userId = payload.sub;
      console.log(`2. User ID extracted from JWT: ${userId}`);
    } catch (e) {
      console.error("JWT decode error:", e);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client with service role key for database operations
    const supabaseAdmin = getSupabaseAdmin();

    const { date } = await req.json();
    const requestDate = date || new Date().toISOString().split("T")[0];
    const requestDateObj = new Date(requestDate + 'T00:00:00');
    const requestWeekday = requestDateObj.toLocaleDateString('en-US', { weekday: 'long' });

    console.log(`3. Generating meal plan for user ${userId} on ${requestDate}`);

    // Fetch user profile
    console.log("4. Fetching user profile...");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    
    if (profileError) {
      console.error("Profile error:", profileError);
    }
    console.log("Profile data:", profile ? "found" : "not found");

    // Fetch Google Fit data for actual calories burned
    const { data: googleFitData } = await supabaseAdmin
      .from("google_fit_data")
      .select("*")
      .eq("user_id", userId)
      .eq("date", requestDate)
      .single();

    // Get training plan for today
    const fitnessGoal = profile?.goal_type || profile?.fitness_goals?.[0];
    const weekPlan = profile?.activity_level ? JSON.parse(profile.activity_level) : null;
    const dayPlan = Array.isArray(weekPlan) ? weekPlan.find((d: any) => d && d.day === requestWeekday) : null;

    // Create user profile for unified engine
    const userProfile = {
      weightKg: profile?.weight_kg || profile?.weight || 70,
      heightCm: profile?.height_cm || profile?.height || 170,
      age: profile?.age || 30,
      sex: (profile?.sex || 'male') as 'male' | 'female'
    };

    console.log("5. Using unified meal planner service...");
    
    // Generate meal plan using unified service
    const mealPlanOptions: MealPlanOptions = {
      userId,
      date: requestDate,
      userProfile,
      trainingActivity: dayPlan?.activity || 'rest',
      trainingDuration: dayPlan?.duration,
      trainingDistance: dayPlan?.distanceKm,
      googleFitCalories: googleFitData?.calories_burned,
      useAI: true,
      groqApiKey: getGroqKey()
    };

    const mealPlanResult = await generateUserMealPlan(mealPlanOptions);
    
    console.log(`6. Generated meal plan with ${mealPlanResult.totalCalories} total calories`);
    console.log(`- Training Load: ${mealPlanResult.trainingLoad}`);
    console.log(`- Meals: ${Object.keys(mealPlanResult.meals).join(', ')}`);

    // Convert to database records
    console.log("7. Converting to database records...");
    const dbRecords = mealPlanToDbRecords(userId, mealPlanResult);

    // Save to database
    console.log("8. Saving meal plans to database...");
    for (const record of dbRecords) {
      const { error: insertError } = await supabaseAdmin
        .from("daily_meal_plans")
        .upsert(record, {
            onConflict: "user_id,date,meal_type",
        });

      if (insertError) {
        console.error(`Error inserting ${record.meal_type} plan:`, insertError);
      } else {
        console.log(`${record.meal_type} plan saved successfully`);
      }
    }

    console.log(`9. Successfully generated and saved meal plan for ${requestDate}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalCalories: mealPlanResult.totalCalories,
        trainingLoad: mealPlanResult.trainingLoad,
        meals: mealPlanResult.meals,
        message: "Meal plan generated using unified nutrition engine and saved to database"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating meal plan:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
