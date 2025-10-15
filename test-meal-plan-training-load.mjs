// Test the updated meal plan generation with training load detection
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMealPlanGeneration() {
  const habiebId = '8c2006e2-5512-4865-ba05-618cf2161ec1';
  const today = '2025-10-13';

  console.log('🧪 Testing updated meal plan generation...\n');

  // 1. Delete existing meal plan for today
  console.log('🗑️  Deleting existing meal plan...');
  const { error: deleteError } = await supabase
    .from('daily_meal_plans')
    .delete()
    .eq('user_id', habiebId)
    .eq('date', today);

  if (deleteError) {
    console.error('Error deleting:', deleteError);
    return;
  }
  console.log('✅ Deleted old meal plan\n');

  // 2. Verify planned training exists
  console.log('📅 Checking planned training...');
  const { data: plannedActivities } = await supabase
    .from('training_activities')
    .select('*')
    .eq('user_id', habiebId)
    .eq('date', today);

  if (plannedActivities && plannedActivities.length > 0) {
    console.log('✅ Planned training found:');
    plannedActivities.forEach(act => {
      console.log(`   - ${act.activity_type}: ${act.duration_minutes}min, ${act.distance_km}km, ${act.intensity}`);
    });

    const totalDuration = plannedActivities.reduce((sum, act) => sum + (act.duration_minutes || 0), 0);
    const totalDistance = plannedActivities.reduce((sum, act) => sum + (act.distance_km || 0), 0);
    
    let expectedLoad = 'rest';
    if (totalDuration < 45 && totalDistance < 8) {
      expectedLoad = 'easy';
    } else if (totalDuration >= 45 || totalDistance >= 8) {
      expectedLoad = 'moderate';
    }
    
    console.log(`   → Expected training load: ${expectedLoad.toUpperCase()}\n`);
  } else {
    console.log('❌ No planned training found\n');
  }

  // 3. Trigger meal plan generation
  console.log('🔧 Triggering meal plan generation...');
  const { data, error } = await supabase.functions.invoke('daily-meal-generation', {
    body: { 
      targetDate: today,
      forceRegenerate: true 
    }
  });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Generation response:', data);

  // 4. Check the new meal plan
  console.log('\n📊 Checking new meal plan...');
  const { data: newPlans } = await supabase
    .from('daily_meal_plans')
    .select('meal_type, recommended_calories, recommended_protein_grams, recommended_carbs_grams, recommended_fat_grams')
    .eq('user_id', habiebId)
    .eq('date', today);

  if (!newPlans || newPlans.length === 0) {
    console.log('❌ No meal plan generated!');
    return;
  }

  const totalCalories = newPlans.reduce((sum, p) => sum + (p.recommended_calories || 0), 0);
  const totalProtein = newPlans.reduce((sum, p) => sum + (p.recommended_protein_grams || 0), 0);
  const totalCarbs = newPlans.reduce((sum, p) => sum + (p.recommended_carbs_grams || 0), 0);
  const totalFat = newPlans.reduce((sum, p) => sum + (p.recommended_fat_grams || 0), 0);

  console.log(`✅ Generated ${newPlans.length} meals:\n`);
  
  newPlans.forEach(plan => {
    console.log(`   ${plan.meal_type.padEnd(10)}: ${plan.recommended_calories} kcal (P:${plan.recommended_protein_grams}g C:${plan.recommended_carbs_grams}g F:${plan.recommended_fat_grams}g)`);
  });

  console.log('\n' + '='.repeat(60));
  console.log(`📈 TOTAL: ${totalCalories} kcal (P:${totalProtein}g C:${totalCarbs}g F:${totalFat}g)`);
  console.log('='.repeat(60));

  // 5. Compare with expected
  console.log('\n🎯 VERIFICATION:');
  console.log(`   Expected (EASY load): 2580 kcal (BMR 1613 × 1.6)`);
  console.log(`   Generated: ${totalCalories} kcal`);
  
  if (Math.abs(totalCalories - 2580) < 50) {
    console.log('   ✅ MATCHES! Meal plan now uses correct training load!');
  } else if (Math.abs(totalCalories - 2260) < 50) {
    console.log('   ❌ STILL WRONG - using REST load instead of EASY');
  } else {
    console.log(`   ⚠️  Different value: ${totalCalories} kcal`);
  }
}

testMealPlanGeneration().catch(console.error);
