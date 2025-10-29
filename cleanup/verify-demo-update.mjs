import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDemoUpdate() {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .eq('full_name', 'Demo Runner')
    .single();
  
  if (!profile) {
    console.log('❌ Demo profile not found');
    return;
  }
  
  const userId = profile.user_id;
  console.log('\n📋 DEMO ACCOUNT VERIFICATION\n');
  console.log('User:', profile.full_name);
  console.log('Date:', today);
  console.log('---\n');
  
  // Check meal plans
  const { data: meals } = await supabase
    .from('daily_meal_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today);
  
  console.log('✅ Meal Plans:', meals?.length || 0);
  meals?.forEach(m => {
    console.log(`   ${m.meal_type}: ${m.recommended_calories}cal, ${m.recommended_protein_grams}g protein`);
  });
  
  // Check food logs
  const { data: foods } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', `${today}T00:00:00Z`);
  
  console.log('\n✅ Food Logs:', foods?.length || 0, 'entries');
  let totalCals = 0, totalPro = 0;
  foods?.forEach(f => {
    totalCals += f.calories;
    totalPro += f.protein_grams;
  });
  console.log(`   Total: ${Math.round(totalCals)}cal, ${Math.round(totalPro)}g protein`);
  
  // Check training
  const { data: training } = await supabase
    .from('google_fit_sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('start_time', `${today}T00:00:00Z`);
  
  console.log('\n✅ Training Sessions:', training?.length || 0);
  training?.forEach(t => {
    console.log(`   ${t.name} (${t.activity_type})`);
  });
  
  console.log('\n🎉 Demo account ready for screenshots!');
  console.log('📸 You can now login and capture the near-perfect score.\n');
}

verifyDemoUpdate().catch(console.error);
