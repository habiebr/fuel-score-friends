import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { format, startOfWeek } from 'https://esm.sh/date-fns@2.30.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get week start from request body or use current week
    const { weekStart } = await req.json().catch(() => ({}));
    const weekStartDate = weekStart 
      ? new Date(weekStart)
      : startOfWeek(new Date(), { weekStartsOn: 1 });
    
    const endDate = new Date(weekStartDate);
    endDate.setDate(endDate.getDate() + 6);
    
    const weekStartStr = format(weekStartDate, 'yyyy-MM-dd');
    const weekEndStr = format(endDate, 'yyyy-MM-dd');

    console.log(`Fetching weekly scores for ${weekStartStr} to ${weekEndStr}`);

    // Fetch all users' nutrition scores for the week (using service role to bypass RLS)
    const { data: scores, error: scoresError } = await supabaseClient
      .from('nutrition_scores')
      .select('user_id, date, daily_score')
      .gte('date', weekStartStr)
      .lte('date', weekEndStr)
      .order('user_id, date', { ascending: true });

    if (scoresError) {
      console.error('Error fetching scores:', scoresError);
      throw scoresError;
    }

    console.log(`Found ${scores?.length || 0} score records`);

    // Group by user and calculate weekly averages
    const userScoresMap = new Map<string, Array<{ date: string; score: number }>>();
    
    (scores || []).forEach(score => {
      if (!userScoresMap.has(score.user_id)) {
        userScoresMap.set(score.user_id, []);
      }
      userScoresMap.get(score.user_id)!.push({
        date: score.date,
        score: score.daily_score || 0
      });
    });

    // Calculate weekly scores
    const result: Array<{
      user_id: string;
      weekly_score: number;
      daily_scores: Array<{ date: string; score: number }>;
    }> = [];

    userScoresMap.forEach((dailyScores, userId) => {
      const validScores = dailyScores.filter(d => d.score > 0);
      const weeklyScore = validScores.length > 0
        ? Math.round(validScores.reduce((sum, d) => sum + d.score, 0) / validScores.length)
        : 0;
      
      result.push({
        user_id: userId,
        weekly_score: weeklyScore,
        daily_scores: dailyScores
      });
    });

    console.log(`Calculated weekly scores for ${result.length} users`);

    return new Response(
      JSON.stringify({ scores: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in weekly-scores-leaderboard:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
