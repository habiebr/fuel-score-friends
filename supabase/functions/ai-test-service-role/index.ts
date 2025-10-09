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
    console.log("=== AI Function Test (Service Role) ===");

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get a real user ID from the database
    const { data: users } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .limit(1);

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ error: "No users found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = users[0].user_id;
    const requestDate = "2025-10-09";

    console.log(`Testing with real user: ${userId}`);

    // Load profile with preferences
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('user_id,weight,weight_kg,height,height_cm,age,goal_type,fitness_level,target_date,preferred_cuisine,dietary_restrictions,eating_behaviors,fitness_goals,meal_plan_refresh_mode,sex')
      .eq('user_id', userId)
      .single();

    if (!profileData) {
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

    console.log(`User preferences: ${JSON.stringify(userPreferences)}`);

    // Generate day target
    const baseTarget = {
      date: requestDate,
      load: 'rest',
      kcal: Math.round(userProfile.weightKg * 30),
      grams: {
        cho: Math.round(userProfile.weightKg * 3.5),
        protein: Math.round(userProfile.weightKg * 1.6),
        fat: Math.round(userProfile.weightKg * 0.7)
      },
      fueling: {
        pre: null,
        duringCHOgPerHour: null,
        post: null
      },
      meals: [
        { meal: 'breakfast', ratio: 0.25, cho_g: Math.round(userProfile.weightKg * 0.875), protein_g: Math.round(userProfile.weightKg * 0.4), fat_g: Math.round(userProfile.weightKg * 0.175), kcal: Math.round(userProfile.weightKg * 7.5) },
        { meal: 'lunch', ratio: 0.35, cho_g: Math.round(userProfile.weightKg * 1.225), protein_g: Math.round(userProfile.weightKg * 0.56), fat_g: Math.round(userProfile.weightKg * 0.245), kcal: Math.round(userProfile.weightKg * 10.5) },
        { meal: 'dinner', ratio: 0.40, cho_g: Math.round(userProfile.weightKg * 1.4), protein_g: Math.round(userProfile.weightKg * 0.64), fat_g: Math.round(userProfile.weightKg * 0.28), kcal: Math.round(userProfile.weightKg * 12) }
      ]
    };

    // Prepare AI prompt with preferences
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

Nutrition Targets (Science Layer):
- Total kcal: ${baseTarget.kcal}
- Carbohydrates: ${baseTarget.grams.cho} g
- Protein: ${baseTarget.grams.protein} g
- Fat: ${baseTarget.grams.fat} g

IMPORTANT: Respect all dietary restrictions and preferences. If user has specific dietary needs (Halal, Lactose-intolerant, etc.), ensure ALL ingredients comply.

Task: Create 2-3 personalized meal options for each meal (breakfast, lunch, dinner) based on user preferences.
For each option, include:
- name
- foods: array of strings with local ingredients and exact grams/ml
- description (short, appetizing)
- calories, protein, carbs, fat (numbers matching the meal targets)

Return ONLY strict JSON with keys breakfast, lunch, dinner.`;

    let suggestions: any = {};
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    
    if (GROQ_API_KEY) {
      try {
        console.log("Calling GROQ API with user preferences...");
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

    console.log("Test completed successfully");

    return new Response(JSON.stringify({
      success: true,
      test: true,
      userId: userId,
      userPreferences: userPreferences,
      date: requestDate,
      load: baseTarget.load,
      kcal: baseTarget.kcal,
      targets: baseTarget.grams,
      meals: baseOut,
      generatedAt: new Date().toISOString(),
      source: 'test_with_service_role'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in AI function test:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
