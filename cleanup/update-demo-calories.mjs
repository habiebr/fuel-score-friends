/**
 * Update Demo Account - More Realistic Calories
 * 
 * This script clears old food logs and nutrition scores,
 * then repopulates with more realistic calorie intake for a marathon runner.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const DEMO_USER_ID = 'cac8468f-6d30-4d6e-8dcc-382253748c55';

console.log('🔄 Updating demo account with realistic calorie intake...\n');

// Step 1: Delete old data
console.log('🗑️  Deleting old food logs and nutrition scores...');

const { error: deleteFoodError } = await supabase
  .from('food_logs')
  .delete()
  .eq('user_id', DEMO_USER_ID);

if (deleteFoodError) {
  console.error('❌ Error deleting food logs:', deleteFoodError.message);
} else {
  console.log('✅ Old food logs deleted');
}

const { error: deleteScoresError } = await supabase
  .from('nutrition_scores')
  .delete()
  .eq('user_id', DEMO_USER_ID);

if (deleteScoresError) {
  console.error('❌ Error deleting nutrition scores:', deleteScoresError.message);
} else {
  console.log('✅ Old nutrition scores deleted');
}

console.log('\n📊 Now run the populate command to add realistic data:');
console.log(`node create-demo-account.mjs populate ${DEMO_USER_ID}\n`);
