// Test Edge Function
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://eecdbddpzwedficnpenm.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable__mWdOr5zzrmUA4WUKXAEZg_dxlRjKP4';

async function testEdgeFunction() {
  console.log('Testing Edge Function call...');
  console.log(`URL: ${SUPABASE_URL}`);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/dashboard3-data`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error ${response.status}: ${errorText}`);
      return;
    }
    
    const data = await response.json();
    console.log('Edge function call successful!');
    console.log('Data:', data);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testEdgeFunction();