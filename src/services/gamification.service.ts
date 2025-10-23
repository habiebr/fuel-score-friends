import { supabase } from '@/integrations/supabase/client';

export interface GamificationState {
  current_streak: number;
  best_streak: number;
  tier: 'learner' | 'athlete' | 'elite';
  last_milestone: string | null;
  total_days_logged: number;
  updated_at: string;
}

export interface WeeklyInsight {
  week_start: string;
  avg_fuel_score: number;
  pre_window_ok_pct: number;
  during_window_ok_pct: number;
  post_window_ok_pct: number;
  predicted_impact_json: any;
}

export interface GamificationData {
  state: GamificationState;
  latestInsight: WeeklyInsight | null;
  todayScore: number;
}

/**
 * Get gamification state for the current user
 */
export async function getGamificationState(): Promise<GamificationData> {
  try {
    console.log('Calling gamification function...');
    const { data, error } = await supabase.functions.invoke('gamification', {
      body: {}
    });

    console.log('Gamification function response:', { data, error });

    if (error) {
      console.error('Error getting gamification state:', error);
      throw error;
    }

    return data.data;
  } catch (err) {
    console.error('Exception in getGamificationState:', err);
    throw err;
  }
}

/**
 * Recalculate streak for the current user
 */
export async function recalcStreak(): Promise<{ currentStreak: number; bestStreak: number }> {
  try {
    const { data, error } = await supabase.functions.invoke('gamification/recalc-streak', {
      body: {}
    });

    if (error) {
      console.error('Error recalculating streak:', error);
      throw error;
    }

    return data.data;
  } catch (error) {
    console.error('Error in recalcStreak:', error);
    throw error;
  }
}

/**
 * Acknowledge a milestone
 */
export async function ackMilestone(milestone: string): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('gamification/ack-milestone', {
      body: { milestone }
    });

    if (error) {
      console.error('Error acknowledging milestone:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in ackMilestone:', error);
    throw error;
  }
}

/**
 * Get daily scores for streak calculation
 */
export async function getDailyScores(userId: string, fromDate: Date): Promise<Array<{ date: string; score: number }>> {
  try {
    const { data, error } = await supabase
      .from('user_daily_scores')
      .select('score_date, fuel_score')
      .eq('user_id', userId)
      .gte('score_date', fromDate.toISOString().split('T')[0])
      .order('score_date', { ascending: true });

    if (error) {
      console.error('Error getting daily scores:', error);
      throw error;
    }

    return data.map(row => ({
      date: row.score_date,
      score: row.fuel_score
    }));
  } catch (error) {
    console.error('Error in getDailyScores:', error);
    throw error;
  }
}

/**
 * Get 28-day average score for tier calculation
 */
export async function get28DayAverage(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('user_28d_avg_scores')
      .select('avg_28d')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error getting 28-day average:', error);
      return 0;
    }

    return data.avg_28d || 0;
  } catch (error) {
    console.error('Error in get28DayAverage:', error);
    return 0;
  }
}

/**
 * Get user milestones
 */
export async function getUserMilestones(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('user_milestones')
      .select('milestone')
      .eq('user_id', userId)
      .order('achieved_on', { ascending: true });

    if (error) {
      console.error('Error getting user milestones:', error);
      throw error;
    }

    return data.map(row => row.milestone);
  } catch (error) {
    console.error('Error in getUserMilestones:', error);
    throw error;
  }
}

/**
 * Check for new milestones
 */
export async function checkNewMilestones(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('check_milestones', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error checking milestones:', error);
      throw error;
    }

    return data.map((row: any) => row.milestone_code);
  } catch (error) {
    console.error('Error in checkNewMilestones:', error);
    throw error;
  }
}
