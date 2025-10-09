// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";
import {
  type UserProfile,
  type GoalType,
  aggregateActivitiesToLoad,
  calculateDayTarget,
  adjustDayTargetForGoal,
  determineRacePhase,
  adjustDayTargetForPhase,
} from "../_shared/nutrition-unified.ts";

function buildCorsHeaders(req: Request) {
  const originHeader = req.headers.get("Origin");
  const allowOrigin =
    originHeader && originHeader !== "null" ? originHeader : "*";

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, supabase-client, x-xsrf-token, x-groq-key, groq-api-key",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };

  if (allowOrigin !== "*") {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
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

const SUPABASE_URL = getSupabaseUrl();
const SERVICE_KEY = getServiceRoleKey();

async function supabaseRequest(
  path: string,
  init: RequestInit = {}
) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const headers: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    Accept: "application/json",
    ...(init.headers as Record<string, string> ?? {}),
  };

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase request failed (${response.status} ${response.statusText}): ${text}`);
  }

  return response;
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
      if (parts.length !== 3) {
        throw new Error("Invalid token format");
      }
      const payload = JSON.parse(atob(parts[1]));
      userId = payload.sub;
      
      if (!userId) {
        throw new Error("No user ID in token");
      }
      
      console.log(`User ID extracted: ${userId}`);
    } catch (e) {
      console.error("JWT decode error:", e);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { date } = await req.json().catch(() => ({ date: undefined }));
    const requestDate = date || new Date().toISOString().split("T")[0];

    // Load profile, goals, and race date
    console.log(`Loading profile for user: ${userId}`);
    const profileRes = await supabaseRequest(
      `/profiles?select=user_id,weight,weight_kg,height,height_cm,age,goal_type,fitness_level,target_date&user_id=eq.${userId}&limit=1`,
      { method: "GET" }
    );
    const profileData = await profileRes.json() as any[];
    const profileRow = Array.isArray(profileData) ? profileData[0] : null;
    
    if (!profileRow) {
      console.error(`No profile found for user: ${userId}`);
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log(`Profile loaded: ${JSON.stringify(profileRow)}`);

    const userProfile: UserProfile = {
      weightKg: profileRow?.weight_kg || profileRow?.weight || 70,
      heightCm: profileRow?.height_cm || profileRow?.height || 170,
      age: profileRow?.age || 30,
      sex: "male",
    } as UserProfile;

    const goal = (profileRow?.goal_type || "general") as GoalType;
    const raceDateISO = profileRow?.target_date || null;

    // Fetch activities for the day (multiple allowed)
    const activityRes = await supabaseRequest(
      `/training_activities?select=activity_type,duration_minutes,distance_km,intensity&user_id=eq.${userId}&date=eq.${requestDate}`,
      { method: "GET" }
    );
    const activities = await activityRes.json();

    // Compute goal-centric DayTarget using science engine
    const trainingLoad = aggregateActivitiesToLoad((activities || []) as any[]);
    const baseTarget = calculateDayTarget(userProfile, trainingLoad, requestDate);
    const goalAdjusted = adjustDayTargetForGoal(baseTarget, goal);
    const racePhase = determineRacePhase(requestDate, raceDateISO);
    const dayTarget = adjustDayTargetForPhase(goalAdjusted, racePhase);

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
    // Prefer header-provided key for flexibility; fallback to function secret
    const headerKey = req.headers.get("x-groq-key") || req.headers.get("groq-api-key") || undefined;
    const GROQ_API_KEY = headerKey || getGroqKey();
    
    console.log(`GROQ API Key available: ${!!GROQ_API_KEY}`);
    
    if (GROQ_API_KEY) {
      try {
        console.log("Calling GROQ API...");
        const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              { role: "system", content: "You are an expert sports nutritionist specializing in Indonesian cuisine for runners. Return ONLY valid minified JSON." },
              { role: "user", content: context },
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
          }),
        });
        
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content || "{}";
          console.log(`AI Response received: ${content.substring(0, 200)}...`);
          try {
            suggestions = JSON.parse(content);
            console.log("AI suggestions parsed successfully");
          } catch (parseError) {
            console.error("Failed to parse AI response:", parseError);
            suggestions = {};
          }
        } else {
          console.error(`GROQ API error: ${aiRes.status} ${aiRes.statusText}`);
        }
      } catch (apiError) {
        console.error("GROQ API call failed:", apiError);
      }
    } else {
      console.log("No GROQ API key available, skipping AI generation");
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
    await supabaseRequest(
      `/user_preferences?on_conflict=user_id,key`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify([{
          user_id: userId,
          key: cacheKey,
          value: { meals: baseOut, updatedAt: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        }]),
      }
    );

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
