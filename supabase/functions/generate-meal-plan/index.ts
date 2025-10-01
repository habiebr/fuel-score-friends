// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";
// Inline minimal nutrition helpers to avoid shared import issues
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | string | null | undefined;
interface TDEEInput {
  weightKg?: number | null;
  heightCm?: number | null;
  ageYears?: number | null;
  activityLevel?: ActivityLevel;
  wearableCaloriesToday?: number | null;
  fitnessGoal?: string | null;
  weekPlan?: Array<{ day: string; activity?: string; duration?: number }> | null;
}
interface TDEEResult {
  bmr: number;
  activityMultiplier: number;
  baseTDEE: number;
  trainingAdjustment: number;
  totalDailyCalories: number;
  trainingIntensity: 'low' | 'moderate' | 'moderate-high' | 'high';
}
function inlineCalculateBMR(weightKg?: number | null, heightCm?: number | null, ageYears?: number | null): number {
  if (!weightKg || !heightCm || !ageYears) return 2000; // safe default to avoid zeroing
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5);
}
function inlineGetActivityMultiplier(level?: ActivityLevel): number {
  const map: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const key = String(level || 'moderate').toLowerCase();
  return map[key] ?? 1.55;
}
function calculateTDEE(input: TDEEInput): TDEEResult {
  const bmr = inlineCalculateBMR(input.weightKg, input.heightCm, input.ageYears);
  const activityMultiplier = inlineGetActivityMultiplier(input.activityLevel);
  let total = Math.round(bmr * activityMultiplier);
  if (typeof input.wearableCaloriesToday === 'number' && input.wearableCaloriesToday > 0) {
    total = Math.round(bmr + input.wearableCaloriesToday);
  }
  let trainingAdjustment = 0;
  let trainingIntensity: TDEEResult['trainingIntensity'] = 'moderate';
  const goal = (input.fitnessGoal || '').toLowerCase();
  if (goal.includes('marathon')) { trainingAdjustment += 500; trainingIntensity = 'high'; }
  else if (goal.includes('half')) { trainingAdjustment += 300; trainingIntensity = 'moderate-high'; }
  else if (goal.includes('5k') || goal.includes('10k')) { trainingAdjustment += 200; trainingIntensity = 'moderate'; }
  else if (goal === 'lose_weight') { trainingAdjustment -= 500; trainingIntensity = 'moderate'; }
  else if (goal === 'gain_muscle') { trainingAdjustment += 300; trainingIntensity = 'moderate'; }
  if (input.weekPlan && Array.isArray(input.weekPlan)) {
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todayPlan = input.weekPlan.find(d => d && d.day === todayName);
    if (todayPlan) {
      const dur = todayPlan.duration || 0;
      if (todayPlan.activity === 'run' && dur > 60) { trainingAdjustment += 400; trainingIntensity = 'high'; }
      else if (todayPlan.activity === 'run' && dur > 30) { trainingAdjustment += 200; trainingIntensity = 'moderate-high'; }
      else if (todayPlan.activity === 'run') { trainingAdjustment += 100; trainingIntensity = 'moderate'; }
      else if (todayPlan.activity === 'rest') { trainingAdjustment -= 100; trainingIntensity = 'low'; }
    }
  }
  const totalDailyCalories = total + trainingAdjustment;
  return { bmr, activityMultiplier, baseTDEE: total, trainingAdjustment, totalDailyCalories, trainingIntensity };
}

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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

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

    // Fetch recent wearable data with comprehensive metrics
    const { data: wearableData } = await supabaseAdmin
      .from("wearable_data")
      .select("*")
      .eq("user_id", userId)
      .eq("date", requestDate)
      .single();

    // Fetch recent 7-day wearable data for trends
    const sevenDaysAgo = new Date(requestDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: recentWearableData } = await supabaseAdmin
      .from("wearable_data")
      .select("*")
      .eq("user_id", userId)
      .gte("date", sevenDaysAgo.toISOString().split("T")[0])
      .order("date", { ascending: false })
      .limit(7);

    const fitnessGoal = profile?.goal_type || profile?.fitness_goals?.[0];
    const weekPlan = profile?.activity_level ? JSON.parse(profile.activity_level) : null;
    const dayPlan = Array.isArray(weekPlan) ? weekPlan.find((d: any) => d && d.day === requestWeekday) : null;
    const distanceKm = typeof dayPlan?.distanceKm === 'number' ? dayPlan.distanceKm : undefined;
    const distanceBasedKcal = distanceKm && profile?.weight ? Math.round((profile.weight as number) * distanceKm) : undefined;
    const plannedCalories = distanceBasedKcal ?? (dayPlan?.estimatedCalories || 0);
    const tdee = calculateTDEE({
      weightKg: profile?.weight,
      heightCm: profile?.height,
      ageYears: profile?.age,
      activityLevel: profile?.activity_level,
      wearableCaloriesToday: (wearableData?.calories_burned || 0) || plannedCalories,
      fitnessGoal,
      weekPlan,
    });
    const totalDailyCalories = tdee.totalDailyCalories;
    const trainingIntensity = tdee.trainingIntensity;
    const targetDate = profile?.target_date;
    const fitnessLevel = profile?.fitness_level;
    console.log(`Calculated nutrition needs - BMR: ${tdee.bmr}, TDEE: ${totalDailyCalories}, Goal: ${fitnessGoal}`);

    // Calculate average metrics from recent data
    const avgMetrics = recentWearableData?.length ? {
      avgCalories: Math.round(recentWearableData.reduce((sum, d) => sum + (d.calories_burned || 0), 0) / recentWearableData.length),
      avgSteps: Math.round(recentWearableData.reduce((sum, d) => sum + (d.steps || 0), 0) / recentWearableData.length),
      avgHeartRate: Math.round(recentWearableData.reduce((sum, d) => sum + (d.heart_rate_avg || 0), 0) / recentWearableData.length),
      avgSleep: (recentWearableData.reduce((sum, d) => sum + (d.sleep_hours || 0), 0) / recentWearableData.length).toFixed(1),
      avgDistance: (recentWearableData.reduce((sum, d) => sum + (d.distance_meters || 0), 0) / recentWearableData.length / 1000).toFixed(1),
    } : null;

    // Use AI to generate detailed meal suggestions
    console.log("5. Preparing AI request...");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

    const context = `
Date: ${requestDate} (${requestWeekday})
User Profile:
- Age: ${profile?.age || "unknown"}
- Weight: ${profile?.weight || "unknown"} kg
- Height: ${profile?.height || "unknown"} cm
- BMR (Basal Metabolic Rate): ${tdee.bmr} kcal
- Activity Level: ${profile?.activity_level || "moderate"}
- Fitness Goals: ${fitnessGoal || "general fitness"}
- Target Race Date: ${targetDate || "not set"}
- Fitness Level: ${fitnessLevel || "intermediate"}
        - Training Intensity: ${trainingIntensity}
        - Location: Indonesia

Running Goals & Training Plan:
- Primary Goal: ${fitnessGoal || "general fitness"}
- Target Date: ${targetDate || "not specified"}
- Current Fitness Level: ${fitnessLevel || "intermediate"}
- Weekly Training Plan: ${weekPlan ? JSON.stringify(weekPlan, null, 2) : "not set"}
- Today's Training: ${dayPlan ? `${dayPlan.activity}${typeof dayPlan.distanceKm==='number' ? ` ${dayPlan.distanceKm} km` : dayPlan.duration?` for ${dayPlan.duration} minutes`:''} (${plannedCalories} calories est.)` : "rest day"}

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

TRAINING DAY ADJUSTMENTS:
${trainingIntensity === 'high' ? '- HIGH INTENSITY DAY: Extra carbs 2-3 hours before training, protein within 30 minutes after' : ''}
${trainingIntensity === 'moderate-high' ? '- MODERATE-HIGH INTENSITY: Balanced pre-workout nutrition, good recovery foods' : ''}
${trainingIntensity === 'moderate' ? '- MODERATE INTENSITY: Standard balanced nutrition' : ''}
${trainingIntensity === 'low' ? '- REST DAY: Lighter meals, focus on recovery and preparation for next training' : ''}

Consider the user's wearable data:
- If training effect is high or recovery time is significant, recommend more protein and anti-inflammatory foods
- If sleep quality is poor, suggest foods that promote better sleep (magnesium, tryptophan)
- If heart rate trends are elevated, consider hydration and electrolyte-rich foods
- For high-intensity activity days, increase carb recommendations for recovery
- Account for actual calories burned to prevent under/over-eating

Create a complete daily meal plan with SPECIFIC meal suggestions for breakfast (30%), lunch (40%), and dinner (30%).

For each meal, provide 2-3 realistic meal options with:
- Specific meal name (Indonesian-style)
- List of locally available foods/ingredients with EXACT gram portions (e.g., "Nasi putih (150g)", "Ayam goreng (100g)")
- Brief appetizing description
- Accurate macros (calories, protein, carbs, fat)

IMPORTANT: All food ingredients MUST include precise gram measurements to help runners with portion control and nutrition tracking.

Make suggestions practical, tasty, culturally diverse, and SPECIFICALLY tailored to Indonesian availability.

Examples of Indonesian-appropriate meals:
- Breakfast: Nasi uduk dengan ayam goreng dan sambal kacang
- Lunch: Gado-gado dengan bumbu kacang dan kerupuk
- Dinner: Rendang daging dengan nasi putih dan sayur daun singkong

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
  "dinner": { ... same structure with 30% calories ... }
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

    for (const mealType of mealTypes) {
      // Ensure we have a meal object with targets even if AI missed it
      let meal = mealPlan[mealType];
      const pct = mealType === 'breakfast' ? 0.30 : mealType === 'lunch' ? 0.40 : 0.30;
      if (!meal) {
        meal = {
          target_calories: Math.round(totalDailyCalories * pct),
          target_protein: Math.round((totalDailyCalories * pct * 0.30) / 4),
          target_carbs: Math.round((totalDailyCalories * pct * 0.40) / 4),
          target_fat: Math.round((totalDailyCalories * pct * 0.30) / 9),
          suggestions: [],
        };
      } else {
        // Fill any missing target fields with sane defaults
        if (!Number.isFinite(meal.target_calories) || meal.target_calories <= 0) meal.target_calories = Math.round(totalDailyCalories * pct);
        if (!Number.isFinite(meal.target_protein) || meal.target_protein <= 0) meal.target_protein = Math.round((totalDailyCalories * pct * 0.30) / 4);
        if (!Number.isFinite(meal.target_carbs) || meal.target_carbs <= 0) meal.target_carbs = Math.round((totalDailyCalories * pct * 0.40) / 4);
        if (!Number.isFinite(meal.target_fat) || meal.target_fat <= 0) meal.target_fat = Math.round((totalDailyCalories * pct * 0.30) / 9);
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
