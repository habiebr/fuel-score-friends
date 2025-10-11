import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🚀 Starting nutrition score recalculation...');

    // Get all unique user-date combinations that have food logs
    const { data: foodLogs, error: logsError } = await supabaseClient
      .from('food_logs')
      .select('user_id, logged_at')
      .order('logged_at', { ascending: true });

    if (logsError) {
      throw new Error(`Failed to fetch food logs: ${logsError.message}`);
    }

    // Group by user and date
    const combinations = new Map();
    foodLogs.forEach(log => {
      const date = log.logged_at.split('T')[0]; // Extract date part
      const key = `${log.user_id}-${date}`;
      combinations.set(key, { user_id: log.user_id, date });
    });

    const userDateCombinations = Array.from(combinations.values());
    console.log(`📊 Found ${userDateCombinations.length} user-date combinations to process`);

    if (userDateCombinations.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No food logs found. Nothing to recalculate.',
          processed: 0,
          errors: 0
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let processed = 0;
    let errors = 0;

    // Process each combination
    for (const { user_id, date } of userDateCombinations) {
      try {
        await processUserDate(supabaseClient, user_id, date);
        processed++;
        
        // Progress logging
        if (processed % 10 === 0) {
          console.log(`📈 Progress: ${processed}/${userDateCombinations.length} processed`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${user_id} on ${date}:`, error);
        errors++;
      }
    }

    console.log(`🎯 Recalculation complete! Processed: ${processed}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully recalculated nutrition scores`,
        processed,
        errors,
        total: userDateCombinations.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Fatal error during recalculation:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to recalculate nutrition scores' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * Calculate nutrition score based on planned vs actual consumption
 */
function calculateNutritionScore(
  plannedCalories: number,
  plannedProtein: number,
  plannedCarbs: number,
  plannedFat: number,
  actualCalories: number,
  actualProtein: number,
  actualCarbs: number,
  actualFat: number
): number {
  if (plannedCalories === 0) return 0;

  // Calculate individual macro scores
  const calorieScore = Math.min(100, (actualCalories / plannedCalories) * 100);
  const proteinScore = plannedProtein > 0 ? Math.min(100, (actualProtein / plannedProtein) * 100) : 100;
  const carbsScore = plannedCarbs > 0 ? Math.min(100, (actualCarbs / plannedCarbs) * 100) : 100;
  const fatScore = plannedFat > 0 ? Math.min(100, (actualFat / plannedFat) * 100) : 100;

  // Weighted score: calories 40%, macros 60% combined
  const weightedScore = calorieScore * 0.4 + (proteinScore + carbsScore + fatScore) / 3 * 0.6;

  // Penalty for significant overconsumption
  if (actualCalories > plannedCalories * 1.15) {
    return Math.max(0, weightedScore - 10);
  }

  return Math.round(Math.min(100, Math.max(0, weightedScore)));
}

/**
 * Calculate meal-level scores
 */
function calculateMealScore(
  plannedCalories: number,
  plannedProtein: number,
  plannedCarbs: number,
  plannedFat: number,
  actualCalories: number,
  actualProtein: number,
  actualCarbs: number,
  actualFat: number
): number {
  if (plannedCalories === 0) return 0;

  const calorieScore = Math.max(0, 100 - Math.abs(actualCalories - plannedCalories) / plannedCalories * 100);
  const proteinScore = plannedProtein > 0 ? Math.max(0, 100 - Math.abs(actualProtein - plannedProtein) / plannedProtein * 100) : 100;
  const carbsScore = plannedCarbs > 0 ? Math.max(0, 100 - Math.abs(actualCarbs - plannedCarbs) / plannedCarbs * 100) : 100;
  const fatScore = plannedFat > 0 ? Math.max(0, 100 - Math.abs(actualFat - plannedFat) / plannedFat * 100) : 100;

  return Math.round(calorieScore * 0.4 + (proteinScore + carbsScore + fatScore) / 3 * 0.6);
}

/**
 * Process a single user-date combination
 */
async function processUserDate(supabaseClient: any, userId: string, date: string): Promise<void> {
  // Get food logs for this user and date
  const { data: foodLogs, error: logsError } = await supabaseClient
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', `${date}T00:00:00`)
    .lt('logged_at', `${date}T23:59:59`);

  if (logsError) {
    throw new Error(`Failed to fetch food logs: ${logsError.message}`);
  }

  if (!foodLogs || foodLogs.length === 0) {
    return; // Skip if no food logs
  }

  // Get meal plans for this user and date
  const { data: mealPlans, error: plansError } = await supabaseClient
    .from('daily_meal_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date);

  if (plansError) {
    throw new Error(`Failed to fetch meal plans: ${plansError.message}`);
  }

  // Calculate totals
  const totalCalories = foodLogs.reduce((sum: number, log: any) => sum + (log.calories || 0), 0);
  const totalProtein = foodLogs.reduce((sum: number, log: any) => sum + (log.protein_grams || 0), 0);
  const totalCarbs = foodLogs.reduce((sum: number, log: any) => sum + (log.carbs_grams || 0), 0);
  const totalFat = foodLogs.reduce((sum: number, log: any) => sum + (log.fat_grams || 0), 0);

  const plannedCalories = mealPlans?.reduce((sum: number, plan: any) => sum + (plan.recommended_calories || 0), 0) || 0;
  const plannedProtein = mealPlans?.reduce((sum: number, plan: any) => sum + (plan.recommended_protein_grams || 0), 0) || 0;
  const plannedCarbs = mealPlans?.reduce((sum: number, plan: any) => sum + (plan.recommended_carbs_grams || 0), 0) || 0;
  const plannedFat = mealPlans?.reduce((sum: number, plan: any) => sum + (plan.recommended_fat_grams || 0), 0) || 0;

  // Calculate daily nutrition score
  const dailyScore = calculateNutritionScore(
    plannedCalories, plannedProtein, plannedCarbs, plannedFat,
    totalCalories, totalProtein, totalCarbs, totalFat
  );

  // Update meal-level scores
  if (mealPlans && mealPlans.length > 0) {
    for (const plan of mealPlans) {
      const mealLogs = foodLogs.filter((log: any) => log.meal_type === plan.meal_type);
      
      if (mealLogs.length > 0) {
        const mealCalories = mealLogs.reduce((sum: number, log: any) => sum + (log.calories || 0), 0);
        const mealProtein = mealLogs.reduce((sum: number, log: any) => sum + (log.protein_grams || 0), 0);
        const mealCarbs = mealLogs.reduce((sum: number, log: any) => sum + (log.carbs_grams || 0), 0);
        const mealFat = mealLogs.reduce((sum: number, log: any) => sum + (log.fat_grams || 0), 0);

        const mealScore = calculateMealScore(
          plan.recommended_calories, plan.recommended_protein_grams, 
          plan.recommended_carbs_grams, plan.recommended_fat_grams,
          mealCalories, mealProtein, mealCarbs, mealFat
        );

        // Update meal plan score
        const { error: updateError } = await supabaseClient
          .from('daily_meal_plans')
          .update({ meal_score: mealScore })
          .eq('id', plan.id);

        if (updateError) {
          console.error(`❌ Error updating meal score for ${plan.meal_type}:`, updateError.message);
        }
      }
    }
  }

  // Update or insert nutrition score
  const { error: scoreError } = await supabaseClient
    .from('nutrition_scores')
    .upsert({
      user_id: userId,
      date: date,
      daily_score: dailyScore,
      calories_consumed: Math.round(totalCalories),
      protein_grams: Math.round(totalProtein * 100) / 100,
      carbs_grams: Math.round(totalCarbs * 100) / 100,
      fat_grams: Math.round(totalFat * 100) / 100,
      meals_logged: foodLogs.length,
      planned_calories: plannedCalories,
      planned_protein_grams: plannedProtein,
      planned_carbs_grams: plannedCarbs,
      planned_fat_grams: plannedFat,
      updated_at: new Date().toISOString()
    }, { 
      onConflict: 'user_id,date' 
    });

  if (scoreError) {
    throw new Error(`Failed to update nutrition score: ${scoreError.message}`);
  }

  console.log(`✅ Updated nutrition score for ${userId} on ${date}: ${dailyScore}`);
}
