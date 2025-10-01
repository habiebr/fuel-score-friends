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
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { date } = await req.json();
    const targetDate = date || new Date().toISOString().split("T")[0];

    console.log(`Generating meal plan for user ${user.id} on ${targetDate}`);

    // Fetch user profile
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Fetch recent wearable data with comprehensive metrics
    const { data: wearableData } = await supabaseClient
      .from("wearable_data")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", targetDate)
      .single();

    // Fetch recent 7-day wearable data for trends
    const sevenDaysAgo = new Date(targetDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: recentWearableData } = await supabaseClient
      .from("wearable_data")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", sevenDaysAgo.toISOString().split("T")[0])
      .order("date", { ascending: false })
      .limit(7);

    // Calculate daily calorie needs with enhanced logic
    const bmr = profile?.weight && profile?.height && profile?.age
      ? 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5
      : 2000;

    const activityMultipliers: { [key: string]: number } = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    };
    const activityMultiplier = activityMultipliers[profile?.activity_level || "moderate"] || 1.55;

    // Calculate TDEE (Total Daily Energy Expenditure)
    let totalDailyCalories = Math.round(bmr * activityMultiplier);

    // If wearable data exists, incorporate actual calories burned
    if (wearableData?.calories_burned) {
      // Use actual burned calories + BMR as baseline
      totalDailyCalories = Math.round(bmr + wearableData.calories_burned);
    }

    // Adjust based on fitness goal
    const fitnessGoal = profile?.fitness_goals?.[0];
    let calorieAdjustment = 0;
    
    if (fitnessGoal === 'lose_weight') {
      calorieAdjustment = -500; // 500 calorie deficit for weight loss
    } else if (fitnessGoal === 'gain_muscle') {
      calorieAdjustment = 300; // 300 calorie surplus for muscle gain
    }
    
    totalDailyCalories += calorieAdjustment;

    console.log(`Calculated nutrition needs - BMR: ${bmr}, TDEE: ${totalDailyCalories}, Goal: ${fitnessGoal}`);

    // Calculate average metrics from recent data
    const avgMetrics = recentWearableData?.length ? {
      avgCalories: Math.round(recentWearableData.reduce((sum, d) => sum + (d.calories_burned || 0), 0) / recentWearableData.length),
      avgSteps: Math.round(recentWearableData.reduce((sum, d) => sum + (d.steps || 0), 0) / recentWearableData.length),
      avgHeartRate: Math.round(recentWearableData.reduce((sum, d) => sum + (d.heart_rate_avg || 0), 0) / recentWearableData.length),
      avgSleep: (recentWearableData.reduce((sum, d) => sum + (d.sleep_hours || 0), 0) / recentWearableData.length).toFixed(1),
      avgDistance: (recentWearableData.reduce((sum, d) => sum + (d.distance_meters || 0), 0) / recentWearableData.length / 1000).toFixed(1),
    } : null;

    // Use AI to generate detailed meal suggestions
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const context = `
User Profile:
- Age: ${profile?.age || "unknown"}
- Weight: ${profile?.weight || "unknown"} kg
- Height: ${profile?.height || "unknown"} cm
- BMR (Basal Metabolic Rate): ${bmr} kcal
- Activity Level: ${profile?.activity_level || "moderate"}
- Fitness Goals: ${fitnessGoal || "general fitness"}
- Location: Melbourne, Australia

Today's Activity Metrics:
- Calories burned: ${wearableData?.calories_burned || 0} kcal
- Steps: ${wearableData?.steps || 0}
- Distance: ${wearableData?.distance_meters ? (wearableData.distance_meters / 1000).toFixed(2) : 0} km
- Active minutes: ${wearableData?.active_minutes || 0}
- Average heart rate: ${wearableData?.heart_rate_avg || "N/A"} bpm
- Max heart rate: ${wearableData?.max_heart_rate || "N/A"} bpm
- Sleep hours: ${wearableData?.sleep_hours || "N/A"} hours
- Training effect: ${wearableData?.training_effect || "N/A"}
- Recovery time needed: ${wearableData?.recovery_time || "N/A"} hours
- Activity type: ${wearableData?.activity_type || "general"}

7-Day Average Trends:
${avgMetrics ? `- Average calories burned: ${avgMetrics.avgCalories} kcal/day
- Average steps: ${avgMetrics.avgSteps} steps/day
- Average heart rate: ${avgMetrics.avgHeartRate} bpm
- Average sleep: ${avgMetrics.avgSleep} hours/night
- Average distance: ${avgMetrics.avgDistance} km/day` : "- No recent data available"}

Daily Calorie Target: ${totalDailyCalories} kcal
${calorieAdjustment !== 0 ? `(Adjusted ${calorieAdjustment > 0 ? '+' : ''}${calorieAdjustment} kcal for ${fitnessGoal?.replace('_', ' ')})` : ''}

IMPORTANT LOCATION-SPECIFIC REQUIREMENTS:
- User is based in MELBOURNE, AUSTRALIA
- Suggest locally available Australian ingredients and foods
- Include Melbourne café culture options (e.g., smashed avo, flat whites, grain bowls)
- Use Australian produce that's in season
- Include multicultural Melbourne options (Asian fusion, Mediterranean, etc.)
- Suggest realistic portions and foods available at local supermarkets (Coles, Woolworths)
- Consider Australian dietary preferences and local food culture
- Use metric measurements (grams, ml)

MEAL PLANNING REQUIREMENTS:
This meal plan must match the user's fitness goal and activity level:
${fitnessGoal === 'lose_weight' ? '- Focus on high protein, moderate carbs, filling foods with controlled portions' : ''}
${fitnessGoal === 'gain_muscle' ? '- Emphasize high protein (2g per kg body weight), sufficient carbs for energy, healthy fats' : ''}
${fitnessGoal === 'improve_endurance' ? '- Balance carbs for energy, adequate protein for recovery' : ''}

Consider the user's wearable data:
- If training effect is high or recovery time is significant, recommend more protein and anti-inflammatory foods
- If sleep quality is poor, suggest foods that promote better sleep (magnesium, tryptophan)
- If heart rate trends are elevated, consider hydration and electrolyte-rich foods
- For high-intensity activity days, increase carb recommendations for recovery
- Account for actual calories burned to prevent under/over-eating

Create a complete daily meal plan with SPECIFIC meal suggestions for breakfast (30%), lunch (40%), and dinner (30%).

For each meal, provide 2-3 realistic meal options with:
- Specific meal name (Melbourne-style where appropriate)
- List of locally available foods/ingredients
- Brief appetizing description
- Accurate macros (calories, protein, carbs, fat)

Make suggestions practical, tasty, culturally diverse, and SPECIFICALLY tailored to Melbourne/Australian availability.

Examples of Melbourne-appropriate meals:
- Breakfast: Smashed avocado on sourdough with poached eggs and feta
- Lunch: Poke bowl with sushi-grade salmon from Melbourne Fish Market
- Dinner: Grilled barramundi with roasted vegetables and quinoa

Return ONLY valid JSON in this exact format:
{
  "breakfast": {
    "target_calories": ${Math.round(totalDailyCalories * 0.30)},
    "target_protein": ${Math.round((totalDailyCalories * 0.30 * 0.30) / 4)},
    "target_carbs": ${Math.round((totalDailyCalories * 0.30 * 0.40) / 4)},
    "target_fat": ${Math.round((totalDailyCalories * 0.30 * 0.30) / 9)},
    "suggestions": [
      {
        "name": "Meal name (Melbourne-style)",
        "foods": ["locally available ingredient 1", "ingredient 2", "ingredient 3"],
        "description": "Brief description",
        "calories": ${Math.round(totalDailyCalories * 0.30)},
        "protein": ${Math.round((totalDailyCalories * 0.30 * 0.30) / 4)},
        "carbs": ${Math.round((totalDailyCalories * 0.30 * 0.40) / 4)},
        "fat": ${Math.round((totalDailyCalories * 0.30 * 0.30) / 9)}
      }
    ]
  },
  "lunch": { ... same structure with 40% calories ... },
  "dinner": { ... same structure with 30% calories ... }
}
`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are an expert nutritionist and meal planner. Create practical, delicious meal plans. Return ONLY valid JSON, no markdown formatting.",
            },
            {
              role: "user",
              content: context,
            },
          ],
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!aiResponse.ok) {
      console.error("AI API error:", aiResponse.status);
      throw new Error("Failed to generate meal suggestions");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    console.log("AI Response:", content);
    
    let mealPlan;
    try {
      mealPlan = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      // Fallback to basic meal plan
      mealPlan = {
        breakfast: {
          target_calories: Math.round(totalDailyCalories * 0.30),
          target_protein: Math.round((totalDailyCalories * 0.30 * 0.30) / 4),
          target_carbs: Math.round((totalDailyCalories * 0.30 * 0.40) / 4),
          target_fat: Math.round((totalDailyCalories * 0.30 * 0.30) / 9),
          suggestions: [],
        },
        lunch: {
          target_calories: Math.round(totalDailyCalories * 0.40),
          target_protein: Math.round((totalDailyCalories * 0.40 * 0.30) / 4),
          target_carbs: Math.round((totalDailyCalories * 0.40 * 0.40) / 4),
          target_fat: Math.round((totalDailyCalories * 0.40 * 0.30) / 9),
          suggestions: [],
        },
        dinner: {
          target_calories: Math.round(totalDailyCalories * 0.30),
          target_protein: Math.round((totalDailyCalories * 0.30 * 0.30) / 4),
          target_carbs: Math.round((totalDailyCalories * 0.30 * 0.40) / 4),
          target_fat: Math.round((totalDailyCalories * 0.30 * 0.30) / 9),
          suggestions: [],
        },
      };
    }

    // Store meal plans for each meal type
    const mealTypes = ["breakfast", "lunch", "dinner"];

    for (const mealType of mealTypes) {
      const meal = mealPlan[mealType];
      if (!meal) continue;

      const { error: insertError } = await supabaseClient
        .from("daily_meal_plans")
        .upsert(
          {
            user_id: user.id,
            date: targetDate,
            meal_type: mealType,
            recommended_calories: meal.target_calories || 0,
            recommended_protein_grams: meal.target_protein || 0,
            recommended_carbs_grams: meal.target_carbs || 0,
            recommended_fat_grams: meal.target_fat || 0,
            meal_suggestions: meal.suggestions || [],
          },
          {
            onConflict: "user_id,date,meal_type",
          }
        );

      if (insertError) {
        console.error(`Error inserting ${mealType} plan:`, insertError);
      }
    }

    console.log(`Successfully generated meal plan for ${targetDate}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalDailyCalories,
        mealPlan,
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
