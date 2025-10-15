/**
 * Update Demo Profile - Melbourne Timezone
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const DEMO_USER_ID = 'cac8468f-6d30-4d6e-8dcc-382253748c55';

console.log('🌏 Updating demo profile to Melbourne timezone...\n');

const { data, error } = await supabase
  .from('profiles')
  .update({
    timezone: 'Australia/Melbourne',
    goal_name: 'Melbourne Marathon 2025',
  })
  .eq('user_id', DEMO_USER_ID)
  .select();

if (error) {
  console.error('❌ Error updating profile:', error.message);
} else {
  console.log('✅ Profile updated to Melbourne timezone!');
  console.log('   Timezone:', data[0].timezone);
  console.log('   Goal:', data[0].goal_name);
}
