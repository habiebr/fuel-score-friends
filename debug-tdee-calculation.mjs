// Debug the actual TDEE calculation in the edge function
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTDEE() {
  const habiebId = '8c2006e2-5512-4865-ba05-618cf2161ec1';

  console.log('🔍 Debugging TDEE calculation discrepancy...\n');

  // Check the profile data that edge function uses
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, weight_kg, height_cm, age, sex')
    .eq('user_id', habiebId);

  if (!profiles || profiles.length === 0) {
    console.log('❌ No profile found in query used by edge function!');
    return;
  }

  const profile = profiles[0];
  console.log('👤 Profile data FROM EDGE FUNCTION QUERY:');
  console.log(`   weight_kg: ${profile.weight_kg}`);
  console.log(`   height_cm: ${profile.height_cm}`);
  console.log(`   age: ${profile.age}`);
  console.log(`   sex: ${profile.sex}`);

  // Calculate BMR manually
  const weightKg = profile.weight_kg || 70;
  const heightCm = profile.height_cm || 170;
  const age = profile.age || 30;
  const sex = profile.sex || 'male';
  const sexOffset = sex === 'male' ? 5 : -161;
  const bmr = Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset);

  console.log(`\n📐 BMR Calculation:`);
  console.log(`   10 × ${weightKg} + 6.25 × ${heightCm} - 5 × ${age} + ${sexOffset}`);
  console.log(`   = ${10 * weightKg} + ${6.25 * heightCm} - ${5 * age} + ${sexOffset}`);
  console.log(`   = ${bmr} kcal`);

  // Calculate TDEE for different loads
  console.log(`\n📊 TDEE Calculations:`);
  const loads = ['rest', 'easy', 'moderate', 'long', 'quality'];
  const factors = { rest: 1.4, easy: 1.6, moderate: 1.8, long: 2.0, quality: 2.1 };

  loads.forEach(load => {
    const factor = factors[load];
    const tdee = bmr * factor;
    const rounded = Math.round(tdee / 10) * 10;
    console.log(`   ${load.padEnd(10)}: ${bmr} × ${factor} = ${tdee.toFixed(0)} → ${rounded} kcal`);
  });

  console.log(`\n🎯 Expected for EASY load: ${Math.round(bmr * 1.6 / 10) * 10} kcal`);
  console.log(`   But meal plan shows: 2190 kcal`);
  console.log(`\n💡 2190 is NOT matching any standard multiplier!`);
  console.log(`   2190 / ${bmr} = ${(2190 / bmr).toFixed(2)} (unknown factor)`);
}

debugTDEE().catch(console.error);
