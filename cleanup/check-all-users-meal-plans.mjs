// Check meal plan generation status for all users
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllUsersMealPlans() {
  const today = '2025-10-13';

  console.log(`🔍 Checking meal plan status for all users on ${today}...\n`);

  // Get all users with profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name, weight_kg, height_cm, age, sex')
    .not('weight_kg', 'is', null)
    .not('height_cm', 'is', null)
    .order('full_name');

  console.log(`Found ${profiles?.length || 0} users with complete profiles\n`);

  const results = [];

  for (const profile of profiles || []) {
    // Check meal plans for today
    const { data: mealPlans } = await supabase
      .from('daily_meal_plans')
      .select('meal_type, recommended_calories')
      .eq('user_id', profile.user_id)
      .eq('date', today);

    const hasMealPlan = mealPlans && mealPlans.length > 0;
    const totalCalories = (mealPlans || []).reduce((sum, p) => sum + (p.recommended_calories || 0), 0);

    // Check food logs for today
    const { data: foodLogs } = await supabase
      .from('food_logs')
      .select('calories')
      .eq('user_id', profile.user_id)
      .gte('logged_at', `${today}T00:00:00`)
      .lte('logged_at', `${today}T23:59:59`);

    const hasFood = foodLogs && foodLogs.length > 0;
    const totalFood = (foodLogs || []).reduce((sum, f) => sum + (f.calories || 0), 0);

    // Check cached score
    const { data: cachedScore } = await supabase
      .from('nutrition_scores')
      .select('total_score')
      .eq('user_id', profile.user_id)
      .eq('date', today)
      .maybeSingle();

    results.push({
      name: profile.full_name || 'Unknown',
      userId: profile.user_id,
      hasMealPlan,
      mealPlanCalories: totalCalories,
      mealCount: mealPlans?.length || 0,
      hasFood,
      foodCalories: totalFood,
      foodCount: foodLogs?.length || 0,
      score: cachedScore?.total_score || null,
      profile: {
        weight: profile.weight_kg,
        height: profile.height_cm,
        age: profile.age,
        sex: profile.sex
      }
    });
  }

  // Sort by meal plan status (no plan first)
  results.sort((a, b) => {
    if (a.hasMealPlan === b.hasMealPlan) return 0;
    return a.hasMealPlan ? 1 : -1;
  });

  console.log('=' .repeat(100));
  console.log('USER MEAL PLAN STATUS'.padEnd(50) + 'FOOD LOGGED'.padEnd(30) + 'SCORE');
  console.log('=' .repeat(100));

  results.forEach(r => {
    const nameCol = (r.name || 'Unknown').substring(0, 25).padEnd(25);
    const planStatus = r.hasMealPlan 
      ? `✅ ${r.mealCount} meals (${r.mealPlanCalories} kcal)`.padEnd(35)
      : '❌ NO MEAL PLAN'.padEnd(35);
    const foodStatus = r.hasFood 
      ? `${r.foodCount} items (${r.foodCalories} kcal)`.padEnd(30)
      : 'No food logged'.padEnd(30);
    const scoreStatus = r.score !== null ? `${r.score}/100` : 'N/A';

    console.log(`${nameCol}${planStatus}${foodStatus}${scoreStatus}`);
  });

  console.log('=' .repeat(100));

  // Summary
  const withMealPlan = results.filter(r => r.hasMealPlan).length;
  const withoutMealPlan = results.filter(r => !r.hasMealPlan).length;
  const withFood = results.filter(r => r.hasFood).length;
  const withScore = results.filter(r => r.score !== null).length;

  console.log('\n📊 SUMMARY:');
  console.log(`   Total users: ${results.length}`);
  console.log(`   ✅ With meal plan: ${withMealPlan}`);
  console.log(`   ❌ Without meal plan: ${withoutMealPlan}`);
  console.log(`   🍽️  With food logged: ${withFood}`);
  console.log(`   📈 With score: ${withScore}`);

  if (withoutMealPlan > 0) {
    console.log('\n⚠️  USERS WITHOUT MEAL PLAN:');
    results.filter(r => !r.hasMealPlan).forEach(r => {
      console.log(`   - ${r.name} (${r.profile.weight}kg, ${r.profile.height}cm, ${r.profile.age}yo, ${r.profile.sex})`);
    });
  }
}

checkAllUsersMealPlans().catch(console.error);
