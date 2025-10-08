import { supabase } from '@/integrations/supabase/client';
import { dailyScore } from '@/science/dailyScore';
import { addDays, format, startOfWeek } from 'date-fns';
import { 
  getTodayScore as getTodayUnifiedScore,
  getDailyScoreForDate as getDailyScoreForDateUnified,
  getWeeklyScorePersisted as getWeeklyScorePersistedUnified
} from './unified-score.service';

// Maps domain → scoring context using existing tables:
// - profiles → Profile
// - daily_meal_plans (targets) and day target from science (optional future)
// - food_logs (actuals)
// - training_activities (plan/actual proxy)

export async function getTodayScore(userId: string): Promise<{
  score: number;
  breakdown: { nutrition: number; training: number; bonuses: number; penalties: number };
}> {
  // Use unified scoring system
  return getTodayUnifiedScore(userId);
}

export async function getDailyScoreForDate(userId: string, dateISO: string): Promise<{
  score: number;
  breakdown: { nutrition: number; training: number; bonuses: number; penalties: number };
}> {
  // Use unified scoring system
  return getDailyScoreForDateUnified(userId, dateISO);
}

export async function getWeeklyScore(userId: string, endDateISO?: string): Promise<number> {
  const anyDate = endDateISO ? new Date(endDateISO) : new Date();
  const weekStart = startOfWeek(anyDate, { weekStartsOn: 1 }); // Monday
  
  // Use unified scoring system
  const result = await getWeeklyScorePersistedUnified(userId);
  return result.average;
}

export async function getWeeklyScorePersisted(userId: string, anyDateISO?: string): Promise<number> {
  // Use unified scoring system
  const result = await getWeeklyScorePersistedUnified(userId);
  return result.average;
}


