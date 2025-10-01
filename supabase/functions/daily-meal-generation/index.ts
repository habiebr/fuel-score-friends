import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";
import { calculateTDEE, deriveMacros } from "../_shared/nutrition.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== Daily meal generation started ===");

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all active users
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, fitness_goals, goal_type, goal_name, target_date, fitness_level, activity_level, weight, height, age')
      .not('fitness_goals', 'is', null);

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

        // Generate meal plan using the existing function logic
        const mealPlanData = await generateMealPlanForUser(user, supabaseAdmin);
        
        if (mealPlanData) {
          // Save to database
          const { error: saveError } = await supabaseAdmin
            .from('daily_meal_plans')
            .insert(mealPlanData);

          if (saveError) {
            console.error(`Error saving meal plan for user ${user.user_id}:`, saveError);
          } else {
            console.log(`Meal plan generated successfully for user ${user.user_id}`);
            generatedCount++;
          }
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

async function generateMealPlanForUser(user: any, supabaseAdmin: any) {
  try {
    // Get user's wearable data for today
    const today = new Date().toISOString().split('T')[0];
    const { data: wearableData } = await supabaseAdmin
      .from('wearable_data')
      .select('*')
      .eq('user_id', user.user_id)
      .eq('date', today)
      .maybeSingle();

    const fitnessGoal = user.goal_type || user.fitness_goals?.[0];
    const weekPlan = user.activity_level ? JSON.parse(user.activity_level) : null;
    const tdee = calculateTDEE({
      weightKg: user.weight,
      heightCm: user.height,
      ageYears: user.age,
      activityLevel: user.activity_level,
      wearableCaloriesToday: wearableData?.calories_burned || 0,
      fitnessGoal,
      weekPlan,
    });
    const totalDailyCalories = tdee.totalDailyCalories;
    const trainingIntensity = tdee.trainingIntensity;

    // Generate meal plans for each meal type
    const mealTypes = ['breakfast', 'lunch', 'dinner'];
    const mealPlanData = [];

    for (const mealType of mealTypes) {
      const mealCalories = Math.round(totalDailyCalories * (mealType === 'breakfast' ? 0.30 : mealType === 'lunch' ? 0.40 : 0.30));
      const macros = deriveMacros(mealCalories);

      // Generate Indonesian meal suggestions
      const suggestions = generateIndonesianMealSuggestions(mealType, mealCalories);

      mealPlanData.push({
        user_id: user.user_id,
        date: today,
        meal_type: mealType,
        recommended_calories: mealCalories,
        recommended_protein_grams: macros.proteinGrams,
        recommended_carbs_grams: macros.carbsGrams,
        recommended_fat_grams: macros.fatGrams,
        meal_suggestions: suggestions,
        created_at: new Date().toISOString()
      });
    }

    return mealPlanData;
  } catch (error) {
    console.error('Error generating meal plan for user:', error);
    return null;
  }
}

function generateIndonesianMealSuggestions(mealType: string, targetCalories: number) {
  const suggestions = {
    breakfast: [
      {
        name: "Nasi Uduk + Ayam Goreng",
        description: "Nasi uduk dengan ayam goreng dan sambal kacang",
        foods: [
          "Nasi uduk (150g)",
          "Ayam goreng (100g)", 
          "Sambal kacang (30g)",
          "Timun (50g)",
          "Daun seledri (5g)"
        ],
        calories: 450,
        protein: 25,
        carbs: 45,
        fat: 18
      },
      {
        name: "Bubur Ayam",
        description: "Bubur nasi dengan ayam suwir dan pelengkap",
        foods: [
          "Bubur nasi (200g)",
          "Ayam suwir (80g)", 
          "Kacang kedelai (20g)",
          "Daun seledri (10g)",
          "Bawang goreng (5g)"
        ],
        calories: 380,
        protein: 22,
        carbs: 42,
        fat: 12
      }
    ],
    lunch: [
      {
        name: "Nasi Padang",
        description: "Nasi putih dengan rendang dan sayuran",
        foods: [
          "Nasi putih (150g)",
          "Rendang daging (100g)", 
          "Sayur daun singkong (100g)",
          "Sambal ijo (20g)",
          "Kerupuk (10g)"
        ],
        calories: 650,
        protein: 35,
        carbs: 55,
        fat: 28
      },
      {
        name: "Gado-gado",
        description: "Salad sayuran dengan bumbu kacang",
        foods: [
          "Sayuran segar (200g)",
          "Tahu (80g)", 
          "Tempe (60g)",
          "Bumbu kacang (45g)",
          "Kerupuk (15g)"
        ],
        calories: 420,
        protein: 28,
        carbs: 35,
        fat: 22
      }
    ],
    dinner: [
      {
        name: "Pecel Lele",
        description: "Lele goreng dengan sambal dan lalapan",
        foods: [
          "Lele goreng (200g)",
          "Nasi putih (150g)", 
          "Lalapan (100g)",
          "Sambal terasi (30g)",
          "Daun kemangi (10g)"
        ],
        calories: 520,
        protein: 38,
        carbs: 45,
        fat: 20
      },
      {
        name: "Rawon",
        description: "Sup daging dengan bumbu hitam khas Jawa Timur",
        foods: [
          "Daging sapi (120g)",
          "Nasi putih (150g)", 
          "Tauge (60g)",
          "Bawang goreng (10g)",
          "Sambal (15g)"
        ],
        calories: 480,
        protein: 35,
        carbs: 42,
        fat: 18
      }
    ]
  };

  const mealSuggestions = suggestions[mealType as keyof typeof suggestions] || [];
  
  // Find the suggestion closest to target calories
  const closestSuggestion = mealSuggestions.reduce((closest, current) => {
    const closestDiff = Math.abs(closest.calories - targetCalories);
    const currentDiff = Math.abs(current.calories - targetCalories);
    return currentDiff < closestDiff ? current : closest;
  }, mealSuggestions[0]);

  return [closestSuggestion || mealSuggestions[0]];
}
