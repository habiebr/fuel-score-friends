// Check Muhammad Habieb's score
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHabiebScore() {
  console.log('🔍 Looking for Muhammad Habieb...\n');

  // Find user
  const { data: users, error: userError } = await supabase
    .from('profiles')
    .select('user_id, email, full_name, weight_kg, height_cm, age, sex')
    .or('full_name.ilike.%habieb%,email.ilike.%habieb%')
    .limit(5);

  if (userError) {
    console.error('Error finding user:', userError);
    return;
  }

  if (!users || users.length === 0) {
    console.log('❌ No users found with name "habieb"');
    return;
  }

  console.log('Found users:');
  users.forEach((u, i) => {
    console.log(`${i + 1}. ${u.full_name || 'No name'} (${u.email})`);
    console.log(`   ID: ${u.user_id}`);
    console.log(`   Body: ${u.weight_kg}kg, ${u.height_cm}cm, ${u.age}yo, ${u.sex}`);
  });

  const user = users[0];
  const userId = user.user_id;
  const today = new Date().toISOString().split('T')[0];

  console.log(`\n📊 Checking score for ${user.full_name} on ${today}...\n`);

  // Check nutrition scores
  const { data: scores, error: scoreError } = await supabase
    .from('nutrition_scores')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (scoreError) {
    console.error('Error fetching score:', scoreError);
  }

  if (scores) {
    console.log('💯 CACHED SCORE:', scores.daily_score);
    console.log('   Calories consumed:', scores.calories_consumed);
    console.log('   Meals logged:', scores.meals_logged);
    console.log('   Updated at:', scores.updated_at);
  } else {
    console.log('❌ No cached score found');
  }

  // Check meal plans
  const { data: mealPlans, error: planError } = await supabase
    .from('daily_meal_plans')
    .select('meal_type, recommended_calories, recommended_protein_grams, recommended_carbs_grams, recommended_fat_grams')
    .eq('user_id', userId)
    .eq('date', today);

  if (planError) {
    console.error('Error fetching meal plans:', planError);
  }

  console.log('\n🍽️  MEAL PLANS:');
  if (mealPlans && mealPlans.length > 0) {
    const totalCals = mealPlans.reduce((sum, m) => sum + (m.recommended_calories || 0), 0);
    console.log(`   Total target: ${totalCals} kcal`);
    mealPlans.forEach(m => {
      console.log(`   ${m.meal_type}: ${m.recommended_calories} kcal (P:${m.recommended_protein_grams}g C:${m.recommended_carbs_grams}g F:${m.recommended_fat_grams}g)`);
    });
  } else {
    console.log('   ❌ No meal plans found');
  }

  // Check food logs
  const { data: foodLogs, error: foodError } = await supabase
    .from('food_logs')
    .select('meal_type, food_name, calories, protein_grams, carbs_grams, fat_grams, logged_at')
    .eq('user_id', userId)
    .gte('logged_at', `${today}T00:00:00`)
    .lt('logged_at', `${today}T23:59:59`);

  if (foodError) {
    console.error('Error fetching food logs:', foodError);
  }

  console.log('\n🍴 FOOD LOGGED:');
  if (foodLogs && foodLogs.length > 0) {
    const totalCals = foodLogs.reduce((sum, f) => sum + (f.calories || 0), 0);
    const totalProtein = foodLogs.reduce((sum, f) => sum + (f.protein_grams || 0), 0);
    const totalCarbs = foodLogs.reduce((sum, f) => sum + (f.carbs_grams || 0), 0);
    const totalFat = foodLogs.reduce((sum, f) => sum + (f.fat_grams || 0), 0);
    
    console.log(`   Total consumed: ${totalCals} kcal (P:${totalProtein}g C:${totalCarbs}g F:${totalFat}g)`);
    console.log(`   Meals logged: ${foodLogs.length}`);
    
    foodLogs.forEach(f => {
      console.log(`   - ${f.meal_type}: ${f.food_name} (${f.calories} kcal)`);
    });
  } else {
    console.log('   ❌ No food logged today');
  }

  // Calculate expected score
  console.log('\n🧮 SCORE ANALYSIS:');
  
  const hasBodyMetrics = user.weight_kg && user.height_cm && user.age;
  console.log(`   Has body metrics: ${hasBodyMetrics ? 'YES ✅' : 'NO ❌'}`);
  
  const hasMealPlan = mealPlans && mealPlans.length > 0;
  console.log(`   Has meal plan: ${hasMealPlan ? 'YES ✅' : 'NO ❌'}`);
  
  const hasFoodLogs = foodLogs && foodLogs.length > 0;
  console.log(`   Has food logs: ${hasFoodLogs ? 'YES ✅' : 'NO ❌'}`);

  if (!hasBodyMetrics) {
    console.log('\n⚠️  ISSUE: Missing body metrics → Score should be 0');
  } else if (!hasMealPlan && !hasFoodLogs) {
    console.log('\n⚠️  ISSUE: No meal plan and no food logged → Score should be 0-20');
  } else if (hasMealPlan && !hasFoodLogs) {
    console.log('\n⚠️  ISSUE: Has meal plan but no food logged → Score should be 0-20');
  } else if (hasFoodLogs) {
    const consumed = foodLogs.reduce((sum, f) => sum + (f.calories || 0), 0);
    const target = mealPlans ? mealPlans.reduce((sum, m) => sum + (m.recommended_calories || 0), 0) : 0;
    
    if (target > 0) {
      const errorPct = Math.abs(consumed - target) / target * 100;
      console.log(`\n📈 Adherence: ${consumed}/${target} kcal (${errorPct.toFixed(1)}% error)`);
      
      if (errorPct <= 5) console.log('   Expected score: 90-100 (excellent)');
      else if (errorPct <= 10) console.log('   Expected score: 60-80 (good)');
      else if (errorPct <= 20) console.log('   Expected score: 20-60 (fair)');
      else console.log('   Expected score: 0-20 (poor)');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`CURRENT SCORE: ${scores?.daily_score || 'Not calculated'}`);
  console.log('='.repeat(60));
}

checkHabiebScore().catch(console.error);
