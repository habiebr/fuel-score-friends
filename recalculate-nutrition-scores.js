#!/usr/bin/env node

/**
 * Script to recalculate nutrition scores for existing food logs
 * This is a one-time migration script to update all existing nutrition scores
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface FoodLog {
  id: string;
  user_id: string;
  food_name: string;
  meal_type: string;
  calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  logged_at: string;
}

interface MealPlan {
  id: string;
  user_id: string;
  date: string;
  meal_type: string;
  recommended_calories: number;
  recommended_protein_grams: number;
  recommended_carbs_grams: number;
  recommended_fat_grams: number;
  meal_score: number | null;
}

interface NutritionScore {
  id: string;
  user_id: string;
  date: string;
  daily_score: number;
  calories_consumed: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  meals_logged: number;
}

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
 * Get all unique user-date combinations that have food logs
 */
async function getUserDateCombinations(): Promise<Array<{ user_id: string; date: string }>> {
  console.log('📊 Fetching user-date combinations with food logs...');
  
  const { data, error } = await supabase
    .from('food_logs')
    .select('user_id, logged_at')
    .order('logged_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch food logs: ${error.message}`);
  }

  // Group by user and date
  const combinations = new Map<string, { user_id: string; date: string }>();
  
  data.forEach(log => {
    const date = log.logged_at.split('T')[0]; // Extract date part
    const key = `${log.user_id}-${date}`;
    combinations.set(key, { user_id: log.user_id, date });
  });

  return Array.from(combinations.values());
}

/**
 * Process a single user-date combination
 */
async function processUserDate(userId: string, date: string): Promise<void> {
  try {
    // Get food logs for this user and date
    const { data: foodLogs, error: logsError } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', `${date}T00:00:00`)
      .lt('logged_at', `${date}T23:59:59`);

    if (logsError) {
      console.error(`❌ Error fetching food logs for ${userId} on ${date}:`, logsError.message);
      return;
    }

    if (!foodLogs || foodLogs.length === 0) {
      console.log(`⚠️  No food logs found for ${userId} on ${date}`);
      return;
    }

    // Get meal plans for this user and date
    const { data: mealPlans, error: plansError } = await supabase
      .from('daily_meal_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date);

    if (plansError) {
      console.error(`❌ Error fetching meal plans for ${userId} on ${date}:`, plansError.message);
      return;
    }

    // Calculate totals
    const totalCalories = foodLogs.reduce((sum, log) => sum + (log.calories || 0), 0);
    const totalProtein = foodLogs.reduce((sum, log) => sum + (log.protein_grams || 0), 0);
    const totalCarbs = foodLogs.reduce((sum, log) => sum + (log.carbs_grams || 0), 0);
    const totalFat = foodLogs.reduce((sum, log) => sum + (log.fat_grams || 0), 0);

    const plannedCalories = mealPlans?.reduce((sum, plan) => sum + (plan.recommended_calories || 0), 0) || 0;
    const plannedProtein = mealPlans?.reduce((sum, plan) => sum + (plan.recommended_protein_grams || 0), 0) || 0;
    const plannedCarbs = mealPlans?.reduce((sum, plan) => sum + (plan.recommended_carbs_grams || 0), 0) || 0;
    const plannedFat = mealPlans?.reduce((sum, plan) => sum + (plan.recommended_fat_grams || 0), 0) || 0;

    // Calculate daily nutrition score
    const dailyScore = calculateNutritionScore(
      plannedCalories, plannedProtein, plannedCarbs, plannedFat,
      totalCalories, totalProtein, totalCarbs, totalFat
    );

    // Update meal-level scores
    if (mealPlans && mealPlans.length > 0) {
      for (const plan of mealPlans) {
        const mealLogs = foodLogs.filter(log => log.meal_type === plan.meal_type);
        
        if (mealLogs.length > 0) {
          const mealCalories = mealLogs.reduce((sum, log) => sum + (log.calories || 0), 0);
          const mealProtein = mealLogs.reduce((sum, log) => sum + (log.protein_grams || 0), 0);
          const mealCarbs = mealLogs.reduce((sum, log) => sum + (log.carbs_grams || 0), 0);
          const mealFat = mealLogs.reduce((sum, log) => sum + (log.fat_grams || 0), 0);

          const mealScore = calculateMealScore(
            plan.recommended_calories, plan.recommended_protein_grams, 
            plan.recommended_carbs_grams, plan.recommended_fat_grams,
            mealCalories, mealProtein, mealCarbs, mealFat
          );

          // Update meal plan score
          const { error: updateError } = await supabase
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
    const { error: scoreError } = await supabase
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
      console.error(`❌ Error updating nutrition score for ${userId} on ${date}:`, scoreError.message);
    } else {
      console.log(`✅ Updated nutrition score for ${userId} on ${date}: ${dailyScore}`);
    }

  } catch (error) {
    console.error(`❌ Error processing ${userId} on ${date}:`, error);
  }
}

/**
 * Main function to recalculate all nutrition scores
 */
async function recalculateNutritionScores(): Promise<void> {
  console.log('🚀 Starting nutrition score recalculation...\n');

  try {
    // Get all user-date combinations
    const combinations = await getUserDateCombinations();
    console.log(`📊 Found ${combinations.length} user-date combinations to process\n`);

    if (combinations.length === 0) {
      console.log('ℹ️  No food logs found. Nothing to recalculate.');
      return;
    }

    // Process each combination
    let processed = 0;
    let errors = 0;

    for (const { user_id, date } of combinations) {
      try {
        await processUserDate(user_id, date);
        processed++;
        
        // Progress indicator
        if (processed % 10 === 0) {
          console.log(`📈 Progress: ${processed}/${combinations.length} processed`);
        }
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        console.error(`❌ Error processing ${user_id} on ${date}:`, error);
        errors++;
      }
    }

    console.log('\n🎯 Recalculation complete!');
    console.log(`✅ Successfully processed: ${processed} combinations`);
    console.log(`❌ Errors encountered: ${errors} combinations`);
    
    if (errors === 0) {
      console.log('🎉 All nutrition scores have been successfully recalculated!');
    } else {
      console.log('⚠️  Some errors occurred. Check the logs above for details.');
    }

  } catch (error) {
    console.error('❌ Fatal error during recalculation:', error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  recalculateNutritionScores()
    .then(() => {
      console.log('\n✨ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}
