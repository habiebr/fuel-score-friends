/**
 * Unified Meal Planning Service
 * 
 * Single source of truth for all meal planning operations.
 * Used by: generate-meal-plan, daily-meal-generation, generate-daily-nutrition,
 *          generate-meal-plan-range, refresh-meal-plan
 */

import {
  UserProfile,
  TrainingLoad,
  DayTarget,
  MealType,
  determineTrainingLoad,
  generateDayTarget,
  generateMealPlan,
  shouldIncludeSnack,
} from './nutrition-unified.ts';

export interface MealPlanOptions {
  userId: string;
  date: string;
  userProfile: UserProfile;
  trainingActivity?: string;
  trainingDuration?: number;
  trainingDistance?: number;
  googleFitCalories?: number;
  useAI?: boolean;
  groqApiKey?: string;
}

export interface MealPlanResult {
  date: string;
  trainingLoad: TrainingLoad;
  totalCalories: number;
  meals: Record<string, {
    kcal: number;
    protein_g: number;
    cho_g: number;
    fat_g: number;
    suggestions: any[];
  }>;
}

export interface DatabaseMealPlan {
  user_id: string;
  date: string;
  meal_type: string;
  recommended_calories: number;
  recommended_protein_grams: number;
  recommended_carbs_grams: number;
  recommended_fat_grams: number;
  meal_suggestions: any[];
}

/**
 * Generate a complete meal plan for a user on a specific date
 */
export async function generateUserMealPlan(
  options: MealPlanOptions
): Promise<MealPlanResult> {
  const {
    userId,
    date,
    userProfile,
    trainingActivity = 'rest',
    trainingDuration,
    trainingDistance,
    googleFitCalories,
    useAI = false,
    groqApiKey
  } = options;

  // STEP 1: Determine training load
  const trainingLoad = determineTrainingLoad(
    trainingActivity,
    trainingDuration,
    trainingDistance
  );

  // STEP 2: Generate day target using unified engine
  const dayTarget = generateDayTarget(userProfile, date, trainingLoad);

  // STEP 3: Adjust for actual Google Fit data if available
  let adjustedDayTarget = dayTarget;
  if (googleFitCalories && googleFitCalories > 0) {
    // If we have real calories burned, recalculate TDEE
    // BMR + actual activity calories
    const bmrCalories = Math.round(
      10 * userProfile.weightKg +
      6.25 * userProfile.heightCm -
      5 * userProfile.age +
      (userProfile.sex === 'male' ? 5 : -161)
    );
    const adjustedTotalCalories = bmrCalories + googleFitCalories;
    
    // Recalculate macros with same load-based ratios
    const { cho_g, protein_g, fat_g } = dayTarget;
    const currentTotal = dayTarget.kcal;
    const scaleFactor = adjustedTotalCalories / currentTotal;
    
    adjustedDayTarget = {
      ...dayTarget,
      kcal: adjustedTotalCalories,
      cho_g: Math.round(cho_g * scaleFactor),
      protein_g: Math.round(protein_g * scaleFactor),
      fat_g: Math.round(fat_g * scaleFactor),
    };
  }

  // STEP 4: Generate meal plan
  const includeSnack = shouldIncludeSnack(trainingLoad);
  const unifiedMealPlan = generateMealPlan(adjustedDayTarget, includeSnack);

  // STEP 5: Generate AI meal suggestions if enabled
  let aiSuggestions: Record<string, any[]> = {};
  if (useAI && groqApiKey) {
    aiSuggestions = await generateAISuggestions({
      userProfile,
      dayTarget: adjustedDayTarget,
      trainingLoad,
      date,
      includeSnack,
      unifiedMealPlan,
      groqApiKey
    });
  }

  // STEP 6: Combine unified targets with AI suggestions
  const meals: Record<string, any> = {};
  const mealTypes = includeSnack 
    ? ['breakfast', 'lunch', 'dinner', 'snack'] 
    : ['breakfast', 'lunch', 'dinner'];

  for (const mealType of mealTypes) {
    const targets = unifiedMealPlan[mealType as keyof typeof unifiedMealPlan];
    meals[mealType] = {
      kcal: targets.kcal,
      protein_g: targets.protein_g,
      cho_g: targets.cho_g,
      fat_g: targets.fat_g,
      suggestions: aiSuggestions[mealType] || []
    };
  }

  return {
    date,
    trainingLoad,
    totalCalories: adjustedDayTarget.kcal,
    meals
  };
}

/**
 * Convert MealPlanResult to database records
 */
export function mealPlanToDbRecords(
  userId: string,
  mealPlan: MealPlanResult
): DatabaseMealPlan[] {
  const records: DatabaseMealPlan[] = [];

  for (const [mealType, meal] of Object.entries(mealPlan.meals)) {
    records.push({
      user_id: userId,
      date: mealPlan.date,
      meal_type: mealType,
      recommended_calories: meal.kcal,
      recommended_protein_grams: meal.protein_g,
      recommended_carbs_grams: meal.cho_g,
      recommended_fat_grams: meal.fat_g,
      meal_suggestions: meal.suggestions
    });
  }

  return records;
}

/**
 * Generate AI meal suggestions using Groq
 */
