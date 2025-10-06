// @ts-nocheck
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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header missing" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    try {
      const parts = token.split('.')
      const payload = JSON.parse(atob(parts[1]));
      userId = payload.sub;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const body = await req.json().catch(() => ({}));
    const startDate: string = body.startDate || new Date().toISOString().split("T")[0];
    const weeks: number = Math.max(1, Math.min(8, Number(body.weeks) || 7));
    const daysToGenerate = weeks * 7;

    // Profile and training plan
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_id, weight_kg, height_cm, age, sex, activity_level, fitness_goals")
      .eq("user_id", userId)
      .single();

    const fitnessGoal = profile?.goal_type || profile?.fitness_goals?.[0];
    const weekPlan = profile?.activity_level ? JSON.parse(profile.activity_level) : null;

    async function getFitForDate(dateStr: string) {
      const { data } = await supabaseAdmin
        .from("google_fit_data")
        .select("calories_burned")
        .eq("user_id", userId)
        .eq("date", dateStr)
        .maybeSingle();
      return data || null;
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

    const results: Array<{ date: string; ok: boolean; error?: string }> = [];

    for (let i = 0; i < daysToGenerate; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];

      try {
        const fit = await getFitForDate(dateStr);
        const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
        const todayPlan = weekPlan ? weekPlan.find((p: any) => p.day === weekday) : null;

        const userProfile: UserProfile = {
          weightKg: profile?.weight_kg || 70,
          heightCm: profile?.height_cm || 170,
          age: profile?.age || 30,
          sex: (profile?.sex || 'male') as 'male' | 'female',
        };

        const plan = await generateUserMealPlan({
          userId,
          date: dateStr,
          userProfile,
          trainingActivity: todayPlan?.activity || 'rest',
          trainingDuration: todayPlan?.duration,
          trainingDistance: todayPlan?.distanceKm,
          googleFitCalories: fit?.calories_burned || 0,
          useAI: false,
        });

        const context = `
You are an expert nutritionist and meal planner. Return ONLY valid JSON.

User Profile:
- Age: ${profile?.age || "unknown"}
- Weight: ${profile?.weight || "unknown"} kg
- Height: ${profile?.height || "unknown"} cm
- BMR: ${tdee.bmr || "unknown"} kcal
- Activity Level: ${profile?.activity_level || "moderate"}
- Fitness Goals: ${fitnessGoal || "general fitness"}
- Training Intensity: ${trainingIntensity}
- Location: Indonesia

Training Plan for ${weekday}:
${todayPlan ? `${todayPlan.activity}${typeof todayPlan.distanceKm === 'number' ? ` ${todayPlan.distanceKm} km` : todayPlan.duration ? ` for ${todayPlan.duration} minutes` : ''} (${distanceBasedKcal ?? todayPlan.estimatedCalories ?? 0} calories est.)` : "rest day"}

Today's Activity Metrics for ${dateStr}:
- Calories burned: ${wearableData?.calories_burned || 0} kcal
- Steps: ${wearableData?.steps || 0}
- Distance: ${wearableData?.distance_meters ? (wearableData.distance_meters / 1000).toFixed(2) : 0} km
- Active minutes: ${wearableData?.active_minutes || 0}
- Average heart rate: ${wearableData?.heart_rate_avg || "N/A"} bpm
- Sleep hours: ${wearableData?.sleep_hours || "N/A"}

Daily Calorie Target for ${dateStr}: ${totalDailyCalories} kcal

Create a complete daily meal plan with SPECIFIC meal suggestions for breakfast (30%), lunch (40%), dinner (30%), and snacks (10% for training days). For each meal, provide 2-3 realistic meal options with:
- Specific meal name (Indonesian-style)
- List of locally available foods/ingredients with EXACT gram portions (e.g., "Nasi putih (150g)", "Ayam goreng (100g)")
- Brief appetizing description
- Accurate macros (calories, protein, carbs, fat) per suggestion in grams

IMPORTANT: All food ingredients MUST include precise gram measurements.

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
        "description": "Deskripsi singkat",
        "calories": ${Math.round(totalDailyCalories * 0.30)},
        "protein": ${Math.round((totalDailyCalories * 0.30 * 0.30) / 4)},
        "carbs": ${Math.round((totalDailyCalories * 0.30 * 0.40) / 4)},
        "fat": ${Math.round((totalDailyCalories * 0.30 * 0.30) / 9)}
      }
    ]
  },
  "lunch": { ... same structure with 40% calories ... },
  "dinner": { ... same structure with 30% calories ... },
  ${isTrainingDay ? `"snack": {
    "target_calories": ${Math.round(totalDailyCalories * 0.10)},
    "target_protein": ${Math.round((totalDailyCalories * 0.10 * 0.20) / 4)},
    "target_carbs": ${Math.round((totalDailyCalories * 0.10 * 0.60) / 4)},
    "target_fat": ${Math.round((totalDailyCalories * 0.10 * 0.20) / 9)},
    "suggestions": [
      {
        "name": "Energy gel atau recovery snack",
        "foods": ["Energy gel (30g)", "Pisang (100g)", "Air kelapa (200ml)"],
        "description": "Snack untuk recovery setelah latihan",
        "calories": ${Math.round(totalDailyCalories * 0.10)},
        "protein": ${Math.round((totalDailyCalories * 0.10 * 0.20) / 4)},
        "carbs": ${Math.round((totalDailyCalories * 0.10 * 0.60) / 4)},
        "fat": ${Math.round((totalDailyCalories * 0.10 * 0.20) / 9)}
      }
    ]
  }` : ''}
}`;

        // Convert to DB records and save
        const records = mealPlanToDbRecords(userId, plan);
        for (const record of records) {
          await supabaseAdmin
            .from("daily_meal_plans")
            .upsert(record, { onConflict: "user_id,date,meal_type" });
        }

        if (GROQ_API_KEY) {
          const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "llama-3.1-8b-instant",
              messages: [
                { role: "system", content: "You are an expert nutritionist and meal planner. Return ONLY valid JSON." },
                { role: "user", content: context },
              ],
              response_format: { type: "json_object" },
              temperature: 0.7,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content;
            if (content) {
              try { mealPlan = JSON.parse(content); } catch {}
            }
          }
        }

        results.push({ date: dateStr, ok: true });
      } catch (e) {
        results.push({ date: dateStr, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(JSON.stringify({ success: true, startDate, weeks, generatedDays: daysToGenerate, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


