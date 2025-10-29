// Check daily_meal_plans table schema
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMealPlansSchema() {
  console.log('🔍 Checking daily_meal_plans schema...\n');

  const { data, error } = await supabase
    .from('daily_meal_plans')
    .select('*')
    .limit(1);

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('✅ Sample record:');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('\n📋 Columns:', Object.keys(data[0]));
  } else {
    console.log('⚠️  Table is empty');
  }

  // Check Muhammad Habieb's record specifically
  console.log('\n🎯 Muhammad Habieb\'s meal plans for Oct 13:');
  const { data: habiebPlans } = await supabase
    .from('daily_meal_plans')
    .select('*')
    .eq('user_id', '8c2006e2-5512-4865-ba05-618cf2161ec1')
    .eq('date', '2025-10-13');

  if (habiebPlans && habiebPlans.length > 0) {
    habiebPlans.forEach(plan => {
      console.log(`\n${plan.meal_type}:`, {
        kcal: plan.kcal,
        total_kcal: plan.total_kcal,
        recommended_calories: plan.recommended_calories,
        protein_g: plan.protein_g,
        recommended_protein_grams: plan.recommended_protein_grams,
        suggestions: plan.suggestions || plan.meal_suggestions
      });
    });
  }
}

checkMealPlansSchema().catch(console.error);