async function generateAISuggestions(options: {
  userProfile: UserProfile;
  dayTarget: DayTarget;
  trainingLoad: TrainingLoad;
  date: string;
  includeSnack: boolean;
  unifiedMealPlan: any;
  groqApiKey: string;
}): Promise<Record<string, any[]>> {
  const {
    userProfile,
    dayTarget,
    trainingLoad,
    date,
    includeSnack,
    unifiedMealPlan,
    groqApiKey
  } = options;

  const context = `
You are an expert Indonesian nutritionist and meal planner for runners.

User Profile:
- Age: ${userProfile.age}
- Weight: ${userProfile.weightKg} kg
- Height: ${userProfile.heightCm} cm
- Sex: ${userProfile.sex}

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
${includeSnack ? `- Snack (Recovery): ${unifiedMealPlan.snack.kcal} kcal (P:${unifiedMealPlan.snack.protein_g}g, C:${unifiedMealPlan.snack.cho_g}g, F:${unifiedMealPlan.snack.fat_g}g)` : ''}

REQUIREMENTS:
1. Use ONLY Indonesian foods (Nasi, Ayam, Ikan, Tempe, Tahu, Sayuran, etc.)
2. Include EXACT gram portions for ALL ingredients
3. Provide 2-3 meal options per meal type
4. Match the nutrition targets closely
5. Consider runner-specific needs for ${trainingLoad} training days

Return ONLY valid JSON in this format:
{
  "breakfast": {
    "suggestions": [
      {
        "name": "Nama Makanan Indonesia",
        "foods": ["Bahan 1 (100g)", "Bahan 2 (50g)"],
        "description": "Deskripsi singkat",
        "calories": ${unifiedMealPlan.breakfast.kcal},
        "protein": ${unifiedMealPlan.breakfast.protein_g},
        "carbs": ${unifiedMealPlan.breakfast.cho_g},
        "fat": ${unifiedMealPlan.breakfast.fat_g}
      }
    ]
  },
  "lunch": { "suggestions": [ ... ] },
  "dinner": { "suggestions": [ ... ] }${includeSnack ? ',\n  "snack": { "suggestions": [ ... ] }' : ''}
}`;

  try {
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
      console.error(`AI API error: ${aiResponse.status}`);
      return {};
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
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
    console.error('Error generating AI suggestions:', error);
    return {};
  }
}

/**
 * Fallback Indonesian meal suggestions (used when AI is unavailable)
 */
export function getFallbackIndonesianMeals(
  mealType: string,
  targetKcal: number
): any[] {
  const suggestions: Record<string, any[]> = {
    breakfast: [
      {
        name: "Nasi Uduk + Ayam Goreng",
        description: "Nasi uduk dengan ayam goreng dan sambal kacang",
        foods: ["Nasi uduk (150g)", "Ayam goreng (100g)", "Sambal kacang (30g)", "Timun (50g)"],
        calories: 450,
        protein: 25,
        carbs: 45,
        fat: 18
      },
      {
        name: "Bubur Ayam",
        description: "Bubur nasi dengan ayam suwir dan pelengkap",
        foods: ["Bubur nasi (200g)", "Ayam suwir (80g)", "Kacang kedelai (20g)", "Bawang goreng (5g)"],
        calories: 380,
        protein: 22,
        carbs: 42,
        fat: 12
      }
    ],
    lunch: [
      {
        name: "Nasi Padang",
        description: "Nasi putih dengan rendang dan sayuran",
        foods: ["Nasi putih (150g)", "Rendang daging (100g)", "Sayur daun singkong (100g)", "Sambal ijo (20g)"],
        calories: 650,
        protein: 35,
        carbs: 55,
        fat: 28
      },
      {
        name: "Gado-gado",
        description: "Salad sayuran dengan bumbu kacang",
        foods: ["Sayuran segar (200g)", "Tahu (80g)", "Tempe (60g)", "Bumbu kacang (45g)"],
        calories: 420,
        protein: 28,
        carbs: 35,
        fat: 22
      }
    ],
    dinner: [
      {
        name: "Pecel Lele",
        description: "Lele goreng dengan sambal dan lalapan",
        foods: ["Lele goreng (200g)", "Nasi putih (150g)", "Lalapan (100g)", "Sambal terasi (30g)"],
        calories: 520,
        protein: 38,
        carbs: 45,
        fat: 20
      },
      {
        name: "Rawon",
        description: "Sup daging dengan bumbu hitam khas Jawa Timur",
        foods: ["Daging sapi (120g)", "Nasi putih (150g)", "Tauge (60g)", "Sambal (15g)"],
        calories: 480,
        protein: 35,
        carbs: 42,
        fat: 18
      }
    ],
    snack: [
      {
        name: "Pisang + Susu Kedelai",
        description: "Snack pemulihan pasca lari dengan protein dan karbohidrat",
        foods: ["Pisang (120g)", "Susu kedelai (200ml)", "Madu (15g)"],
        calories: 280,
        protein: 10,
        carbs: 48,
        fat: 6
      },
      {
        name: "Air Kelapa + Kacang Almond",
        description: "Rehidrasi dan protein untuk recovery",
        foods: ["Air kelapa muda (300ml)", "Kacang almond (30g)", "Kurma (40g)"],
        calories: 250,
        protein: 8,
        carbs: 35,
        fat: 10
      }
    ]
  };

  const mealSuggestions = suggestions[mealType] || [];
  
  // Return closest match based on calories
  const sorted = [...mealSuggestions].sort((a, b) => {
    const diffA = Math.abs(a.calories - targetKcal);
    const diffB = Math.abs(b.calories - targetKcal);
    return diffA - diffB;
  });

  return sorted.slice(0, 2); // Return top 2 closest matches
}

