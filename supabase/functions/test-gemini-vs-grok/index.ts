import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserProfile {
  age: number;
  weightKg: number;
  heightCm: number;
  sex: 'male' | 'female';
}

interface DayTarget {
  kcal: number;
  cho_g: number;
  protein_g: number;
  fat_g: number;
}

interface MealPlan {
  breakfast: { kcal: number; protein_g: number; cho_g: number; fat_g: number };
  lunch: { kcal: number; protein_g: number; cho_g: number; fat_g: number };
  dinner: { kcal: number; protein_g: number; cho_g: number; fat_g: number };
  snack?: { kcal: number; protein_g: number; cho_g: number; fat_g: number };
}

type TrainingLoad = 'rest' | 'easy' | 'moderate' | 'long' | 'quality';

async function testGeminiMealSuggestions(
  userProfile: UserProfile,
  dayTarget: DayTarget,
  trainingLoad: TrainingLoad,
  date: string,
  includeSnack: boolean,
  unifiedMealPlan: MealPlan,
  geminiApiKey: string,
  dietaryRestrictions: string[],
  eatingBehaviors: string[]
): Promise<{suggestions: Record<string, any[]>, rawResponse?: any, error?: string}> {
  const context = `
You are an expert Indonesian nutritionist and meal planner for runners.

User Profile:
- Age: ${userProfile.age}
- Weight: ${userProfile.weightKg} kg
- Height: ${userProfile.heightCm} cm
- Sex: ${userProfile.sex}

Dietary Restrictions: ${dietaryRestrictions.length > 0 ? dietaryRestrictions.join(', ') : 'None'}
Eating Behaviors: ${eatingBehaviors.length > 0 ? eatingBehaviors.join(', ') : 'None'}

Nutrition Targets for ${date}:
- Training Load: ${trainingLoad} (rest/easy/moderate/long/quality)
- Total Calories: ${dayTarget.kcal} kcal
- Carbohydrates: ${dayTarget.cho_g}g (${Math.round((dayTarget.cho_g * 4 / dayTarget.kcal) * 100)}%)
- Protein: ${dayTarget.protein_g}g (${Math.round((dayTarget.protein_g * 4 / dayTarget.kcal) * 100)}%)
- Fat: ${dayTarget.fat_g}g (${Math.round((dayTarget.fat_g * 9 / dayTarget.kcal) * 100)}%)

Create a complete daily meal plan with AUTHENTIC INDONESIAN FOODS for:
- Breakfast: ${unifiedMealPlan.breakfast.kcal} kcal (P:${unifiedMealPlan.breakfast.protein_g}g, C:${unifiedMealPlan.breakfast.cho_g}g, F:${unifiedMealPlan.breakfast.fat_g}g)
- Lunch: ${unifiedMealPlan.lunch.kcal} kcal (P:${unifiedMealPlan.lunch.protein_g}g, C:${unifiedMealPlan.lunch.cho_g}g, F:${unifiedMealPlan.lunch.fat_g}g)
- Dinner: ${unifiedMealPlan.dinner.kcal} kcal (P:${unifiedMealPlan.dinner.protein_g}g, C:${unifiedMealPlan.dinner.cho_g}g, F:${unifiedMealPlan.dinner.fat_g}g)
${includeSnack ? `- Snack (Recovery): ${unifiedMealPlan.snack?.kcal} kcal (P:${unifiedMealPlan.snack?.protein_g}g, C:${unifiedMealPlan.snack?.cho_g}g, F:${unifiedMealPlan.snack?.fat_g}g)` : ''}

REQUIREMENTS:
1. Use ONLY Indonesian foods (Nasi, Ayam, Ikan, Tempe, Tahu, Sayuran, etc.)
2. Include EXACT gram portions for ALL ingredients
3. Provide 2-3 meal options per meal type
4. Match the nutrition targets closely
5. Consider runner-specific needs for ${trainingLoad} training

Return ONLY valid JSON in this exact format:
{
  "breakfast": {
    "suggestions": [
      {
        "name": "Nasi Uduk + Ayam Goreng",
        "description": "Traditional coconut rice with fried chicken",
        "ingredients": [
          {"name": "Nasi Uduk", "amount": "150g", "calories": 200, "protein": 4, "carbs": 40, "fat": 2},
          {"name": "Ayam Goreng", "amount": "100g", "calories": 250, "protein": 25, "carbs": 0, "fat": 15}
        ],
        "total_calories": 450,
        "total_protein": 29,
        "total_carbs": 40,
        "total_fat": 17
      }
    ]
  },
  "lunch": { "suggestions": [ ... ] },
  "dinner": { "suggestions": [ ... ] }
${includeSnack ? ',\n  "snack": { "suggestions": [ ... ] }' : ''}
}`;

  try {
    console.log("Calling Gemini API...");
    // Test the API key with the current Gemini endpoint
    console.log(`Testing Gemini API key: ${geminiApiKey.substring(0, 10)}... (length: ${geminiApiKey.length})`);

    // Check if this looks like a Google API key (should start with specific patterns)
    if (geminiApiKey.startsWith('AIza')) {
      console.log("✅ API key has correct Google format");
    } else {
      console.log("⚠️ API key doesn't look like a Google API key");
      return { suggestions: {}, error: `API key format issue: doesn't start with 'AIza'` };
    }

    // First, list available models to see what's actually available
    const listModelsResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${geminiApiKey}`,
      {
        method: "GET",
      }
    );

    if (!listModelsResponse.ok) {
      const errorText = await listModelsResponse.text();
      console.error(`List models failed: ${listModelsResponse.status} - ${errorText}`);
      return { suggestions: {}, error: `List models failed: ${listModelsResponse.status} - ${errorText}` };
    }

    const modelsData = await listModelsResponse.json();
    console.log("Available Gemini models:", modelsData.models?.map((m: any) => m.name).join(", ") || "None");

    // Find a suitable model
    const availableModels = modelsData.models || [];
    const geminiModel = availableModels.find((m: any) =>
      m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent')
    );

    if (!geminiModel) {
      console.error("No suitable Gemini model found");
      return { suggestions: {}, error: `No suitable Gemini model found. Available: ${availableModels.map((m: any) => m.name).join(", ")}` };
    }

    console.log(`Using model: ${geminiModel.name}`);

    const testResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/${geminiModel.name}:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "Hello"
            }]
          }]
        }),
      }
    );

    console.log(`Test response status: ${testResponse.status}`);

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error(`Gemini API test failed: ${testResponse.status} - ${errorText}`);
      return { suggestions: {}, error: `API test failed: ${testResponse.status} - ${errorText}` };
    }

    console.log("Gemini API key is valid, now making full request...");

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/${geminiModel.name}:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: context
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
            responseMimeType: "application/json"
          }
        }),
      }
    );

    if (!aiResponse.ok) {
      console.error(`Gemini API error: ${aiResponse.status}`);
      return { suggestions: {}, error: `API error: ${aiResponse.status}` };
    }

    const aiData = await aiResponse.json();
    console.log("Gemini API Response:", JSON.stringify(aiData, null, 2));

    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error("No content in Gemini response");
      console.log("Full response:", aiData);
      return { suggestions: {}, rawResponse: aiData, error: "No content in response" };
    }

    console.log("Gemini content:", content.substring(0, 500) + "...");

    try {
      const parsed = JSON.parse(content);
      console.log("Gemini parsed successfully:", Object.keys(parsed));
      const suggestions: Record<string, any[]> = {};

      // Extract suggestions from AI response
      for (const mealType of ['breakfast', 'lunch', 'dinner', 'snack']) {
        if (parsed[mealType]?.suggestions) {
          suggestions[mealType] = parsed[mealType].suggestions;
        }
      }

      return { suggestions };
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", parseError);
      console.error("Content that failed to parse:", content);
      return { suggestions: {}, rawResponse: aiData, error: `JSON parse error: ${parseError.message}`, content: content };
    }
  } catch (error) {
    console.error('Error generating Gemini suggestions:', error);
    return { suggestions: {}, error: error.message };
  }
}

async function testGrokMealSuggestions(
  userProfile: UserProfile,
  dayTarget: DayTarget,
  trainingLoad: TrainingLoad,
  date: string,
  includeSnack: boolean,
  unifiedMealPlan: MealPlan,
  groqApiKey: string,
  dietaryRestrictions: string[],
  eatingBehaviors: string[]
): Promise<Record<string, any[]>> {
  const context = `
You are an expert Indonesian nutritionist and meal planner for runners.

User Profile:
- Age: ${userProfile.age}
- Weight: ${userProfile.weightKg} kg
- Height: ${userProfile.heightCm} cm
- Sex: ${userProfile.sex}

Dietary Restrictions: ${dietaryRestrictions.length > 0 ? dietaryRestrictions.join(', ') : 'None'}
Eating Behaviors: ${eatingBehaviors.length > 0 ? eatingBehaviors.join(', ') : 'None'}

Nutrition Targets for ${date}:
- Training Load: ${trainingLoad} (rest/easy/moderate/long/quality)
- Total Calories: ${dayTarget.kcal} kcal
- Carbohydrates: ${dayTarget.cho_g}g (${Math.round((dayTarget.cho_g * 4 / dayTarget.kcal) * 100)}%)
- Protein: ${dayTarget.protein_g}g (${Math.round((dayTarget.protein_g * 4 / dayTarget.kcal) * 100)}%)
- Fat: ${dayTarget.fat_g}g (${Math.round((dayTarget.fat_g * 9 / dayTarget.kcal) * 100)}%)

Create a complete daily meal plan with AUTHENTIC INDONESIAN FOODS for:
- Breakfast: ${unifiedMealPlan.breakfast.kcal} kcal (P:${unifiedMealPlan.breakfast.protein_g}g, C:${unifiedMealPlan.breakfast.cho_g}g, F:${unifiedMealPlan.breakfast.fat_g}g)
- Lunch: ${unifiedMealPlan.lunch.kcal} kcal (P:${unifiedMealPlan.lunch.protein_g}g, C:${unifiedMealPlan.lunch.cho_g}g, F:${unifiedMealPlan.lunch.fat_g}g)
- Dinner: ${unifiedMealPlan.dinner.kcal} kcal (P:${unifiedMealPlan.dinner.protein_g}g, C:${unifiedMealPlan.dinner.cho_g}g, F:${unifiedMealPlan.dinner.fat_g}g)
${includeSnack ? `- Snack (Recovery): ${unifiedMealPlan.snack?.kcal} kcal (P:${unifiedMealPlan.snack?.protein_g}g, C:${unifiedMealPlan.snack?.cho_g}g, F:${unifiedMealPlan.snack?.fat_g}g)` : ''}

REQUIREMENTS:
1. Use ONLY Indonesian foods (Nasi, Ayam, Ikan, Tempe, Tahu, Sayuran, etc.)
2. Include EXACT gram portions for ALL ingredients
3. Provide 2-3 meal options per meal type
4. Match the nutrition targets closely
5. Consider runner-specific needs for ${trainingLoad} training

Return ONLY valid JSON in this exact format:
{
  "breakfast": {
    "suggestions": [
      {
        "name": "Nasi Uduk + Ayam Goreng",
        "description": "Traditional coconut rice with fried chicken",
        "ingredients": [
          {"name": "Nasi Uduk", "amount": "150g", "calories": 200, "protein": 4, "carbs": 40, "fat": 2},
          {"name": "Ayam Goreng", "amount": "100g", "calories": 250, "protein": 25, "carbs": 0, "fat": 15}
        ],
        "total_calories": 450,
        "total_protein": 29,
        "total_carbs": 40,
        "total_fat": 17
      }
    ]
  },
  "lunch": { "suggestions": [ ... ] },
  "dinner": { "suggestions": [ ... ] }
${includeSnack ? ',\n  "snack": { "suggestions": [ ... ] }' : ''}
}`;

  try {
    console.log("Calling Grok API...");
    const aiResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "You are an expert Indonesian nutritionist specializing in runner nutrition. Return ONLY valid JSON."
            },
            { role: "user", content: context }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
      }
    );

    if (!aiResponse.ok) {
      console.error(`Grok API error: ${aiResponse.status}`);
      return {};
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error("No content in Grok response");
      return {};
    }

    const parsed = JSON.parse(content);
    const suggestions: Record<string, any[]> = {};

    // Extract suggestions from AI response
    for (const mealType of ['breakfast', 'lunch', 'dinner', 'snack']) {
      if (parsed[mealType]?.suggestions) {
        suggestions[mealType] = parsed[mealType].suggestions;
      }
    }

    return suggestions;
  } catch (error) {
    console.error('Error generating Grok suggestions:', error);
    return {};
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Allow testing without authentication
    const { userProfile, dayTarget, trainingLoad, date, includeSnack, unifiedMealPlan, dietaryRestrictions, eatingBehaviors } = await req.json();

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    console.log(`Testing Gemini vs Grok for meal suggestions`);
    console.log(`GROQ API Key available: ${!!GROQ_API_KEY}`);
    console.log(`GEMINI API Key available: ${!!GEMINI_API_KEY}`);
    console.log(`GEMINI API Key length: ${GEMINI_API_KEY?.length || 0}`);
    console.log(`GEMINI API Key starts with: ${GEMINI_API_KEY?.substring(0, 4) || 'N/A'}`);

    const results: any = {
      testDate: new Date().toISOString(),
      userProfile,
      dayTarget,
      trainingLoad,
      gemini: null,
      grok: null,
      comparison: null
    };

    // Test Gemini
    if (GEMINI_API_KEY) {
      try {
        console.log("Testing Gemini...");
        const geminiStart = Date.now();
        const geminiResult = await testGeminiMealSuggestions(
          userProfile,
          dayTarget,
          trainingLoad,
          date,
          includeSnack,
          unifiedMealPlan,
          GEMINI_API_KEY,
          dietaryRestrictions,
          eatingBehaviors
        );
        const geminiTime = Date.now() - geminiStart;

        results.gemini = {
          suggestions: geminiResult.suggestions,
          responseTime: geminiTime,
          success: Object.keys(geminiResult.suggestions).length > 0,
          error: geminiResult.error,
          rawResponse: geminiResult.rawResponse,
          content: geminiResult.content
        };
        console.log(`Gemini completed in ${geminiTime}ms`);
      } catch (error) {
        console.error("Gemini test failed:", error);
        results.gemini = {
          error: error.message,
          success: false
        };
      }
    }

    // Test Grok
    if (GROQ_API_KEY) {
      try {
        console.log("Testing Grok...");
        const grokStart = Date.now();
        const grokSuggestions = await testGrokMealSuggestions(
          userProfile,
          dayTarget,
          trainingLoad,
          date,
          includeSnack,
          unifiedMealPlan,
          GROQ_API_KEY,
          dietaryRestrictions,
          eatingBehaviors
        );
        const grokTime = Date.now() - grokStart;
        
        results.grok = {
          suggestions: grokSuggestions,
          responseTime: grokTime,
          success: Object.keys(grokSuggestions).length > 0
        };
        console.log(`Grok completed in ${grokTime}ms`);
      } catch (error) {
        console.error("Grok test failed:", error);
        results.grok = {
          error: error.message,
          success: false
        };
      }
    }

    // Compare results
    if (results.gemini && results.grok) {
      results.comparison = {
        geminiFaster: results.gemini.responseTime < results.grok.responseTime,
        geminiMoreMeals: Object.keys(results.gemini.suggestions).length > Object.keys(results.grok.suggestions).length,
        bothSuccessful: results.gemini.success && results.grok.success,
        speedDifference: Math.abs(results.gemini.responseTime - results.grok.responseTime),
        recommendation: results.gemini.success && results.gemini.responseTime < results.grok.responseTime ? 'gemini' : 'grok'
      };
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Test function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
