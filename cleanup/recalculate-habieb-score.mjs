// Recalculate score for Muhammad Habieb
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function recalculateScore() {
  const userId = '8c2006e2-5512-4865-ba05-618cf2161ec1';
  const today = new Date().toISOString().split('T')[0];

  console.log(`📊 Recalculating score for Muhammad Habieb on ${today}...\n`);

  try {
    // Trigger the calculate-nutrition-score edge function
    const { data, error } = await supabase.functions.invoke('calculate-nutrition-score', {
      body: { 
        userId: userId,
        date: today 
      }
    });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('✅ Score recalculated successfully!');
    console.log('\nNew Score Data:');
    console.log(JSON.stringify(data, null, 2));

    // Also fetch the updated score from cache
    const { data: cachedScore } = await supabase
      .from('nutrition_scores_cache')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (cachedScore) {
      console.log('\n📈 Updated Cached Score:');
      console.log(`  Total Score: ${cachedScore.total_score}/100`);
      console.log(`  Calories Consumed: ${cachedScore.calories_consumed} kcal`);
      console.log(`  Meals Logged: ${cachedScore.meals_logged}`);
    }

  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
}

recalculateScore().catch(console.error);
