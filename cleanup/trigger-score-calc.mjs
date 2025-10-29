// Manually trigger score calculation for Muhammad Habieb
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function triggerScoreCalculation() {
  const userId = '8c2006e2-5512-4865-ba05-618cf2161ec1';
  const today = '2025-10-13';

  console.log('🔄 Clearing cached score...\n');

  // Delete existing cached score
  const { error: deleteError } = await supabase
    .from('nutrition_scores_cache')
    .delete()
    .eq('user_id', userId)
    .eq('date', today);

  if (deleteError) {
    console.error('Error deleting cache:', deleteError);
  } else {
    console.log('✅ Cached score cleared');
  }

  console.log('\n📊 Now the app will recalculate score on next page load...');
  console.log('\nOR we can simulate the calculation here:\n');

  // Fetch meal plans
  const { data: mealPlans } = await supabase
    .from('daily_meal_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today);

  const totalTarget = (mealPlans || []).reduce((acc, plan) => ({
    calories: acc.calories + (plan.recommended_calories || 0),
    protein: acc.protein + (plan.recommended_protein_grams || 0),
    carbs: acc.carbs + (plan.recommended_carbs_grams || 0),
    fat: acc.fat + (plan.recommended_fat_grams || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  // Fetch food logs
  const { data: foodLogs, error: logsError } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', `${today}T00:00:00`)
    .lte('logged_at', `${today}T23:59:59`);

  if (logsError) {
    console.error('Error fetching food logs:', logsError);
  }
  console.log(`Found ${foodLogs?.length || 0} food log entries`);
  
  if (foodLogs && foodLogs.length > 0) {
    console.log('Sample food log columns:', Object.keys(foodLogs[0]));
    console.log('Sample food log:', foodLogs[0]);
  }

  const totalActual = (foodLogs || []).reduce((acc, log) => ({
    calories: acc.calories + (log.calories || 0),
    protein: acc.protein + (log.protein_grams || 0),
    carbs: acc.carbs + (log.carbs_grams || 0),
    fat: acc.fat + (log.fat_grams || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  console.log('🎯 TARGETS (from meal plan):');
  console.log(`   Calories: ${totalTarget.calories} kcal`);
  console.log(`   Protein: ${totalTarget.protein}g`);
  console.log(`   Carbs: ${totalTarget.carbs}g`);
  console.log(`   Fat: ${totalTarget.fat}g\n`);

  console.log('📝 ACTUAL (from food logs):');
  console.log(`   Calories: ${totalActual.calories} kcal`);
  console.log(`   Protein: ${totalActual.protein}g`);
  console.log(`   Carbs: ${totalActual.carbs}g`);
  console.log(`   Fat: ${totalActual.fat}g\n`);

  // Calculate adherence percentages
  const calorieAdherence = totalTarget.calories > 0 ? (totalActual.calories / totalTarget.calories * 100) : 0;
  const proteinAdherence = totalTarget.protein > 0 ? (totalActual.protein / totalTarget.protein * 100) : 0;
  const carbsAdherence = totalTarget.carbs > 0 ? (totalActual.carbs / totalTarget.carbs * 100) : 0;
  const fatAdherence = totalTarget.fat > 0 ? (totalActual.fat / totalTarget.fat * 100) : 0;

  console.log('📈 ADHERENCE:');
  console.log(`   Calories: ${calorieAdherence.toFixed(1)}%`);
  console.log(`   Protein: ${proteinAdherence.toFixed(1)}%`);
  console.log(`   Carbs: ${carbsAdherence.toFixed(1)}%`);
  console.log(`   Fat: ${fatAdherence.toFixed(1)}%\n`);

  // Estimate score (simplified - actual scoring is more complex)
  const avgAdherence = (calorieAdherence + proteinAdherence + carbsAdherence + fatAdherence) / 4;
  const estimatedScore = Math.max(0, Math.min(100, avgAdherence));

  console.log(`💯 ESTIMATED SCORE: ${estimatedScore.toFixed(0)}/100`);
  console.log('   (Simplified calculation - actual score considers meal structure, timing, etc.)\n');

  console.log('🔄 To see the real score, refresh the dashboard in the app!');
}

triggerScoreCalculation().catch(console.error);
