// Check Muhammad Habieb's activity and calorie calculation
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkActivityCalories() {
  const habiebId = '8c2006e2-5512-4865-ba05-618cf2161ec1';
  const today = '2025-10-13';

  console.log('🏃 Checking activity calories for Muhammad Habieb...\n');

  // Check Google Fit data
  const { data: fitData, error: fitError } = await supabase
    .from('google_fit_data')
    .select('*')
    .eq('user_id', habiebId)
    .eq('date', today)
    .maybeSingle();

  if (fitError) {
    console.log('❌ Error fetching Google Fit data:', fitError);
  } else if (!fitData) {
    console.log('❌ No Google Fit data for today');
  } else {
    console.log('✅ Google Fit Data:');
    console.log(`   Calories burned: ${fitData.calories_burned} kcal`);
    console.log(`   Steps: ${fitData.steps}`);
    console.log(`   Active minutes: ${fitData.active_minutes}`);
    console.log(`   Distance: ${fitData.distance_km} km`);
    console.log(`   Heart rate avg: ${fitData.heart_rate_avg}`);
  }

  // Check meal plan calories
  const { data: mealPlans } = await supabase
    .from('daily_meal_plans')
    .select('meal_type, recommended_calories')
    .eq('user_id', habiebId)
    .eq('date', today);

  const baseMealPlanCalories = (mealPlans || []).reduce(
    (sum, p) => sum + (p.recommended_calories || 0), 
    0
  );

  console.log('\n🍽️  Meal Plan:');
  console.log(`   Base calories: ${baseMealPlanCalories} kcal`);
  
  const activityCalories = fitData?.calories_burned || 0;
  const totalTargetCalories = baseMealPlanCalories + activityCalories;

  console.log('\n📊 CALORIE CALCULATION:');
  console.log(`   Base meal plan: ${baseMealPlanCalories} kcal`);
  console.log(`   + Activity burn: ${activityCalories} kcal`);
  console.log(`   = Total target: ${totalTargetCalories} kcal`);

  if (totalTargetCalories === 2580) {
    console.log('\n✅ MATCHES! Dashboard shows 2580 kcal because:');
    console.log(`   ${baseMealPlanCalories} (meal plan) + ${activityCalories} (activity) = 2580 kcal`);
  } else {
    console.log(`\n⚠️  Expected 2580 but calculated ${totalTargetCalories}`);
  }

  // Check training schedule
  const { data: training } = await supabase
    .from('training_schedule')
    .select('*')
    .eq('user_id', habiebId)
    .eq('date', today)
    .maybeSingle();

  if (training) {
    console.log('\n🏃 Training Schedule:');
    console.log(`   Type: ${training.type}`);
    console.log(`   Training load: ${training.training_load}`);
    console.log(`   Duration: ${training.duration_minutes} min`);
    console.log(`   Distance: ${training.distance_km} km`);
  } else {
    console.log('\n🏃 Training Schedule: No training scheduled (REST day)');
  }
}

checkActivityCalories().catch(console.error);
