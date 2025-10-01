import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";

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
      .select("user_id, weight, height, age, activity_level, fitness_goals");

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

        // Get today's wearable data
        const { data: wearableData } = await supabaseClient
          .from("wearable_data")
          .select("*")
          .eq("user_id", profile.user_id)
          .eq("date", today)
          .maybeSingle();

        // Calculate BMR
        const bmr = profile.weight && profile.height && profile.age
          ? 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5
          : 2000;

        // Activity multipliers
        const activityMultipliers: { [key: string]: number } = {
          sedentary: 1.2,
          light: 1.375,
          moderate: 1.55,
          active: 1.725,
          very_active: 1.9,
          "1_run_per_week": 1.3,
          "2_runs_per_week": 1.4,
          "3_runs_per_week": 1.55,
          "4+_runs_per_week": 1.7,
        };

        const activityMultiplier = activityMultipliers[profile.activity_level || "moderate"] || 1.55;
        let totalDailyCalories = Math.round(bmr * activityMultiplier);

        // Incorporate actual calories burned if available
        if (wearableData?.calories_burned) {
          totalDailyCalories = Math.round(bmr + wearableData.calories_burned);
        }

        // Adjust for fitness goals
        const fitnessGoal = profile.fitness_goals?.[0];
        let calorieAdjustment = 0;

        if (fitnessGoal === 'lose_weight') {
          calorieAdjustment = -500;
        } else if (fitnessGoal === 'gain_muscle') {
          calorieAdjustment = 300;
        }

        totalDailyCalories += calorieAdjustment;

        console.log(`User ${profile.user_id}: BMR=${bmr}, TDEE=${totalDailyCalories}, Goal=${fitnessGoal}`);

        // Calculate macro split based on goal
        let proteinRatio = 0.30, carbsRatio = 0.40, fatRatio = 0.30;

        if (fitnessGoal === 'gain_muscle') {
          proteinRatio = 0.35;
          carbsRatio = 0.40;
          fatRatio = 0.25;
        } else if (fitnessGoal === 'lose_weight') {
          proteinRatio = 0.35;
          carbsRatio = 0.30;
          fatRatio = 0.35;
        } else if (fitnessGoal?.includes('Marathon') || fitnessGoal === 'improve_endurance') {
          proteinRatio = 0.25;
          carbsRatio = 0.50;
          fatRatio = 0.25;
        }

        // Store nutrition plan for each meal
        const mealTypes: Array<"breakfast" | "lunch" | "dinner"> = ["breakfast", "lunch", "dinner"];
        const mealPercentages: { [K in "breakfast" | "lunch" | "dinner"]: number } = { 
          breakfast: 0.30, 
          lunch: 0.40, 
          dinner: 0.30 
        };

        // Generate meal suggestions based on goal and meal type
        const getMealSuggestions = (mealType: string, calories: number, protein: number, carbs: number, fat: number) => {
          const suggestions: any[] = [];

          if (mealType === 'breakfast') {
            if (fitnessGoal === 'gain_muscle') {
              suggestions.push({
                name: "High-Protein Breakfast",
                foods: ["4 scrambled eggs", "2 slices whole wheat toast", "avocado", "Greek yogurt"],
                description: "Protein-packed breakfast to support muscle growth",
                calories, protein, carbs, fat
              });
            } else if (fitnessGoal === 'lose_weight') {
              suggestions.push({
                name: "Light & Filling Breakfast",
                foods: ["Egg white omelette with vegetables", "oatmeal with berries", "black coffee"],
                description: "High protein, high fiber, low calorie breakfast",
                calories, protein, carbs, fat
              });
            } else {
              suggestions.push({
                name: "Balanced Breakfast",
                foods: ["2 eggs", "whole grain toast", "banana", "almond butter"],
                description: "Balanced macros to start your day",
                calories, protein, carbs, fat
              });
            }
          } else if (mealType === 'lunch') {
            if (fitnessGoal === 'gain_muscle') {
              suggestions.push({
                name: "Power Lunch",
                foods: ["Grilled chicken breast 200g", "sweet potato", "broccoli", "quinoa"],
                description: "Lean protein with complex carbs for sustained energy",
                calories, protein, carbs, fat
              });
            } else if (fitnessGoal === 'lose_weight') {
              suggestions.push({
                name: "Lean & Green Lunch",
                foods: ["Grilled fish", "large mixed salad", "olive oil dressing", "cauliflower rice"],
                description: "High protein, low carb lunch option",
                calories, protein, carbs, fat
              });
            } else {
              suggestions.push({
                name: "Balanced Bowl",
                foods: ["Chicken or tofu 150g", "brown rice", "mixed vegetables", "tahini sauce"],
                description: "Complete meal with all macros",
                calories, protein, carbs, fat
              });
            }
          } else if (mealType === 'dinner') {
            if (fitnessGoal === 'gain_muscle') {
              suggestions.push({
                name: "Muscle-Building Dinner",
                foods: ["Lean steak 200g", "baked potato", "green beans", "cottage cheese"],
                description: "High protein dinner for overnight muscle recovery",
                calories, protein, carbs, fat
              });
            } else if (fitnessGoal === 'lose_weight') {
              suggestions.push({
                name: "Light Dinner",
                foods: ["Grilled salmon", "steamed vegetables", "small portion quinoa"],
                description: "Light yet satisfying dinner",
                calories, protein, carbs, fat
              });
            } else {
              suggestions.push({
                name: "Complete Dinner",
                foods: ["Protein (chicken/fish/tofu) 150g", "roasted vegetables", "whole grain side"],
                description: "Balanced dinner to end your day",
                calories, protein, carbs, fat
              });
            }
          }

          return suggestions;
        };

        for (const mealType of mealTypes) {
          const mealCalories = Math.round(totalDailyCalories * mealPercentages[mealType]);
          const mealProtein = Math.round((mealCalories * proteinRatio) / 4);
          const mealCarbs = Math.round((mealCalories * carbsRatio) / 4);
          const mealFat = Math.round((mealCalories * fatRatio) / 9);

          const mealSuggestions = getMealSuggestions(mealType, mealCalories, mealProtein, mealCarbs, mealFat);

          const { error: insertError } = await supabaseClient
            .from("daily_meal_plans")
            .upsert(
              {
                user_id: profile.user_id,
                date: today,
                meal_type: mealType,
                recommended_calories: mealCalories,
                recommended_protein_grams: mealProtein,
                recommended_carbs_grams: mealCarbs,
                recommended_fat_grams: mealFat,
                meal_suggestions: mealSuggestions,
              },
              {
                onConflict: "user_id,date,meal_type",
              }
            );

          if (insertError) {
            console.error(`Error inserting ${mealType} for user ${profile.user_id}:`, insertError);
          }
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
