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
    console.log("=== Morning AI Batch Generation Started ===");

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    console.log(`Generating AI suggestions for: ${today}`);

    // Get all active users
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, weight_kg, height_cm, age, goal_type, fitness_level, target_date')
      .not('weight_kg', 'is', null)
      .not('height_cm', 'is', null)
      .not('age', 'is', null);

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return new Response(JSON.stringify({ error: usersError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${users?.length || 0} users to process`);

    let successCount = 0;
    let errorCount = 0;

    // Process each user
    for (const user of users || []) {
      try {
        console.log(`Processing user: ${user.user_id}`);

        // Check if AI suggestions already exist for today
        const cacheKey = `nutritionSuggestions:${today}:default`;
        const { data: existingCache } = await supabaseAdmin
          .from('user_preferences')
          .select('value')
          .eq('user_id', user.user_id)
          .eq('key', cacheKey)
          .maybeSingle();

        if (existingCache?.value?.meals) {
          console.log(`AI suggestions already exist for user ${user.user_id}, skipping`);
          continue;
        }

        // Create user profile
        const userProfile = {
          weightKg: user.weight_kg || 70,
          heightCm: user.height_cm || 170,
          age: user.age || 30,
          sex: "male" as const,
        };

        const goal = user.goal_type || "general";
        const raceDateISO = user.target_date || null;

        // Get today's activities
        const { data: activities } = await supabaseAdmin
          .from('training_activities')
          .select('activity_type, duration_minutes, distance_km, intensity')
          .eq('user_id', user.user_id)
          .eq('date', today);

        // Calculate training load (rest if no activities)
        const trainingLoad = activities && activities.length > 0 ? 'moderate' : 'rest';

        // Generate day target using science layer
        const dayTarget = {
          date: today,
          load: trainingLoad,
          kcal: Math.round(userProfile.weightKg * 30), // Simple BMR-based calculation
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
            { meal: 'breakfast', ratio: 0.25, cho_g: Math.round(userProfile.weightKg * 0.875), protein_g: Math.round(userProfile.weightKg * 0.4), fat_g: Math.round(userProfile.weightKg * 0.175), kcal: Math.round(userProfile.weightKg * 7.5) },
            { meal: 'lunch', ratio: 0.35, cho_g: Math.round(userProfile.weightKg * 1.225), protein_g: Math.round(userProfile.weightKg * 0.56), fat_g: Math.round(userProfile.weightKg * 0.245), kcal: Math.round(userProfile.weightKg * 10.5) },
            { meal: 'dinner', ratio: 0.40, cho_g: Math.round(userProfile.weightKg * 1.4), protein_g: Math.round(userProfile.weightKg * 0.64), fat_g: Math.round(userProfile.weightKg * 0.28), kcal: Math.round(userProfile.weightKg * 12) }
          ]
        };

        // Prepare AI prompt
        const context = `
Date: ${today}
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

Task: Create 2-3 Indonesian-style meal options for each meal (breakfast, lunch, dinner).
For each option, include:
- name
- foods: array of strings with local ingredients and exact grams/ml
- description (short, appetizing)
- calories, protein, carbs, fat (numbers matching the meal targets)

Return ONLY strict JSON with keys breakfast, lunch, dinner.`;

        // Generate AI suggestions
        let suggestions: any = {};
        const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
        
        if (GROQ_API_KEY) {
          try {
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
              try {
                suggestions = JSON.parse(content);
              } catch (parseError) {
                console.error(`Failed to parse AI response for user ${user.user_id}:`, parseError);
                suggestions = {};
              }
            } else {
              console.error(`GROQ API error for user ${user.user_id}: ${aiRes.status}`);
            }
          } catch (apiError) {
            console.error(`GROQ API call failed for user ${user.user_id}:`, apiError);
          }
        }

        // Build response structure
        const baseOut = {
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

        // Cache the AI suggestions
        await supabaseAdmin
          .from('user_preferences')
          .upsert({
            user_id: user.user_id,
            key: cacheKey,
            value: { 
              meals: baseOut, 
              updatedAt: new Date().toISOString(),
              generatedAt: new Date().toISOString(),
              source: 'morning_batch'
            },
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,key'
          });

        successCount++;
        console.log(`✅ Generated AI suggestions for user ${user.user_id}`);

      } catch (userError) {
        errorCount++;
        console.error(`❌ Error processing user ${user.user_id}:`, userError);
      }
    }

    console.log(`=== Morning Batch Complete ===`);
    console.log(`✅ Success: ${successCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);

    return new Response(JSON.stringify({
      success: true,
      message: "Morning AI batch generation completed",
      date: today,
      processed: users?.length || 0,
      successCount,
      errorCount
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in morning batch generation:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
