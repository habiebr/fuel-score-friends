import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

  // Skip auth for testing
  try {
    console.log("=== AI Meal Generator Test ===");

    // For testing, use a hardcoded user ID
    const userId = "3d022fb2-ba20-474d-b0f7-a08224832892";
    const requestDate = "2025-10-09";

    console.log(`Testing with user: ${userId}`);

    // Create admin client
    const supabaseAdmin = {
      from: (table: string) => ({
        select: (columns: string) => ({
          eq: (column: string, value: string) => ({
            limit: (count: number) => Promise.resolve({
              data: table === 'profiles' ? [{
                user_id: userId,
                weight_kg: 70,
                height_cm: 170,
                age: 30,
                goal_type: 'general',
                fitness_level: 'moderate',
                target_date: null
              }] : [],
              error: null
            })
          })
        })
      })
    };

    // Mock profile data
    const profileRow = {
      user_id: userId,
      weight_kg: 70,
      height_cm: 170,
      age: 30,
      goal_type: 'general',
      fitness_level: 'moderate',
      target_date: null
    };

    console.log(`Profile loaded: ${JSON.stringify(profileRow)}`);

    // Mock user profile
    const userProfile = {
      weightKg: profileRow.weight_kg || 70,
      heightCm: profileRow.height_cm || 170,
      age: profileRow.age || 30,
      sex: "male" as const,
    };

    const goal = profileRow.goal_type || "general";
    const raceDateISO = profileRow.target_date || null;

    // Mock activities (rest day)
    const activities: any[] = [];

    // Mock training load calculation
    const trainingLoad = 'rest';
    
    // Mock day target calculation
    const dayTarget = {
      date: requestDate,
      load: trainingLoad,
      kcal: 2000,
      grams: {
        cho: 250,
        protein: 120,
        fat: 67
      },
      fueling: {
        pre: { hoursBefore: 2, cho_g: 30 },
        duringCHOgPerHour: null,
        post: { minutesAfter: 30, cho_g: 50, protein_g: 20 }
      },
      meals: [
        { meal: 'breakfast', ratio: 0.25, cho_g: 62, protein_g: 30, fat_g: 17, kcal: 500 },
        { meal: 'lunch', ratio: 0.35, cho_g: 87, protein_g: 42, fat_g: 23, kcal: 700 },
        { meal: 'dinner', ratio: 0.40, cho_g: 100, protein_g: 48, fat_g: 27, kcal: 800 }
      ]
    };

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

Task: Create 2-3 Indonesian-style meal options for each meal (breakfast, lunch, dinner).
For each option, include:
- name
- foods: array of strings with local ingredients and exact grams/ml
- description (short, appetizing)
- calories, protein, carbs, fat (numbers matching the meal targets)

Return ONLY strict JSON with keys breakfast, lunch, dinner.`;

    let suggestions: any = {};
    
    // Check for GROQ API key
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
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
      console.log("No GROQ API key available, using fallback suggestions");
      // Fallback suggestions
      suggestions = {
        breakfast: [
          {
            name: "Nasi Uduk + Ayam Goreng",
            foods: ["Nasi uduk (150g)", "Ayam goreng (100g)", "Sambal kacang (30g)", "Timun (50g)"],
            description: "Nasi uduk dengan ayam goreng dan sambal kacang",
            calories: 500,
            protein: 30,
            carbs: 62,
            fat: 17
          }
        ],
        lunch: [
          {
            name: "Nasi Padang",
            foods: ["Nasi putih (150g)", "Rendang daging (100g)", "Sayur daun singkong (100g)", "Sambal ijo (20g)"],
            description: "Nasi putih dengan rendang dan sayuran",
            calories: 700,
            protein: 42,
            carbs: 87,
            fat: 23
          }
        ],
        dinner: [
          {
            name: "Pecel Lele",
            foods: ["Lele goreng (200g)", "Nasi putih (150g)", "Lalapan (100g)", "Sambal terasi (30g)"],
            description: "Lele goreng dengan sambal dan lalapan",
            calories: 800,
            protein: 48,
            carbs: 100,
            fat: 27
          }
        ]
      };
    }

    // Build response structure
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

    console.log("Meal suggestions generated successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        date: requestDate, 
        load: dayTarget.load, 
        kcal: dayTarget.kcal, 
        targets: dayTarget.grams, 
        fueling: dayTarget.fueling, 
        meals: baseOut 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in AI meal generator test:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
