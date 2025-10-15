// Check meal plans for Muhammad Habieb
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMealPlans() {
  const userId = '8c2006e2-5512-4865-ba05-618cf2161ec1';

  console.log('🔍 Checking ALL meal plans for Muhammad Habieb...\n');

  // Check daily_meal_plans
  const { data: dailyPlans, error: dailyError } = await supabase
    .from('daily_meal_plans')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (dailyError) {
    console.error('❌ Error fetching daily_meal_plans:', dailyError);
  } else {
    console.log(`📅 daily_meal_plans: ${dailyPlans?.length || 0} records`);
    if (dailyPlans && dailyPlans.length > 0) {
      console.log('\nMost recent:');
      dailyPlans.slice(0, 3).forEach(plan => {
        console.log(`  ${plan.date}: ${plan.meal_type} - ${plan.total_kcal} kcal`);
      });
    }
  }

  // Check meal_plans table
  const { data: mealPlans, error: mealError } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (mealError) {
    console.error('\n❌ Error fetching meal_plans:', mealError);
  } else {
    console.log(`\n🍽️  meal_plans: ${mealPlans?.length || 0} records`);
    if (mealPlans && mealPlans.length > 0) {
      console.log('\nMost recent:');
      mealPlans.slice(0, 3).forEach(plan => {
        console.log(`  ${plan.date}: ${plan.total_kcal} kcal (${plan.training_load || 'rest'})`);
      });
    }
  }
}

checkMealPlans().catch(console.error);
