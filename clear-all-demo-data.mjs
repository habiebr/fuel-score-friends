/**
 * Clear All Demo Data
 * 
 * Clears training activities, food logs, nutrition scores, meal plans, and wearable data
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const DEMO_USER_ID = 'cac8468f-6d30-4d6e-8dcc-382253748c55';

console.log('🗑️  Clearing ALL demo account data...\n');

// Delete training activities
const { error: deleteActivitiesError } = await supabase
  .from('training_activities')
  .delete()
  .eq('user_id', DEMO_USER_ID);

if (deleteActivitiesError) {
  console.error('❌ Error deleting training activities:', deleteActivitiesError.message);
} else {
  console.log('✅ Training activities deleted');
}

// Delete food logs
const { error: deleteFoodError } = await supabase
  .from('food_logs')
  .delete()
  .eq('user_id', DEMO_USER_ID);

if (deleteFoodError) {
  console.error('❌ Error deleting food logs:', deleteFoodError.message);
} else {
  console.log('✅ Food logs deleted');
}

// Delete nutrition scores
const { error: deleteScoresError } = await supabase
  .from('nutrition_scores')
  .delete()
  .eq('user_id', DEMO_USER_ID);

if (deleteScoresError) {
  console.error('❌ Error deleting nutrition scores:', deleteScoresError.message);
} else {
  console.log('✅ Nutrition scores deleted');
}

// Delete meal plans
const { error: deleteMealPlansError } = await supabase
  .from('daily_meal_plans')
  .delete()
  .eq('user_id', DEMO_USER_ID);

if (deleteMealPlansError) {
  console.error('❌ Error deleting meal plans:', deleteMealPlansError.message);
} else {
  console.log('✅ Meal plans deleted');
}

// Delete wearable data
const { error: deleteWearableError } = await supabase
  .from('wearable_data')
  .delete()
  .eq('user_id', DEMO_USER_ID);

if (deleteWearableError) {
  console.error('❌ Error deleting wearable data:', deleteWearableError.message);
} else {
  console.log('✅ Wearable data deleted');
}

console.log('\n✅ All demo data cleared!');
console.log('📊 Ready to repopulate with new date range (Mon Oct 13 - Sun Oct 19)');
