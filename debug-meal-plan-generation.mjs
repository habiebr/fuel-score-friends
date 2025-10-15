// Debug why meal plan wasn't created for Muhammad Habieb on Oct 13
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugMealPlanGeneration() {
  const userId = '8c2006e2-5512-4865-ba05-618cf2161ec1';
  const today = '2025-10-13';

  console.log(`🔍 Debugging meal plan generation for ${today}...\n`);

  // 1. Check user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.log('❌ Profile not found or error:', profileError);
    console.log('   Trying with user_profiles table...\n');
    
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (userProfile) {
      console.log('👤 User Profile (from user_profiles):');
      console.log(`   Weight: ${userProfile.weight}kg`);
      console.log(`   Height: ${userProfile.height}cm`);
      console.log(`   Age: ${userProfile.age}`);
      console.log(`   Gender: ${userProfile.gender}`);
      console.log(`   Activity Level: ${userProfile.activity_level || 'not set'}`);
      console.log(`   Goal: ${userProfile.goal || 'not set'}\n`);
    }
  } else {
    console.log('👤 User Profile:');
    console.log(`   Weight: ${profile.weight}kg`);
    console.log(`   Height: ${profile.height}cm`);
    console.log(`   Age: ${profile.age}`);
    console.log(`   Gender: ${profile.gender}`);
    console.log(`   Activity Level: ${profile.activity_level || 'not set'}`);
    console.log(`   Goal: ${profile.goal || 'not set'}\n`);
  }

  // 2. Check if meal plan exists for today
  const { data: existingPlans } = await supabase
    .from('daily_meal_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today);

  console.log(`📅 Existing meal plans for ${today}: ${existingPlans?.length || 0}`);
  if (existingPlans && existingPlans.length > 0) {
    console.log('   Plans found:');
    existingPlans.forEach(p => console.log(`   - ${p.meal_type}: ${p.total_kcal} kcal`));
  }
  console.log();

  // 3. Check when daily-meal-generation edge function last ran
  console.log('🤖 Checking daily-meal-generation edge function...');
  console.log('   This function should run every morning to generate meal plans.\n');

  // 4. Check training schedule for today
  const { data: training } = await supabase
    .from('training_schedule')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  console.log('🏃 Training Schedule:');
  if (training) {
    console.log(`   Type: ${training.type}`);
    console.log(`   Training Load: ${training.training_load || 'rest'}`);
  } else {
    console.log('   No training scheduled (REST day)');
  }
  console.log();

  // 5. Try to generate meal plan NOW
  console.log('🔧 Attempting to generate meal plan NOW...\n');
  
  try {
    const { data, error } = await supabase.functions.invoke('daily-meal-generation', {
      body: { 
        targetDate: today,
        forceRegenerate: true 
      }
    });

    if (error) {
      console.error('❌ Error from daily-meal-generation:', error);
    } else {
      console.log('✅ daily-meal-generation response:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('❌ Failed to invoke daily-meal-generation:', err.message);
  }

  // 6. Check meal plans again after generation
  console.log('\n📋 Re-checking meal plans after generation attempt...');
  const { data: newPlans } = await supabase
    .from('daily_meal_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today);

  if (newPlans && newPlans.length > 0) {
    console.log(`✅ Found ${newPlans.length} meal plans!`);
    newPlans.forEach(p => console.log(`   - ${p.meal_type}: ${p.total_kcal} kcal`));
  } else {
    console.log('❌ Still no meal plans found');
  }
}

debugMealPlanGeneration().catch(console.error);
