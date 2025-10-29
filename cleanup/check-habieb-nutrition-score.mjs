// Check Muhammad Habieb's score in nutrition_scores table
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHabiebScore() {
  const habiebId = '8c2006e2-5512-4865-ba05-618cf2161ec1';
  const today = '2025-10-13';

  console.log('🔍 Checking Muhammad Habieb\'s score in nutrition_scores...\n');

  const { data: score, error } = await supabase
    .from('nutrition_scores')
    .select('*')
    .eq('user_id', habiebId)
    .eq('date', today)
    .maybeSingle();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!score) {
    console.log('❌ No score found for Muhammad Habieb on', today);
    console.log('\n🔧 This means the scoring hasn\'t run yet in production.');
    console.log('   The app should calculate it on first page load.');
    return;
  }

  console.log('📊 Muhammad Habieb\'s Score Record:');
  console.log(JSON.stringify(score, null, 2));

  console.log('\n📈 Score Breakdown:');
  console.log(`   Daily Score: ${score.daily_score}/100`);
  console.log(`   Calories: ${score.calories_consumed} / ${score.planned_calories} kcal`);
  console.log(`   Protein: ${score.protein_grams} / ${score.planned_protein_grams}g`);
  console.log(`   Carbs: ${score.carbs_grams} / ${score.planned_carbs_grams}g`);
  console.log(`   Fat: ${score.fat_grams} / ${score.planned_fat_grams}g`);
  console.log(`   Meals logged: ${score.meals_logged}`);

  // Check if this is the old buggy score
  if (score.daily_score === 92 && score.calories_consumed === 0) {
    console.log('\n⚠️  WARNING: This is the OLD BUGGY SCORE (92 baseline)!');
    console.log('   This score was calculated BEFORE we deployed the fix.');
    console.log('   The user needs to refresh or wait for the next calculation.');
  }

  // Delete the old buggy score
  console.log('\n🗑️  Deleting old buggy score...');
  const { error: deleteError } = await supabase
    .from('nutrition_scores')
    .delete()
    .eq('user_id', habiebId)
    .eq('date', today);

  if (deleteError) {
    console.error('❌ Error deleting:', deleteError);
  } else {
    console.log('✅ Old score deleted! App will recalculate on next page load.');
  }
}

checkHabiebScore().catch(console.error);
