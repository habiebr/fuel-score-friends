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
    console.log("=== Smart AI Caching System Started ===");

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

    const { date, forceRegenerate = false } = await req.json().catch(() => ({ date: undefined }));
    const requestDate = date || new Date().toISOString().split("T")[0];

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(`Smart caching for user ${userId} on ${requestDate}`);

    // Check for existing cached AI suggestions
    const cacheKey = `nutritionSuggestions:${requestDate}:default`;
    const { data: existingCache } = await supabaseAdmin
      .from('user_preferences')
      .select('value')
      .eq('user_id', userId)
      .eq('key', cacheKey)
      .maybeSingle();

    // Check if we need to regenerate based on meal plan changes
    let needsRegeneration = forceRegenerate;
    
    if (!needsRegeneration && existingCache?.value?.meals) {
      // Check if meal plans have changed since last AI generation
      const { data: recentMealPlans } = await supabaseAdmin
        .from('daily_meal_plans')
        .select('updated_at')
        .eq('user_id', userId)
        .eq('date', requestDate)
        .order('updated_at', { ascending: false })
        .limit(1);

      const lastMealPlanUpdate = recentMealPlans?.[0]?.updated_at;
      const lastAiGeneration = existingCache.value.generatedAt || existingCache.value.updatedAt;

      if (lastMealPlanUpdate && lastAiGeneration) {
        const mealPlanTime = new Date(lastMealPlanUpdate).getTime();
        const aiTime = new Date(lastAiGeneration).getTime();
        
        if (mealPlanTime > aiTime) {
          console.log("Meal plans updated after AI generation, regenerating...");
          needsRegeneration = true;
        }
      }

      // Check if it's been more than 24 hours since generation
      const hoursSinceGeneration = (Date.now() - new Date(lastAiGeneration).getTime()) / (1000 * 60 * 60);
      if (hoursSinceGeneration > 24) {
        console.log("AI suggestions older than 24 hours, regenerating...");
        needsRegeneration = true;
      }
    }

    // Return cached data if no regeneration needed
    if (!needsRegeneration && existingCache?.value?.meals) {
      console.log("Returning cached AI suggestions");
      return new Response(JSON.stringify({
        success: true,
        cached: true,
        date: requestDate,
        meals: existingCache.value.meals,
        generatedAt: existingCache.value.generatedAt,
        source: existingCache.value.source || 'cache'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Regenerating AI suggestions...");

    // Load profile, goals, and race date with user preferences
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('user_id,weight,weight_kg,height,height_cm,age,goal_type,fitness_level,target_date,preferred_cuisine,dietary_restrictions,eating_behaviors,fitness_goals,meal_plan_refresh_mode,sex,meal_mode,strict_meal_preferences,meal_time_preferences')
      .eq('user_id', userId)
      .single();

    if (!profileData) {
      console.error(`No profile found for user: ${userId}`);
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userProfile = {
      weightKg: profileData.weight_kg || profileData.weight || 70,
      heightCm: profileData.height_cm || profileData.height || 170,
      age: profileData.age || 30,
      sex: profileData.sex || "male" as const,
    };

    const goal = profileData.goal_type || "general";
    const raceDateISO = profileData.target_date || null;

    // Extract user preferences
    const userPreferences = {
      preferredCuisine: profileData.preferred_cuisine || [],
      dietaryRestrictions: profileData.dietary_restrictions || [],
      eatingBehaviors: profileData.eating_behaviors || [],
      fitnessGoals: profileData.fitness_goals || [],
      mealPlanRefreshMode: profileData.meal_plan_refresh_mode || "daily_6am"
    };

    // Extract meal preferences
    const mealPreferences = {
      mealMode: profileData.meal_mode || "flexi",
      strictMealPreferences: profileData.strict_meal_preferences || {},
      mealTimePreferences: profileData.meal_time_preferences || {}
    };

    // Fetch activities for the day
    const { data: activities } = await supabaseAdmin
      .from('training_activities')
      .select('activity_type,duration_minutes,distance_km,intensity')
      .eq('user_id', userId)
      .eq('date', requestDate);

    // Compute goal-centric DayTarget using science engine
    const trainingLoad = activities && activities.length > 0 ? 'moderate' : 'rest';
    
    // Calculate meal ratios based on strict preferences
    let mealRatioBreakfast = 0.25;
    let mealRatioLunch = 0.35;
    let mealRatioDinner = 0.40;
    let mealRatioSnack = 0.0;
    
    if (mealPreferences.mealMode === 'strict' && mealPreferences.strictMealPreferences) {
      // Check if breakfast is disabled
      if (mealPreferences.strictMealPreferences.breakfast?.enabled === false) {
        mealRatioBreakfast = 0.0;
        mealRatioLunch = 0.45;  // Redistribute to lunch
        mealRatioDinner = 0.55; // Redistribute to dinner
      }
      
      // Check if snack is enabled
      if (mealPreferences.strictMealPreferences.snack?.enabled === true) {
        mealRatioSnack = 0.10;
        mealRatioBreakfast *= 0.9;
        mealRatioLunch *= 0.9;
        mealRatioDinner *= 0.9;
      }
    }
    
    const baseTarget = {
      date: requestDate,
      load: trainingLoad,
      kcal: Math.round(userProfile.weightKg * 30),
      grams: {
        cho: Math.round(userProfile.weightKg * 3.5),
        protein: Math.round(userProfile.weightKg * 1.6),
        fat: Math.round(userProfile.weightKg * 0.7)
      },
      fueling: {
        pre: trainingLoad !== 'rest' ? { hoursBefore: 2, cho_g: 30 } : null,
        duringCHOgPerHour: trainingLoad !== 'rest' ? 30 : null,
        post: trainingLoad !== 'rest' ? { minutesAfter: 30, cho_g: 50, protein_g: 20 } : null
      },
      meals: [
        { 
          meal: 'breakfast', 
          ratio: mealRatioBreakfast, 
          cho_g: Math.round(userProfile.weightKg * 3.5 * mealRatioBreakfast), 
          protein_g: Math.round(userProfile.weightKg * 1.6 * mealRatioBreakfast), 
          fat_g: Math.round(userProfile.weightKg * 0.7 * mealRatioBreakfast), 
          kcal: Math.round(userProfile.weightKg * 30 * mealRatioBreakfast),
          enabled: mealRatioBreakfast > 0
        },
        { 
          meal: 'lunch', 
          ratio: mealRatioLunch, 
          cho_g: Math.round(userProfile.weightKg * 3.5 * mealRatioLunch), 
          protein_g: Math.round(userProfile.weightKg * 1.6 * mealRatioLunch), 
          fat_g: Math.round(userProfile.weightKg * 0.7 * mealRatioLunch), 
          kcal: Math.round(userProfile.weightKg * 30 * mealRatioLunch),
          enabled: mealRatioLunch > 0
        },
        { 
          meal: 'dinner', 
          ratio: mealRatioDinner, 
          cho_g: Math.round(userProfile.weightKg * 3.5 * mealRatioDinner), 
          protein_g: Math.round(userProfile.weightKg * 1.6 * mealRatioDinner), 
          fat_g: Math.round(userProfile.weightKg * 0.7 * mealRatioDinner), 
          kcal: Math.round(userProfile.weightKg * 30 * mealRatioDinner),
          enabled: mealRatioDinner > 0
        }
      ]
    };
    
    // Add snack if enabled
    if (mealRatioSnack > 0) {
      baseTarget.meals.push({
        meal: 'snack',
        ratio: mealRatioSnack,
        cho_g: Math.round(userProfile.weightKg * 3.5 * mealRatioSnack),
        protein_g: Math.round(userProfile.weightKg * 1.6 * mealRatioSnack),
        fat_g: Math.round(userProfile.weightKg * 0.7 * mealRatioSnack),
        kcal: Math.round(userProfile.weightKg * 30 * mealRatioSnack),
        enabled: true
      });
    }

    // Prepare AI prompt context with user preferences
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
- Training Load Today: ${baseTarget.load}

User Preferences:
- Preferred Cuisine: ${userPreferences.preferredCuisine.length > 0 ? userPreferences.preferredCuisine.join(', ') : 'Indonesian (default)'}
- Dietary Restrictions: ${userPreferences.dietaryRestrictions.length > 0 ? userPreferences.dietaryRestrictions.join(', ') : 'None'}
- Eating Behaviors: ${userPreferences.eatingBehaviors.length > 0 ? userPreferences.eatingBehaviors.join(', ') : 'Standard eating patterns'}
- Fitness Goals: ${userPreferences.fitnessGoals.length > 0 ? userPreferences.fitnessGoals.join(', ') : 'General fitness'}

Meal Mode: ${mealPreferences.mealMode.toUpperCase()}
${mealPreferences.mealMode === 'strict' ? `
STRICT MEAL PREFERENCES:
${mealPreferences.strictMealPreferences.breakfast?.enabled === false ? '- BREAKFAST: DISABLED - No breakfast meals should be generated' : ''}
${mealPreferences.strictMealPreferences.lunch?.preferred_foods ? `- LUNCH Preferred Foods: ${mealPreferences.strictMealPreferences.lunch.preferred_foods.join(', ')}` : ''}
${mealPreferences.strictMealPreferences.lunch?.avoid_foods ? `- LUNCH Avoid Foods: ${mealPreferences.strictMealPreferences.lunch.avoid_foods.join(', ')}` : ''}
${mealPreferences.strictMealPreferences.dinner?.preferred_foods ? `- DINNER Preferred Foods: ${mealPreferences.strictMealPreferences.dinner.preferred_foods.join(', ')}` : ''}
${mealPreferences.strictMealPreferences.dinner?.avoid_foods ? `- DINNER Avoid Foods: ${mealPreferences.strictMealPreferences.dinner.avoid_foods.join(', ')}` : ''}
${mealPreferences.strictMealPreferences.snack?.enabled === true ? `- SNACK: ENABLED - Include snack suggestions` : ''}
${mealPreferences.strictMealPreferences.snack?.preferred_foods ? `- SNACK Preferred Foods: ${mealPreferences.strictMealPreferences.snack.preferred_foods.join(', ')}` : ''}
` : '- FLEXI MODE: Flexible meal ratios and adaptable suggestions'}

Nutrition Targets (Science Layer):
- Total kcal: ${baseTarget.kcal}
- Carbohydrates: ${baseTarget.grams.cho} g
- Protein: ${baseTarget.grams.protein} g
- Fat: ${baseTarget.grams.fat} g

Fueling Guidance:
- Pre: ${baseTarget.fueling.pre ? `${baseTarget.fueling.pre.cho_g}g CHO ${baseTarget.fueling.pre.hoursBefore}h before` : "n/a"}
- During: ${baseTarget.fueling.duringCHOgPerHour ? `${baseTarget.fueling.duringCHOgPerHour} g CHO/hr` : "n/a"}
- Post: ${baseTarget.fueling.post ? `${baseTarget.fueling.post.cho_g}g CHO + ${baseTarget.fueling.post.protein_g}g protein` : "n/a"}

Meal Ratios:
${baseTarget.meals.map(m => `- ${m.meal}: ${(m.ratio*100).toFixed(0)}%`).join("\n")}

IMPORTANT: 
1. Respect all dietary restrictions and preferences. If user has specific dietary needs (Halal, Lactose-intolerant, etc.), ensure ALL ingredients comply.
2. In STRICT MODE: Follow exact meal preferences. If breakfast is disabled, do NOT include breakfast suggestions.
3. In STRICT MODE: Only suggest foods from preferred_foods lists and avoid avoid_foods lists.
4. In FLEXI MODE: Use flexible meal ratios and adaptable suggestions.

Task: Create 2-3 personalized meal options for each ENABLED meal based on user preferences and meal mode.
For each option, include:
- name
- foods: array of strings with local ingredients and exact grams/ml
- description (short, appetizing)
- calories, protein, carbs, fat (numbers matching the meal targets)

Return ONLY strict JSON with keys for ENABLED meals only (breakfast, lunch, dinner, snack).`;

    let suggestions: any = {};
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    
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
      console.log("No GROQ API key available, using fallback suggestions");
    }

    // Build response structure
    const baseOut = {
      breakfast: {
        target: baseTarget.meals.find((m) => m.meal === "breakfast") || null,
        suggestions: suggestions.breakfast || [],
      },
      lunch: {
        target: baseTarget.meals.find((m) => m.meal === "lunch") || null,
        suggestions: suggestions.lunch || [],
      },
      dinner: {
        target: baseTarget.meals.find((m) => m.meal === "dinner") || null,
        suggestions: suggestions.dinner || [],
      },
    };

    // Cache the new AI suggestions with user preferences
    await supabaseAdmin
      .from('user_preferences')
      .upsert({
        user_id: userId,
        key: cacheKey,
        value: { 
          meals: baseOut, 
          userProfile: userProfile,
          userPreferences: userPreferences,
          mealPreferences: mealPreferences,
          dayTarget: baseTarget,
          updatedAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          source: 'on_demand'
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,key'
      });

    console.log("AI suggestions generated and cached successfully");

    return new Response(JSON.stringify({
      success: true,
      cached: false,
      date: requestDate,
      load: baseTarget.load,
      kcal: baseTarget.kcal,
      targets: baseTarget.grams,
      fueling: baseTarget.fueling,
      meals: baseOut,
      generatedAt: new Date().toISOString(),
      source: 'on_demand'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in smart AI caching:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
