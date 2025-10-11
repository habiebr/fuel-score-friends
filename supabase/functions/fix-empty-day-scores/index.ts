// @deno-types="https://deno.land/x/types/deno.ns.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔍 Finding nutrition scores with no food logged...');

    // Get all nutrition scores where meals_logged is 0 or calories_consumed is 0
    const { data: scores, error: fetchError } = await supabase
      .from('nutrition_scores')
      .select('*')
      .or('meals_logged.eq.0,calories_consumed.eq.0');

    if (fetchError) {
      throw new Error(`Failed to fetch nutrition scores: ${fetchError.message}`);
    }

    if (!scores || scores.length === 0) {
      return new Response(JSON.stringify({
        message: 'No empty day scores found. All good!',
        updated: 0,
        skipped: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📊 Found ${scores.length} nutrition scores with no food logged`);

    let updated = 0;
    let skipped = 0;
    const results = [];

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
          results.push({ date: score.date, status: 'error', error: updateError.message });
        } else {
          console.log(`✅ Fixed score for ${score.user_id} on ${score.date}: ${score.daily_score} → 0`);
          results.push({ date: score.date, status: 'updated', oldScore: score.daily_score, newScore: 0 });
          updated++;
        }
      } else {
        console.log(`⏭️  Skipping ${score.date} - has ${actualMealsLogged} meals logged`);
        results.push({ date: score.date, status: 'skipped', reason: `Has ${actualMealsLogged} meals` });
        skipped++;
      }
    }

    return new Response(JSON.stringify({
      message: 'Fixed empty day scores',
      total: scores.length,
      updated,
      skipped,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fix-empty-day-scores:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});