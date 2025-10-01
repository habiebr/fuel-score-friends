import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { date } = await req.json();
    const targetDate = date || new Date().toISOString().split('T')[0];

    console.log(`Calculating nutrition score for user ${user.id} on ${targetDate}`);

    // Fetch meal plans for the day
    const { data: mealPlans } = await supabaseClient
      .from('daily_meal_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', targetDate);

    if (!mealPlans || mealPlans.length === 0) {
      return new Response(JSON.stringify({ error: 'No meal plan found for this date' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch actual food logs for the day
    const { data: foodLogs } = await supabaseClient
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('logged_at', `${targetDate}T00:00:00`)
      .lte('logged_at', `${targetDate}T23:59:59`);

    // Calculate meal scores
    const mealTypes = ['breakfast', 'lunch', 'dinner'];
    const mealScores: { [key: string]: number } = {};
    let totalPlannedCalories = 0;
    let totalPlannedProtein = 0;
    let totalPlannedCarbs = 0;
    let totalPlannedFat = 0;

    for (const mealType of mealTypes) {
      const plan = mealPlans.find(p => p.meal_type === mealType);
      if (!plan) continue;

      totalPlannedCalories += plan.recommended_calories;
      totalPlannedProtein += plan.recommended_protein_grams;
      totalPlannedCarbs += plan.recommended_carbs_grams;
      totalPlannedFat += plan.recommended_fat_grams;

      // Get actual logs for this meal type
      const mealLogs = foodLogs?.filter(log => log.meal_type === mealType) || [];
      
      if (mealLogs.length === 0) {
        mealScores[mealType] = 0;
        continue;
      }

      const actualCalories = mealLogs.reduce((sum, log) => sum + log.calories, 0);
      const actualProtein = mealLogs.reduce((sum, log) => sum + (log.protein_grams || 0), 0);
      const actualCarbs = mealLogs.reduce((sum, log) => sum + (log.carbs_grams || 0), 0);
      const actualFat = mealLogs.reduce((sum, log) => sum + (log.fat_grams || 0), 0);

      // Calculate score based on deviation from plan
      // Perfect match = 100, larger deviations reduce score
      const calorieScore = Math.max(0, 100 - Math.abs(actualCalories - plan.recommended_calories) / plan.recommended_calories * 100);
      const proteinScore = Math.max(0, 100 - Math.abs(actualProtein - plan.recommended_protein_grams) / plan.recommended_protein_grams * 100);
      const carbsScore = Math.max(0, 100 - Math.abs(actualCarbs - plan.recommended_carbs_grams) / plan.recommended_carbs_grams * 100);
      const fatScore = Math.max(0, 100 - Math.abs(actualFat - plan.recommended_fat_grams) / plan.recommended_fat_grams * 100);

      // Weighted average (calories 40%, macros 60% combined)
      const mealScore = Math.round(
        calorieScore * 0.4 + 
        (proteinScore + carbsScore + fatScore) / 3 * 0.6
      );

      mealScores[mealType] = mealScore;

      // Update meal plan with score
      await supabaseClient
        .from('daily_meal_plans')
        .update({ meal_score: mealScore })
        .eq('id', plan.id);
    }

    // Calculate daily score (average of meal scores)
    const validScores = Object.values(mealScores).filter(score => score !== undefined);
    const dailyScore = validScores.length > 0
      ? Math.round(validScores.reduce((sum, score) => sum + score, 0) / validScores.length)
      : 0;

    // Calculate actual totals for the day
    const totalActualCalories = foodLogs?.reduce((sum, log) => sum + log.calories, 0) || 0;
    const totalActualProtein = foodLogs?.reduce((sum, log) => sum + (log.protein_grams || 0), 0) || 0;
    const totalActualCarbs = foodLogs?.reduce((sum, log) => sum + (log.carbs_grams || 0), 0) || 0;
    const totalActualFat = foodLogs?.reduce((sum, log) => sum + (log.fat_grams || 0), 0) || 0;
    const mealsLogged = foodLogs?.length || 0;

    // Update or create nutrition score record
    const { data: existingScore } = await supabaseClient
      .from('nutrition_scores')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', targetDate)
      .single();

    const scoreData = {
      user_id: user.id,
      date: targetDate,
      daily_score: dailyScore,
      calories_consumed: totalActualCalories,
      protein_grams: totalActualProtein,
      carbs_grams: totalActualCarbs,
      fat_grams: totalActualFat,
      meals_logged: mealsLogged,
      planned_calories: totalPlannedCalories,
      planned_protein_grams: totalPlannedProtein,
      planned_carbs_grams: totalPlannedCarbs,
      planned_fat_grams: totalPlannedFat,
      breakfast_score: mealScores.breakfast || null,
      lunch_score: mealScores.lunch || null,
      dinner_score: mealScores.dinner || null,
    };

    if (existingScore) {
      await supabaseClient
        .from('nutrition_scores')
        .update(scoreData)
        .eq('id', existingScore.id);
    } else {
      await supabaseClient
        .from('nutrition_scores')
        .insert(scoreData);
    }

    console.log(`Calculated nutrition score: ${dailyScore} for ${targetDate}`);

    return new Response(JSON.stringify({ 
      success: true,
      dailyScore,
      mealScores,
      actual: {
        calories: totalActualCalories,
        protein: totalActualProtein,
        carbs: totalActualCarbs,
        fat: totalActualFat
      },
      planned: {
        calories: totalPlannedCalories,
        protein: totalPlannedProtein,
        carbs: totalPlannedCarbs,
        fat: totalPlannedFat
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error calculating nutrition score:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});