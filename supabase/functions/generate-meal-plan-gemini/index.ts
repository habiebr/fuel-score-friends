import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI } from "npm:@google/genai";
import { getSupabaseAdmin, getGroqKey } from "../_shared/env.ts";
import {
  generateUserMealPlan,
  mealPlanToDbRecords,
  type MealPlanOptions
} from "../_shared/meal-planner.ts";

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

async function generateGeminiMealSuggestions(
  userProfile: UserProfile,
  dayTarget: DayTarget,
  trainingLoad: TrainingLoad,
  date: string,
  includeSnack: boolean,
  unifiedMealPlan: MealPlan,
  geminiApiKey: string,
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
    console.log("Calling Gemini API for meal suggestions...");
    console.log(`API Key starts with: ${geminiApiKey.substring(0, 10)}...`);

    // Initialize Google GenAI
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    console.log('Google GenAI initialized successfully');

    // Call Gemini with optimized settings
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp", // Using Gemini 2.0 Flash (latest available)
      contents: [{ text: context }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: "application/json"
      }
    });

    console.log('Gemini response received successfully');
    const aiResponse = response.text;
    console.log('Response text length:', aiResponse?.length || 0);
    console.log('Response preview:', aiResponse?.substring?.(0, 200) || 'empty');

    // Clean and parse response
    let cleanedResponse = aiResponse.trim();
    console.log('Cleaning response, original length:', cleanedResponse.length);

    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*\n/, '').replace(/\n```\s*$/, '');
      console.log('Removed ```json markers');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '');
      console.log('Removed ``` markers');
    }

    console.log('Cleaned response:', cleanedResponse.substring(0, 300) + '...');

    const parsed = JSON.parse(cleanedResponse);
    console.log('Gemini parsed successfully, keys:', Object.keys(parsed));

    const suggestions: Record<string, any[]> = {};

    // Extract suggestions from AI response
    for (const mealType of ['breakfast', 'lunch', 'dinner', 'snack']) {
      if (parsed[mealType]?.suggestions) {
        suggestions[mealType] = parsed[mealType].suggestions;
        console.log(`${mealType}: ${parsed[mealType].suggestions.length} suggestions`);
      }
    }

    return suggestions;

  } catch (error) {
    console.error('Gemini meal suggestion error:', error);
    console.error('Error type:', typeof error);
    console.error('Error name:', error?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    return {};
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

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

    // Extract token
    const token = authHeader.replace("Bearer ", "");

    let userId: string;
    try {
      // Check if this is a service role key (much longer) or JWT token
      if (token.length > 200) {
        // This is likely a service role key, use test user ID from request body
        const requestBody = await req.json();
        userId = requestBody.userId || 'test-user';
        console.log(`2. Using service role key with test user: ${userId}`);
      } else {
        // This is a JWT token, decode it
        const parts = token.split('.');
        if (parts.length !== 3) {
          throw new Error("Invalid token format");
        }
        const payload = JSON.parse(atob(parts[1]));
        userId = payload.sub;
        console.log(`2. User ID extracted from JWT: ${userId}`);
      }
    } catch (e) {
      console.error("Token decode error:", e);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read request body for parameters
    const requestBody = await req.json();
    const { date, useAI: forceAI } = requestBody;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    console.log(`Gemini Meal Plan Generator - ${new Date().toISOString()}`);
    console.log(`API Key available: ${!!GEMINI_API_KEY}`);
    console.log(`API Key length: ${GEMINI_API_KEY?.length || 0}`);
    console.log(`API Key starts with: ${GEMINI_API_KEY?.substring(0, 4) || 'N/A'}`);

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({
        error: 'GEMINI_API_KEY not configured',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if API key looks valid (Google keys start with 'AIza')
    if (!GEMINI_API_KEY.startsWith('AIza')) {
      console.warn('WARNING: API key does not have expected Google format');
    }

    // Create admin client with service role key for database operations
    const supabaseAdmin = getSupabaseAdmin();
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

    // Fetch Google Fit data for actual calories burned
    const { data: googleFitData } = await supabaseAdmin
      .from("google_fit_data")
      .select("*")
      .eq("user_id", userId)
      .eq("date", requestDate)
      .single();

    // Get training plan for today
    const fitnessGoal = profile?.goal_type || profile?.fitness_goals?.[0];
    const weekPlan = profile?.activity_level ? JSON.parse(profile.activity_level) : null;
    const dayPlan = Array.isArray(weekPlan) ? weekPlan.find((d: any) => d && d.day === requestWeekday) : null;

    // Get user dietary preferences
    const dietaryRestrictions = profile?.dietary_restrictions || [];
    const eatingBehaviors = profile?.eating_behaviors || [];

    console.log(`User preferences - Restrictions: ${dietaryRestrictions.join(', ') || 'None'}, Behaviors: ${eatingBehaviors.join(', ') || 'None'}`);

    // Create user profile for unified engine
    const userProfile = {
      weightKg: profile?.weight_kg || profile?.weight || 70,
      heightCm: profile?.height_cm || profile?.height || 170,
      age: profile?.age || 30,
      sex: (profile?.sex || 'male') as 'male' | 'female'
    };

    console.log("5. Using unified meal planner service...");

    // Calculate training load and day target
    console.log("6. Calculating training load and targets...");

    // Import required functions
    const { calculateTDEE, calculateMacros } = await import("../_shared/nutrition-unified.ts");

    // Determine training load
    const trainingActivity = dayPlan?.activity || 'rest';
    const trainingDuration = dayPlan?.duration || 0;
    const trainingDistance = dayPlan?.distanceKm || 0;
    const googleFitCalories = googleFitData?.calories_burned || 0;

    let trainingLoad: 'rest' | 'easy' | 'moderate' | 'long' | 'quality' = 'rest';

    // Determine training load based on activity
    if (trainingActivity === 'rest') {
      trainingLoad = 'rest';
    } else if (trainingActivity === 'easy_run' || trainingActivity === 'recovery_run') {
      trainingLoad = 'easy';
    } else if (trainingActivity === 'tempo' || trainingActivity === 'intervals') {
      trainingLoad = 'quality';
    } else if (trainingDuration >= 90 || trainingDistance >= 15) {
      trainingLoad = 'long';
    } else if (trainingDuration >= 60 || trainingDistance >= 10) {
      trainingLoad = 'moderate';
    } else if (trainingDuration >= 30 || trainingDistance >= 5) {
      trainingLoad = 'easy';
    }

    console.log(`Training activity: ${trainingActivity}, duration: ${trainingDuration}min, distance: ${trainingDistance}km`);
    console.log(`Determined training load: ${trainingLoad}`);

    // Calculate TDEE and macros
    const tdee = calculateTDEE(userProfile, trainingLoad);
    const macros = calculateMacros(userProfile, trainingLoad, tdee);

    // Create day target
    const dayTarget = {
      calories: tdee,
      protein: macros.protein,
      carbs: macros.cho,
      fat: macros.fat
    };

    console.log(`Day target - Calories: ${dayTarget.calories}, Protein: ${dayTarget.protein}g, Carbs: ${dayTarget.carbs}g, Fat: ${dayTarget.fat}g`);

    // Include snack by default
    const includeSnack = true;

    let suggestions;
    let errorDetails = null;

    try {
      suggestions = await generateGeminiMealSuggestions(
        userProfile,
        dayTarget,
        trainingLoad,
        requestDate,
        includeSnack,
        undefined, // unifiedMealPlan - not needed for Gemini
        GEMINI_API_KEY,
        dietaryRestrictions,
        eatingBehaviors
      );
    } catch (error) {
      console.error('Function-level error:', error);
      errorDetails = {
        name: error?.name || 'Unknown',
        message: error?.message || 'Unknown error',
        type: typeof error
      };
      suggestions = {};
    }

    // Convert Gemini response format to Grok format for compatibility
    const grokFormatMeals = {
      breakfast: { suggestions: [], kcal: Math.round(dayTarget.calories * 0.25), protein_g: Math.round(dayTarget.protein * 0.25), cho_g: Math.round(dayTarget.carbs * 0.25), fat_g: Math.round(dayTarget.fat * 0.25) },
      lunch: { suggestions: [], kcal: Math.round(dayTarget.calories * 0.35), protein_g: Math.round(dayTarget.protein * 0.35), cho_g: Math.round(dayTarget.carbs * 0.35), fat_g: Math.round(dayTarget.fat * 0.35) },
      dinner: { suggestions: [], kcal: Math.round(dayTarget.calories * 0.35), protein_g: Math.round(dayTarget.protein * 0.35), cho_g: Math.round(dayTarget.carbs * 0.35), fat_g: Math.round(dayTarget.fat * 0.35) }
    };

    // Add snack if included
    if (includeSnack) {
      grokFormatMeals.snack = { suggestions: [], kcal: Math.round(dayTarget.calories * 0.05), protein_g: Math.round(dayTarget.protein * 0.05), cho_g: Math.round(dayTarget.carbs * 0.05), fat_g: Math.round(dayTarget.fat * 0.05) };
    }

    // Convert Gemini suggestions to Grok format
    if (suggestions.breakfast) {
      grokFormatMeals.breakfast.suggestions = suggestions.breakfast.map(item => ({
        name: item.name || item,
        foods: item.foods || [item.name || item],
        description: item.description || `Delicious ${item.name || item}`,
        calories: item.calories || item.kcal || Math.round(grokFormatMeals.breakfast.kcal / 3),
        protein: item.protein || item.protein_g || Math.round(grokFormatMeals.breakfast.protein_g / 3),
        carbs: item.carbs || item.cho || Math.round(grokFormatMeals.breakfast.cho_g / 3),
        fat: item.fat || item.fat_g || Math.round(grokFormatMeals.breakfast.fat_g / 3)
      }));
    }

    if (suggestions.lunch) {
      grokFormatMeals.lunch.suggestions = suggestions.lunch.map(item => ({
        name: item.name || item,
        foods: item.foods || [item.name || item],
        description: item.description || `Delicious ${item.name || item}`,
        calories: item.calories || item.kcal || Math.round(grokFormatMeals.lunch.kcal / 3),
        protein: item.protein || item.protein_g || Math.round(grokFormatMeals.lunch.protein_g / 3),
        carbs: item.carbs || item.cho || Math.round(grokFormatMeals.lunch.cho_g / 3),
        fat: item.fat || item.fat_g || Math.round(grokFormatMeals.lunch.fat_g / 3)
      }));
    }

    if (suggestions.dinner) {
      grokFormatMeals.dinner.suggestions = suggestions.dinner.map(item => ({
        name: item.name || item,
        foods: item.foods || [item.name || item],
        description: item.description || `Delicious ${item.name || item}`,
        calories: item.calories || item.kcal || Math.round(grokFormatMeals.dinner.kcal / 3),
        protein: item.protein || item.protein_g || Math.round(grokFormatMeals.dinner.protein_g / 3),
        carbs: item.carbs || item.cho || Math.round(grokFormatMeals.dinner.cho_g / 3),
        fat: item.fat || item.fat_g || Math.round(grokFormatMeals.dinner.fat_g / 3)
      }));
    }

    if (suggestions.snack) {
      grokFormatMeals.snack.suggestions = suggestions.snack.map(item => ({
        name: item.name || item,
        foods: item.foods || [item.name || item],
        description: item.description || `Delicious ${item.name || item}`,
        calories: item.calories || item.kcal || Math.round(grokFormatMeals.snack.kcal / 3),
        protein: item.protein || item.protein_g || Math.round(grokFormatMeals.snack.protein_g / 3),
        carbs: item.carbs || item.cho || Math.round(grokFormatMeals.snack.cho_g / 3),
        fat: item.fat || item.fat_g || Math.round(grokFormatMeals.snack.fat_g / 3)
      }));
    }

    console.log(`7. Converted Gemini suggestions to Grok format`);

    // Save meal plan to database
    console.log("8. Saving meal plan to database...");
    const dbRecords = mealPlanToDbRecords(userId, requestDate, grokFormatMeals, trainingLoad);

    for (const record of dbRecords) {
      const { error: insertError } = await supabaseAdmin
        .from("daily_meal_plans")
        .upsert(record, {
          onConflict: 'user_id,date,meal_type',
          ignoreDuplicates: false
        });

      if (insertError) {
        console.error("Error saving meal plan record:", insertError);
      }
    }

    console.log(`9. Saved ${dbRecords.length} meal plan records to database`);

    const response = {
      success: true,
      totalCalories: dayTarget.calories,
      trainingLoad,
      meals: grokFormatMeals,
      message: 'Meal plan generated using Gemini 2.0 Flash and saved to database',
      timestamp: new Date().toISOString()
    };

    console.log(`10. Meal plan generated successfully with ${Object.keys(grokFormatMeals).length} meal types`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Gemini meal plan generator error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString(),
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
