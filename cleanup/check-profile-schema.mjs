import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Get the profile to see what columns exist
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .limit(1);

if (error) {
  console.error('Error:', error);
} else {
  console.log('Profile columns:', data && data.length > 0 ? Object.keys(data[0]) : 'No profiles found');
  if (data && data.length > 0) {
    console.log('Sample data:', JSON.stringify(data[0], null, 2));
  }
}
