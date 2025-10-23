import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

interface GamificationState {
  current_streak: number;
  best_streak: number;
  tier: 'learner' | 'athlete' | 'elite';
  last_milestone: string | null;
  total_days_logged: number;
  updated_at: string;
}

interface WeeklyInsight {
  week_start: string;
  avg_fuel_score: number;
  pre_window_ok_pct: number;
  during_window_ok_pct: number;
  post_window_ok_pct: number;
  predicted_impact_json: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Gamification Function Started ===');
    
    // Get the JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No Authorization header');
      return new Response(JSON.stringify({ error: 'Authorization header missing' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with proper JWT handling
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user from JWT token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    console.log(`User authenticated: ${userId}`);

    // Create service role client for database operations
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle routing - default to getGamificationState for base path
    const url = new URL(req.url);
    const path = url.pathname;
    
    console.log('Request path:', path);
    
    if (path.endsWith('/gamification') || path.endsWith('/gamification/state')) {
      return await getGamificationState(supabaseServiceClient, userId);
    } else if (path.endsWith('/gamification/recalc-streak')) {
      return await recalcStreak(supabaseServiceClient, userId);
    } else if (path.endsWith('/gamification/ack-milestone')) {
      // Parse body for milestone
      let body = null;
      try {
        body = await req.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid request body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const milestone = body?.milestone;
      return await ackMilestone(supabaseServiceClient, userId, milestone);
    } else {
      console.log('Path not found:', path);
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in gamification function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getGamificationState(supabase: any, userId: string) {
  try {
    // Get gamification state
    const { data: state, error: stateError } = await supabase
      .from('user_gamification_state')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (stateError && stateError.code !== 'PGRST116') {
      throw stateError;
    }

    // Get latest weekly insight
    const { data: latestInsight, error: insightError } = await supabase
      .from('user_weekly_insights')
      .select('*')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(1)
      .single();

    if (insightError && insightError.code !== 'PGRST116') {
      throw insightError;
    }

    // Get today's score from nutrition_scores table
    const today = new Date().toISOString().split('T')[0];
    const { data: todayScore, error: scoreError } = await supabase
      .from('nutrition_scores')
      .select('daily_score')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (scoreError && scoreError.code !== 'PGRST116') {
      throw scoreError;
    }

    return new Response(JSON.stringify({
      ok: true,
      data: {
        state: state || {
          current_streak: 0,
          best_streak: 0,
          tier: 'learner',
          last_milestone: null,
          total_days_logged: 0,
          updated_at: new Date().toISOString()
        },
        latestInsight: latestInsight || null,
        todayScore: todayScore?.daily_score || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error getting gamification state:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function recalcStreak(supabase: any, userId: string) {
  try {
    // Calculate streak from nutrition_scores table
    const { data: scores, error: scoresError } = await supabase
      .from('nutrition_scores')
      .select('date, daily_score')
      .eq('user_id', userId)
      .not('daily_score', 'is', null)
      .order('date', { ascending: true });

    if (scoresError) {
      throw scoresError;
    }

    // Calculate current streak
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    if (scores && scores.length > 0) {
      // Sort by date descending to calculate current streak
      const sortedScores = [...scores].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Calculate current streak (from most recent)
      for (const score of sortedScores) {
        if (score.daily_score >= 70) {
          currentStreak++;
        } else {
          break;
        }
      }

      // Calculate best streak
      for (const score of scores) {
        if (score.daily_score >= 70) {
          tempStreak++;
          bestStreak = Math.max(bestStreak, tempStreak);
        } else {
          tempStreak = 0;
        }
      }
    }

    // Update or create gamification state
    const { error: upsertError } = await supabase
      .from('user_gamification_state')
      .upsert({
        user_id: userId,
        current_streak: currentStreak,
        best_streak: bestStreak,
        total_days_logged: scores?.length || 0,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      throw upsertError;
    }

    return new Response(JSON.stringify({
      ok: true,
      data: {
        currentStreak,
        bestStreak
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error recalculating streak:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function ackMilestone(supabase: any, userId: string, milestone: string) {
  try {
    // Insert milestone if not exists
    const { error: insertError } = await supabase
      .from('user_milestones')
      .insert({
        user_id: userId,
        milestone: milestone,
        acknowledged_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError && insertError.code !== '23505') { // Ignore duplicate key error
      throw insertError;
    }

    // Update gamification state
    const { error: updateError } = await supabase
      .from('user_gamification_state')
      .update({
        last_milestone: milestone,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({
      ok: true,
      message: 'Milestone acknowledged successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error acknowledging milestone:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
