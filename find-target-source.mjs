// Check all possible sources of the 2580 kcal target
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findTargetSource() {
  const habiebId = '8c2006e2-5512-4865-ba05-618cf2161ec1';
  const today = '2025-10-13';

  console.log('🔍 Finding source of 2580 kcal target...\n');

  // Check profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', habiebId)
    .single();

  console.log('👤 Profile Data:');
  console.log(`   Weight: ${profile.weight_kg}kg`);
  console.log(`   Height: ${profile.height_cm}cm`);
  console.log(`   Age: ${profile.age}`);
  console.log(`   Sex: ${profile.sex}`);
  console.log(`   Activity level: ${profile.activity_level}`);
  console.log(`   Goal: ${profile.goal_type}`);

  // Calculate BMR and TDEE manually
  const weight = profile.weight_kg;
  const height = profile.height_cm;
  const age = profile.age;
  const sex = profile.sex;

  // Mifflin-St Jeor equation
  let bmr;
  if (sex === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  console.log(`\n📐 Science Layer Calculation:`);
  console.log(`   BMR (Mifflin-St Jeor): ${bmr.toFixed(0)} kcal`);

  // Activity multipliers
  const multipliers = {
    'rest': 1.4,
    'easy': 1.6,
    'moderate': 1.8,
    'long': 2.0
  };

  console.log('\n📊 TDEE by training load:');
  Object.entries(multipliers).forEach(([load, mult]) => {
    const tdee = bmr * mult;
    console.log(`   ${load.padEnd(10)}: ${tdee.toFixed(0)} kcal (BMR × ${mult})`);
  });

  // Check if 2580 matches any calculation
  const restTDEE = bmr * 1.4;
  const easyTDEE = bmr * 1.6;
  const moderateTDEE = bmr * 1.8;
  const longTDEE = bmr * 2.0;

  console.log('\n🎯 Trying to match 2580:');
  console.log(`   2580 / BMR = ${(2580 / bmr).toFixed(2)} (activity multiplier)`);

  // Check nutrition_scores table for planned calories
  const { data: score } = await supabase
    .from('nutrition_scores')
    .select('*')
    .eq('user_id', habiebId)
    .eq('date', today)
    .maybeSingle();

  if (score) {
    console.log('\n📈 nutrition_scores table:');
    console.log(`   planned_calories: ${score.planned_calories} kcal`);
  }

  // Check if there's a manual override or different calculation
  console.log('\n🔍 Possible explanations for 2580:');
  
  if (Math.abs(moderateTDEE - 2580) < 50) {
    console.log(`   ✅ Matches MODERATE TDEE: ${moderateTDEE.toFixed(0)} kcal`);
  }
  
  if (Math.abs(restTDEE + 320 - 2580) < 10) {
    console.log(`   ✅ Matches REST TDEE + 320 activity: ${(restTDEE + 320).toFixed(0)} kcal`);
  }

  // Parse activity_level if it's JSON
  if (profile.activity_level) {
    try {
      const activityData = JSON.parse(profile.activity_level);
      console.log('\n📅 Activity Schedule:');
      if (Array.isArray(activityData)) {
        const sunday = activityData.find(d => d.day === 'Sunday');
        if (sunday) {
          console.log(`   Sunday activities:`, sunday.activities);
          const totalCalories = (sunday.activities || []).reduce(
            (sum, a) => sum + (a.estimated_calories || 0), 
            0
          );
          console.log(`   Estimated calories: ${totalCalories} kcal`);
          console.log(`   Meal plan + activity: ${2260 + totalCalories} kcal`);
        }
      }
    } catch (e) {
      console.log('   (not JSON format)');
    }
  }
}

findTargetSource().catch(console.error);
