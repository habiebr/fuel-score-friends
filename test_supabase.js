// Test Supabase connection
import { supabase } from './src/integrations/supabase/client';

async function testConnection() {
  console.log('Testing Supabase connection...');
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    
    if (error) {
      console.error('Connection error:', error);
      return;
    }
    
    console.log('Connection successful!');
    console.log('Data:', data);
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testConnection();