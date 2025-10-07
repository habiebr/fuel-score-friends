// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getSupabaseAdmin } from "../_shared/env.ts";
import {
  type UserProfile,
  type GoalType,
  generateGoalCentricDayTarget,
} from "../_shared/nutrition-unified.ts";

function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, supabase-client, x-xsrf-token",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  } as Record<string, string>;
}

function getGroqKey(): string | undefined {
  // GROQ_API_KEY should be set in function secrets
  try {
    // @ts-ignore - Deno.env is available in Edge Functions
    return Deno.env.get("GROQ_API_KEY") as string | undefined;
  } catch (_) {
    return undefined;
  }
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Extract auth and body
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
      const parts = token.split(".");
      const payload = JSON.parse(atob(parts[1]));
      userId = payload.sub;
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { date } = await req.json().catch(() => ({ date: undefined }));
    const requestDate = date || new Date().toISOString().split("T")[0];

    const supabaseAdmin = getSupabaseAdmin();

    // Load profile, goals, and race date
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("user_id, weight, height, age, goal_type, fitness_level, target_date")
      .eq("user_id", userId)
      .maybeSingle();

    const userProfile: UserProfile = {
      weightKg: profileRow?.weight || 70,
      heightCm: profileRow?.height || 170,
      age: profileRow?.age || 30,
      sex: "male",
    } as UserProfile;

    const goal = (profileRow?.goal_type || "general") as GoalType;
    const raceDateISO = profileRow?.target_date || null;

    // Fetch activities for the day (multiple allowed)
    const { data: activities } = await supabaseAdmin
      .from("training_activities")
      .select("activity_type, duration_minutes, distance_km, intensity")
      .eq("user_id", userId)
      .eq("date", requestDate);

    // Compute goal-centric DayTarget using science engine
    const dayTarget = generateGoalCentricDayTarget(
      userProfile,
      requestDate,
      (activities || []) as any[],
      goal,
      raceDateISO
    );

    // Prepare AI prompt context
    const context = `
Date: ${requestDate}
User Profile:
- Age: ${userProfile.age}
- Weight: ${userProfile.weightKg} kg
- Height: ${userProfile.heightCm} cm
- Sex: ${userProfile.sex}

Race Goal & Periodization:
- Goal: ${goal}
- Race Date: ${raceDateISO || "not set"}
- Training Load Today: ${dayTarget.load}

Nutrition Targets (Science Layer):
- Total kcal: ${dayTarget.kcal}
- Carbohydrates: ${dayTarget.grams.cho} g
- Protein: ${dayTarget.grams.protein} g
- Fat: ${dayTarget.grams.fat} g

Fueling Guidance:
- Pre: ${dayTarget.fueling.pre ? `${dayTarget.fueling.pre.cho_g}g CHO ${dayTarget.fueling.pre.hoursBefore}h before` : "n/a"}
- During: ${dayTarget.fueling.duringCHOgPerHour ? `${dayTarget.fueling.duringCHOgPerHour} g CHO/hr` : "n/a"}
- Post: ${dayTarget.fueling.post ? `${dayTarget.fueling.post.cho_g}g CHO + ${dayTarget.fueling.post.protein_g}g protein` : "n/a"}

Meal Ratios:
${dayTarget.meals.map(m => `- ${m.meal}: ${(m.ratio*100).toFixed(0)}%`).join("\n")}

Task: Create 2-3 Indonesian-style meal options for each meal (breakfast, lunch, dinner${dayTarget.meals.find(m=>m.meal==='snack')? ', snack':''}).
For each option, include:
- name
- foods: array of strings with local ingredients and exact grams/ml
- description (short, appetizing)
- calories, protein, carbs, fat (numbers matching the meal targets)

Return ONLY strict JSON with keys breakfast, lunch, dinner${dayTarget.meals.find(m=>m.meal==='snack')? ', snack':''}.`;

    let suggestions: any = {};
    const GROQ_API_KEY = getGroqKey();
    if (GROQ_API_KEY) {
      const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: "You are an expert sports nutritionist. Return ONLY valid minified JSON." },
            { role: "user", content: context },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || "{}";
        try {
          suggestions = JSON.parse(content);
        } catch (_) {
          suggestions = {};
        }
      }
    }

    // Fallback minimal structure
    const needSnack = !!dayTarget.meals.find((m) => m.meal === "snack");
    const baseOut: any = {
      breakfast: {
        target: dayTarget.meals.find((m) => m.meal === "breakfast") || null,
        suggestions: suggestions.breakfast || [],
      },
      lunch: {
        target: dayTarget.meals.find((m) => m.meal === "lunch") || null,
        suggestions: suggestions.lunch || [],
      },
      dinner: {
        target: dayTarget.meals.find((m) => m.meal === "dinner") || null,
        suggestions: suggestions.dinner || [],
      },
    };
    if (needSnack) {
      baseOut.snack = {
        target: dayTarget.meals.find((m) => m.meal === "snack") || null,
        suggestions: suggestions.snack || [],
      };
    }

    // Cache into user_preferences for the day
    const cacheKey = `nutritionSuggestions:${requestDate}:default`;
    await supabaseAdmin
      .from('user_preferences')
      .upsert({
        user_id: userId,
        key: cacheKey,
        value: { meals: baseOut, updatedAt: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,key' });

    return new Response(
      JSON.stringify({ success: true, date: requestDate, load: dayTarget.load, kcal: dayTarget.kcal, targets: dayTarget.grams, fueling: dayTarget.fueling, meals: baseOut }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


