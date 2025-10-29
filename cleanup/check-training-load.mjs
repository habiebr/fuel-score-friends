// Check training activities to determine correct training load
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTrainingLoad() {
  const habiebId = '8c2006e2-5512-4865-ba05-618cf2161ec1';
  const today = '2025-10-13';

  console.log('🏃 Checking training load determination for Muhammad Habieb...\n');

  // 1. Check training_activities (planned training)
  const { data: plannedActivities, error: planError } = await supabase
    .from('training_activities')
    .select('*')
    .eq('user_id', habiebId)
    .eq('date', today);

  if (planError) {
    console.log('❌ Error fetching training_activities:', planError);
  } else if (!plannedActivities || plannedActivities.length === 0) {
    console.log('📅 training_activities: NO planned training for today');
  } else {
    console.log('📅 training_activities: FOUND planned training!');
    plannedActivities.forEach(act => {
      console.log(`   - ${act.activity_type}: ${act.duration_minutes}min, ${act.distance_km}km, ${act.intensity} intensity`);
    });

    const totalDuration = plannedActivities.reduce((sum, act) => sum + (act.duration_minutes || 0), 0);
    const totalDistance = plannedActivities.reduce((sum, act) => sum + (act.distance_km || 0), 0);
    const hasRest = plannedActivities.some(act => act.activity_type === 'rest');
    const hasHighIntensity = plannedActivities.some(act => act.intensity === 'high');

    console.log('\n📊 Planned Training Summary:');
    console.log(`   Total duration: ${totalDuration} min`);
    console.log(`   Total distance: ${totalDistance} km`);
    console.log(`   Has rest: ${hasRest}`);
    console.log(`   Has high intensity: ${hasHighIntensity}`);

    // Determine load from planned training
    let plannedLoad = 'rest';
    if (hasRest && plannedActivities.length === 1) {
      plannedLoad = 'rest';
    } else if (totalDistance >= 15) {
      plannedLoad = 'long';
    } else if (hasHighIntensity || (totalDuration >= 60 && totalDistance >= 10)) {
      plannedLoad = 'quality';
    } else if (totalDuration >= 45 || totalDistance >= 8) {
      plannedLoad = 'moderate';
    } else {
      plannedLoad = 'easy';
    }

    console.log(`   → Planned Load: ${plannedLoad.toUpperCase()}`);
  }

  // 2. Check Google Fit (actual activity)
  const { data: fitData } = await supabase
    .from('google_fit_data')
    .select('*')
    .eq('user_id', habiebId)
    .eq('date', today)
    .maybeSingle();

  console.log('\n🏃 Google Fit Data:');
  if (fitData) {
    console.log(`   Active minutes: ${fitData.active_minutes || 0}`);
    console.log(`   Distance: ${(fitData.distance_meters || 0) / 1000} km`);
    console.log(`   Calories burned: ${fitData.calories_burned || 0}`);

    const activeMinutes = fitData.active_minutes || 0;
    const distanceKm = (fitData.distance_meters || 0) / 1000;

    // Infer load from Google Fit
    let inferredLoad = 'rest';
    if (activeMinutes < 15 && distanceKm < 2) {
      inferredLoad = 'rest';
    } else if (activeMinutes < 45 || distanceKm < 8) {
      inferredLoad = 'easy';
    } else if (distanceKm >= 15) {
      inferredLoad = 'long';
    } else if (activeMinutes >= 60 && distanceKm >= 10) {
      inferredLoad = 'quality';
    } else {
      inferredLoad = 'moderate';
    }

    console.log(`   → Inferred Load: ${inferredLoad.toUpperCase()}`);
  } else {
    console.log('   No Google Fit data');
    console.log(`   → Inferred Load: REST (no activity)`);
  }

  // 3. Show TDEE calculations
  console.log('\n📐 TDEE Calculations (BMR: 1613 kcal):');
  const multipliers = {
    'rest': { mult: 1.4, tdee: 1613 * 1.4 },
    'easy': { mult: 1.6, tdee: 1613 * 1.6 },
    'moderate': { mult: 1.8, tdee: 1613 * 1.8 },
    'long': { mult: 2.0, tdee: 1613 * 2.0 },
    'quality': { mult: 2.1, tdee: 1613 * 2.1 }
  };

  Object.entries(multipliers).forEach(([load, calc]) => {
    const rounded = Math.round(calc.tdee / 10) * 10;
    console.log(`   ${load.padEnd(10)}: ${calc.tdee.toFixed(0)} → ${rounded} kcal (rounded)`);
  });

  console.log('\n🎯 CONCLUSION:');
  console.log('   Dashboard shows: 2580 kcal');
  console.log('   Meal plan has: 2260 kcal');
  console.log('');
  console.log('   If PLANNED training exists → Use planned load → Dashboard calculates TDEE');
  console.log('   If NO planned training → Infer from Google Fit → Dashboard calculates TDEE');
  console.log('   Meal plan generation → Uses REST by default (no training data at generation time)');
}

checkTrainingLoad().catch(console.error);
