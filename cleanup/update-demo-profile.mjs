import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const userId = 'cac8468f-6d30-4d6e-8dcc-382253748c55';

console.log('📝 Updating demo profile...\n');

const { data, error } = await supabase
  .from('profiles')
  .update({
    full_name: 'Demo Runner',
    height: 175,
    weight: 68,
    height_cm: 175,
    weight_kg: 68,
    age: 32,
    sex: 'male',
    activity_level: JSON.stringify({
      monday: { type: 'Easy Run', duration: 45 },
      tuesday: { type: 'Tempo Run', duration: 60 },
      wednesday: { type: 'Rest', duration: 0 },
      thursday: { type: 'Intervals', duration: 50 },
      friday: { type: 'Easy Run', duration: 40 },
      saturday: { type: 'Long Run', duration: 120 },
      sunday: { type: 'Recovery Run', duration: 30 }
    }),
    fitness_goals: ['Marathon Sub-3:30', 'Improve Endurance', 'Lose Weight'],
    goal_type: 'full_marathon',
    goal_name: 'Jakarta Marathon 2025',
    fitness_level: 'intermediate',
    timezone: 'Asia/Jakarta',
    weekly_miles_target: 40,
  })
  .eq('user_id', userId)
  .select();

if (error) {
  console.error('❌ Error updating profile:', error);
} else {
  console.log('✅ Profile updated successfully!');
  console.log('\nProfile data:', JSON.stringify(data[0], null, 2));
}
