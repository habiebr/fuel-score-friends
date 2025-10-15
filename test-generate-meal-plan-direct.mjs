// Test generate-meal-plan directly with useAI=false
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testGenerateMealPlan() {
  const today = '2025-10-13';

  console.log('🧪 Testing generate-meal-plan function directly...\n');

  // Delete existing meal plan
  console.log('🗑️  Deleting existing meal plan...');
  await supabase
    .from('daily_meal_plans')
    .delete()
    .eq('user_id', '8c2006e2-5512-4865-ba05-618cf2161ec1')
    .eq('date', today);
  console.log('✅ Deleted\n');

  // Call generate-meal-plan
  console.log('🔧 Calling generate-meal-plan...');
  const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
    body: { 
      date: today,
      useAI: false  // Use templates (should apply scaling)
    }
  });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Response:', JSON.stringify(data, null, 2));

  // Check the stored meal plan
  console.log('\n📊 Checking stored meal plan...');
  const { data: plans } = await supabase
    .from('daily_meal_plans')
    .select('*')
    .eq('user_id', '8c2006e2-5512-4865-ba05-618cf2161ec1')
    .eq('date', today);

  if (plans && plans.length > 0) {
    const total = plans.reduce((sum, p) => sum + (p.recommended_calories || 0), 0);
    console.log(`   Total: ${total} kcal`);
    plans.forEach(p => {
      console.log(`   ${p.meal_type}: ${p.recommended_calories} kcal`);
    });
  }
}

testGenerateMealPlan().catch(console.error);
