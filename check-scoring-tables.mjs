// Check scoring status for users with food logged
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkScoringTables() {
  const today = '2025-10-13';

  console.log('🔍 Checking scoring tables...\n');

  // Try nutrition_scores
  console.log('1️⃣  nutrition_scores table:');
  const { data: scores1, error: err1 } = await supabase
    .from('nutrition_scores')
    .select('*')
    .eq('date', today);

  if (err1) {
    console.log(`   ❌ Error: ${err1.message}`);
  } else {
    console.log(`   ✅ Found ${scores1?.length || 0} scores for ${today}`);
    if (scores1 && scores1.length > 0) {
      console.log('   Sample:', scores1[0]);
    }
  }

  // Try daily_scores
  console.log('\n2️⃣  daily_scores table:');
  const { data: scores2, error: err2 } = await supabase
    .from('daily_scores')
    .select('*')
    .eq('date', today);

  if (err2) {
    console.log(`   ❌ Error: ${err2.message}`);
  } else {
    console.log(`   ✅ Found ${scores2?.length || 0} scores for ${today}`);
    if (scores2 && scores2.length > 0) {
      console.log('   Sample columns:', Object.keys(scores2[0]));
    }
  }

  // Try nutrition_scores_cache
  console.log('\n3️⃣  nutrition_scores_cache table:');
  const { data: scores3, error: err3 } = await supabase
    .from('nutrition_scores_cache')
    .select('*')
    .eq('date', today);

  if (err3) {
    console.log(`   ❌ Error: ${err3.message}`);
  } else {
    console.log(`   ✅ Found ${scores3?.length || 0} scores for ${today}`);
  }

  // Check Muhammad Habieb specifically
  const habiebId = '8c2006e2-5512-4865-ba05-618cf2161ec1';
  console.log('\n4️⃣  Muhammad Habieb\'s scores:');
  
  const { data: habiebScore } = await supabase
    .from('daily_scores')
    .select('*')
    .eq('user_id', habiebId)
    .eq('date', today)
    .maybeSingle();

  if (habiebScore) {
    console.log('   ✅ Found score in daily_scores:');
    console.log(JSON.stringify(habiebScore, null, 2));
  } else {
    console.log('   ❌ No score found in daily_scores');
  }
}

checkScoringTables().catch(console.error);
