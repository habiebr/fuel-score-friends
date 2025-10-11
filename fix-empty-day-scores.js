#!/usr/bin/env node

/**
 * Fix nutrition scores for days with no food logged
 * Sets score to 0 when meals_logged = 0
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixEmptyDayScores() {
  console.log('🔍 Finding nutrition scores with no food logged...\n');

  try {
    // Get all nutrition scores where meals_logged is 0 or calories_consumed is 0
    const { data: scores, error: fetchError } = await supabase
      .from('nutrition_scores')
      .select('*')
      .or('meals_logged.eq.0,calories_consumed.eq.0');

    if (fetchError) {
      throw new Error(`Failed to fetch nutrition scores: ${fetchError.message}`);
    }

    if (!scores || scores.length === 0) {
      console.log('✅ No empty day scores found. All good!');
      return;
    }

    console.log(`📊 Found ${scores.length} nutrition scores with no food logged\n`);

    let updated = 0;
    let skipped = 0;

    for (const score of scores) {
      // Double-check by querying food_logs for this date
      const { data: foodLogs, error: logsError } = await supabase
        .from('food_logs')
        .select('id')
        .eq('user_id', score.user_id)
        .gte('logged_at', `${score.date}T00:00:00`)
        .lte('logged_at', `${score.date}T23:59:59`);

      if (logsError) {
        console.error(`❌ Error checking food logs for ${score.date}:`, logsError.message);
        continue;
      }

      const actualMealsLogged = foodLogs?.length || 0;

      // If there are truly no meals logged, set score to 0
      if (actualMealsLogged === 0) {
        const { error: updateError } = await supabase
          .from('nutrition_scores')
          .update({
            daily_score: 0,
            meals_logged: 0,
            calories_consumed: 0,
            protein_grams: 0,
            carbs_grams: 0,
            fat_grams: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', score.id);

        if (updateError) {
          console.error(`❌ Error updating score for ${score.date}:`, updateError.message);
        } else {
          console.log(`✅ Fixed score for ${score.user_id} on ${score.date}: ${score.daily_score} → 0`);
          updated++;
        }
      } else {
        console.log(`⏭️  Skipping ${score.date} - has ${actualMealsLogged} meals logged`);
        skipped++;
      }

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📈 Summary:`);
    console.log(`   - Total found: ${scores.length}`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Skipped: ${skipped}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('💥 Error:', error);
    throw error;
  }
}

// Run the script
fixEmptyDayScores()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
