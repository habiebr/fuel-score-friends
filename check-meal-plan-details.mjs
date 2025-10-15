// Check meal plan details for Muhammad Habieb on Oct 13
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMealPlanDetails() {
  const userId = '8c2006e2-5512-4865-ba05-618cf2161ec1';
  const today = '2025-10-13';

  console.log(`🍽️  Meal Plan Details for ${today}:\n`);

  const { data: plans } = await supabase
    .from('daily_meal_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .order('meal_type');

  if (!plans || plans.length === 0) {
    console.log('❌ No meal plans found');
    return;
  }

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  plans.forEach(plan => {
    console.log(`\n📋 ${plan.meal_type.toUpperCase()}`);
    console.log(`   Calories: ${plan.kcal || plan.total_kcal || 'N/A'} kcal`);
    console.log(`   Protein: ${plan.protein_g}g`);
    console.log(`   Carbs: ${plan.cho_g}g`);
    console.log(`   Fat: ${plan.fat_g}g`);
    
    if (plan.suggestions && Array.isArray(plan.suggestions)) {
      console.log(`   Suggestions (${plan.suggestions.length}):`);
      plan.suggestions.forEach((s, i) => {
        console.log(`     ${i+1}. ${s.name} - ${s.kcal} kcal`);
      });
    }

    totalCalories += plan.kcal || 0;
    totalProtein += plan.protein_g || 0;
    totalCarbs += plan.cho_g || 0;
    totalFat += plan.fat_g || 0;
  });

  console.log('\n' + '='.repeat(50));
  console.log(`📊 DAILY TOTAL:`);
  console.log(`   Calories: ${totalCalories} kcal`);
  console.log(`   Protein: ${totalProtein}g`);
  console.log(`   Carbs: ${totalCarbs}g`);
  console.log(`   Fat: ${totalFat}g`);
  console.log('='.repeat(50));
}

checkMealPlanDetails().catch(console.error);
