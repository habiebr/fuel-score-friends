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
  type TrainingLoad,
  type UserProfile,
  determineTrainingLoad,
  generateDayTarget,
  shouldIncludeSnack,
} from "../_shared/nutrition-unified.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== Meal plan generation started ===");

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

    // Fetch Google Fit data (replaces wearable_data)
    const { data: googleFitData } = await supabaseAdmin
      .from("google_fit_data")
      .select("*")
      .eq("user_id", userId)
      .eq("date", requestDate)
      .single();

    // Fetch recent 7-day Google Fit data for trends
    const sevenDaysAgo = new Date(requestDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: recentFitData } = await supabaseAdmin
      .from("google_fit_data")
      .select("*")
      .eq("user_id", userId)
      .gte("date", sevenDaysAgo.toISOString().split("T")[0])
      .order("date", { ascending: false })
      .limit(7);

    // Get training plan for today
    const fitnessGoal = profile?.goal_type || profile?.fitness_goals?.[0];
    const weekPlan = profile?.activity_level ? JSON.parse(profile.activity_level) : null;
    const dayPlan = Array.isArray(weekPlan) ? weekPlan.find((d: any) => d && d.day === requestWeekday) : null;
    
    // Determine training load using unified engine
    const trainingLoad: TrainingLoad = determineTrainingLoad(
      dayPlan?.activity || 'rest',
      dayPlan?.duration,
      dayPlan?.distanceKm
    );

    // Create user profile for unified engine
    const userProfile: UserProfile = {
      weightKg: profile?.weight_kg || profile?.weight || 70,
      heightCm: profile?.height_cm || profile?.height || 170,
      age: profile?.age || 30,
      sex: (profile?.sex || 'male') as 'male' | 'female'
    };

    // Generate day target using unified engine
    const dayTarget = generateDayTarget(userProfile, requestDate, trainingLoad);
    
    const totalDailyCalories = dayTarget.kcal;
    const targetDate = profile?.target_date;
    const fitnessLevel = profile?.fitness_level;
    const plannedCalories = dayPlan?.estimatedCalories ?? dayPlan?.plannedCalories ?? null;
    
    console.log(`Calculated nutrition needs using unified engine:`);
    console.log(`- Training Load: ${trainingLoad}`);
    console.log(`- TDEE: ${totalDailyCalories} kcal`);
    console.log(`- Macros: CHO ${dayTarget.cho_g}g, Protein ${dayTarget.protein_g}g, Fat ${dayTarget.fat_g}g`);
    console.log(`- Goal: ${fitnessGoal}`);

    // Calculate average metrics from recent data
    const avgMetrics = recentFitData?.length ? {
      avgCalories: Math.round(recentFitData.reduce((sum, d) => sum + (d.calories_burned || 0), 0) / recentFitData.length),
      avgSteps: Math.round(recentFitData.reduce((sum, d) => sum + (d.steps || 0), 0) / recentFitData.length),
      avgHeartRate: Math.round(recentFitData.reduce((sum, d) => sum + (d.heart_rate_avg || 0), 0) / recentFitData.length),
      avgDistance: (recentFitData.reduce((sum, d) => sum + (d.distance_meters || 0), 0) / recentFitData.length / 1000).toFixed(1),
    } : null;

    // Use AI to generate detailed meal suggestions
    console.log("5. Preparing AI request...");
    const GROQ_API_KEY = getGroqKey();
    const trainingDescription = dayPlan
      ? `${dayPlan.activity}${typeof dayPlan.distanceKm === 'number'
        ? ` ${dayPlan.distanceKm} km`
        : dayPlan.duration
          ? ` for ${dayPlan.duration} minutes`
          : ''}${plannedCalories !== null ? ` (${plannedCalories} calories est.)` : ''}`
      : "rest day";

    const context = `
Date: ${requestDate} (${requestWeekday})
User Profile:
- Age: ${userProfile.age}
- Weight: ${userProfile.weightKg} kg
- Height: ${userProfile.heightCm} cm
- Sex: ${userProfile.sex}
- Fitness Goals: ${fitnessGoal || "general fitness"}
- Target Race Date: ${targetDate || "not set"}
- Fitness Level: ${fitnessLevel || "intermediate"}
- Location: Indonesia

Calculated Nutrition Targets (Unified Engine):
- Training Load: ${trainingLoad} (rest/easy/moderate/long/quality)
- TDEE: ${totalDailyCalories} kcal
- Carbohydrates: ${dayTarget.cho_g}g (${Math.round((dayTarget.cho_g * 4 / totalDailyCalories) * 100)}%)
- Protein: ${dayTarget.protein_g}g (${Math.round((dayTarget.protein_g * 4 / totalDailyCalories) * 100)}%)
- Fat: ${dayTarget.fat_g}g (${Math.round((dayTarget.fat_g * 9 / totalDailyCalories) * 100)}%)

Running Goals & Training Plan:
- Primary Goal: ${fitnessGoal || "general fitness"}
- Target Date: ${targetDate || "not specified"}
- Current Fitness Level: ${fitnessLevel || "intermediate"}
- Weekly Training Plan: ${weekPlan ? JSON.stringify(weekPlan, null, 2) : "not set"}
- Today's Training: ${trainingDescription}

Today's Activity Metrics (Google Fit):
- Calories burned: ${googleFitData?.calories_burned || 0} kcal
- Steps: ${googleFitData?.steps || 0}
- Distance: ${googleFitData?.distance_meters ? (googleFitData.distance_meters / 1000).toFixed(2) : 0} km
- Active minutes: ${googleFitData?.active_minutes || 0}
- Average heart rate: ${googleFitData?.heart_rate_avg || "N/A"} bpm

7-Day Average Trends (Google Fit):
${avgMetrics ? `- Average calories burned: ${avgMetrics.avgCalories} kcal/day
- Average steps: ${avgMetrics.avgSteps} steps/day
- Average heart rate: ${avgMetrics.avgHeartRate} bpm
- Average distance: ${avgMetrics.avgDistance} km/day` : "- No recent data available"}

Daily Calorie Target: ${totalDailyCalories} kcal (includes planned training load for this day)

IMPORTANT LOCATION-SPECIFIC REQUIREMENTS:
- User is based in INDONESIA
- Suggest authentic Indonesian ingredients and foods
- Include traditional Indonesian dishes and modern Indonesian cuisine
- Use Indonesian produce that's in season and locally available
- Include regional Indonesian specialties (Javanese, Sumatran, Balinese, etc.)
- Suggest realistic portions and foods available at local markets (pasar tradisional, supermarket)
- Consider Indonesian dietary preferences and food culture
- Use metric measurements (grams, ml) and Indonesian portion sizes
- Include Indonesian cooking methods (tumis, goreng, rebus, bakar, etc.)

MEAL PLANNING REQUIREMENTS:
This meal plan must match the user's running goals and training intensity:

RUNNING-SPECIFIC NUTRITION:
${fitnessGoal && fitnessGoal.includes('marathon') ? '- MARATHON TRAINING: High carb intake (60-70% of calories), adequate protein for muscle repair, focus on endurance nutrition' : ''}
${fitnessGoal && fitnessGoal.includes('half') ? '- HALF MARATHON TRAINING: Balanced carbs and protein, focus on sustained energy and recovery' : ''}
${fitnessGoal && (fitnessGoal.includes('5k') || fitnessGoal.includes('10k')) ? '- SHORT DISTANCE TRAINING: Moderate carbs, higher protein for speed and power, quick recovery foods' : ''}
${fitnessGoal === 'lose_weight' ? '- WEIGHT LOSS: High protein, moderate carbs, filling foods with controlled portions' : ''}
${fitnessGoal === 'gain_muscle' ? '- MUSCLE GAIN: High protein (2g per kg body weight), sufficient carbs for energy, healthy fats' : ''}

TRAINING DAY ADJUSTMENTS (Based on Unified Engine):
${trainingLoad === 'quality' ? '- QUALITY/INTERVAL DAY: Extra carbs 2-3 hours before, protein within 30 minutes after, CHO-focused (55%)' : ''}
${trainingLoad === 'long' ? '- LONG RUN DAY: High carbs for endurance, adequate protein for recovery, CHO-focused (55%)' : ''}
${trainingLoad === 'moderate' ? '- MODERATE RUN DAY: Balanced nutrition, 50% carbs, 25% protein, 25% fat' : ''}
${trainingLoad === 'easy' ? '- EASY RUN DAY: Standard balanced nutrition with higher protein (30%)' : ''}
${trainingLoad === 'rest' ? '- REST DAY: Lower carbs (40%), higher protein (30%) for recovery and muscle repair' : ''}

Consider the user's Google Fit data:
- If heart rate trends are elevated, consider hydration and electrolyte-rich foods
- For high-intensity activity days (long/quality load), increase carb recommendations for recovery
- Account for actual calories burned to prevent under/over-eating

Create a complete daily meal plan with SPECIFIC meal suggestions based on unified engine distribution:
${shouldIncludeSnack(trainingLoad) ? '- Breakfast (25%), Lunch (35%), Dinner (30%), Snack (10%) - INTENSE TRAINING DAY' : '- Breakfast (30%), Lunch (40%), Dinner (30%) - STANDARD/EASY DAY'}

For each meal, provide 2-3 realistic meal options with:
- Specific meal name (Indonesian-style)
- List of locally available foods/ingredients with EXACT gram portions (e.g., "Nasi putih (150g)", "Ayam goreng (100g)")
- Brief appetizing description
- Accurate macros (calories, protein, carbs, fat)

RUNNING-SPECIFIC SNACKS & RECOVERY:
${dayPlan && dayPlan.activity === 'run' ? `- PRE-RUN (1-2 hours before): Quick carbs like pisang (banana), kurma (dates), or energy gel
- DURING RUN (if >60 minutes): Sports drink, energy gel, or kurma
- POST-RUN (within 30 minutes): Protein shake with susu kedelai, or pisang dengan susu
- RECOVERY SNACKS: Kacang almond, yogurt dengan madu, or smoothie buah lokal
- ELECTROLYTE REPLENISHMENT: Air kelapa muda, isotonic drink, or buah-buahan tinggi kalium` : ''}

IMPORTANT: All food ingredients MUST include precise gram measurements to help runners with portion control and nutrition tracking.

Make suggestions practical, tasty, culturally diverse, and SPECIFICALLY tailored to Indonesian availability.

Examples of Indonesian-appropriate meals:
- Breakfast: Nasi uduk dengan ayam goreng dan sambal kacang
- Lunch: Gado-gado dengan bumbu kacang dan kerupuk
- Dinner: Rendang daging dengan nasi putih dan sayur daun singkong
- Snacks: Pisang dengan susu kedelai, kacang almond panggang, air kelapa muda

Return ONLY valid JSON in this exact format:
{
  "breakfast": {
    "target_calories": ${Math.round(totalDailyCalories * 0.30)},
    "target_protein": ${Math.round((totalDailyCalories * 0.30 * 0.30) / 4)},
    "target_carbs": ${Math.round((totalDailyCalories * 0.30 * 0.40) / 4)},
    "target_fat": ${Math.round((totalDailyCalories * 0.30 * 0.30) / 9)},
    "suggestions": [
      {
        "name": "Nama makanan Indonesia",
        "foods": ["Bahan lokal 1 (100g)", "Bahan 2 (50g)", "Bahan 3 (30g)"],
        "description": "Deskripsi singkat dalam bahasa Indonesia",
        "calories": ${Math.round(totalDailyCalories * 0.30)},
        "protein": ${Math.round((totalDailyCalories * 0.30 * 0.30) / 4)},
        "carbs": ${Math.round((totalDailyCalories * 0.30 * 0.40) / 4)},
        "fat": ${Math.round((totalDailyCalories * 0.30 * 0.30) / 9)}
      }
    ]
  },
  "lunch": { ... same structure with 40% calories ... },
  "dinner": { ... same structure with 30% calories ... },
  ${dayPlan && dayPlan.activity === 'run' ? `"snack": {
    "target_calories": ${Math.round(totalDailyCalories * 0.10)},
    "target_protein": ${Math.round((totalDailyCalories * 0.10 * 0.20) / 4)},
    "target_carbs": ${Math.round((totalDailyCalories * 0.10 * 0.60) / 4)},
    "target_fat": ${Math.round((totalDailyCalories * 0.10 * 0.20) / 9)},
    "suggestions": [
      {
        "name": "Pisang dengan susu kedelai",
        "foods": ["Pisang (120g)", "Susu kedelai (200ml)", "Madu (15g)"],
        "description": "Snack pemulihan pasca lari dengan protein dan karbohidrat cepat",
        "calories": ${Math.round(totalDailyCalories * 0.10)},
        "protein": ${Math.round((totalDailyCalories * 0.10 * 0.20) / 4)},
        "carbs": ${Math.round((totalDailyCalories * 0.10 * 0.60) / 4)},
        "fat": ${Math.round((totalDailyCalories * 0.10 * 0.20) / 9)}
      }
    ]
  }` : ''}
}
`;

    let mealPlan;
    if (!GROQ_API_KEY) {
      console.warn("GROQ_API_KEY not set; generating basic meal plan without AI");
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
    } else {
      console.log("6. Calling Groq API...");
      const aiResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              { role: "system", content: "You are an expert nutritionist and meal planner. Create practical, delicious meal plans. Return ONLY valid JSON, no markdown formatting." },
              { role: "user", content: context },
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
          }),
        }
      );

      console.log("AI API response status:", aiResponse.status);

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI API error:", aiResponse.status, errorText);
        // graceful fallback
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
      } else {
        console.log("7. Parsing AI response...");
        const aiData = await aiResponse.json();
        const content = aiData.choices[0].message.content;
        console.log("AI Response received, length:", content?.length || 0);
        mealPlan = JSON.parse(content);
      }
    }

    // Store meal plans for each meal type
    console.log("8. Storing meal plans in database...");
    const mealTypes = ["breakfast", "lunch", "dinner"];
    
    // Add snack category for training days
    if (dayPlan && dayPlan.activity === 'run') {
      mealTypes.push("snack");
    }

    for (const mealType of mealTypes) {
      // Ensure we have a meal object with targets even if AI missed it
      let meal = mealPlan[mealType];
      const pct = mealType === 'breakfast' ? 0.30 : mealType === 'lunch' ? 0.40 : mealType === 'snack' ? 0.10 : 0.30;
      if (!meal) {
        const proteinRatio = mealType === 'snack' ? 0.20 : 0.30;
        const carbsRatio = mealType === 'snack' ? 0.60 : 0.40;
        const fatRatio = mealType === 'snack' ? 0.20 : 0.30;
        
        meal = {
          target_calories: Math.round(totalDailyCalories * pct),
          target_protein: Math.round((totalDailyCalories * pct * proteinRatio) / 4),
          target_carbs: Math.round((totalDailyCalories * pct * carbsRatio) / 4),
          target_fat: Math.round((totalDailyCalories * pct * fatRatio) / 9),
          suggestions: [],
        };
      } else {
        // Fill any missing target fields with sane defaults
        const proteinRatio = mealType === 'snack' ? 0.20 : 0.30;
        const carbsRatio = mealType === 'snack' ? 0.60 : 0.40;
        const fatRatio = mealType === 'snack' ? 0.20 : 0.30;
        
        if (!Number.isFinite(meal.target_calories) || meal.target_calories <= 0) meal.target_calories = Math.round(totalDailyCalories * pct);
        if (!Number.isFinite(meal.target_protein) || meal.target_protein <= 0) meal.target_protein = Math.round((totalDailyCalories * pct * proteinRatio) / 4);
        if (!Number.isFinite(meal.target_carbs) || meal.target_carbs <= 0) meal.target_carbs = Math.round((totalDailyCalories * pct * carbsRatio) / 4);
        if (!Number.isFinite(meal.target_fat) || meal.target_fat <= 0) meal.target_fat = Math.round((totalDailyCalories * pct * fatRatio) / 9);
        if (!Array.isArray(meal.suggestions)) meal.suggestions = [];
      }

      console.log(`Inserting ${mealType} plan...`);
      const { error: insertError } = await supabaseAdmin
        .from("daily_meal_plans")
        .upsert(
          {
            user_id: userId,
            date: requestDate,
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
      } else {
        console.log(`${mealType} plan inserted successfully`);
      }
    }

    console.log(`9. Successfully generated meal plan for ${requestDate}`);

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
