import { supabase } from '@/integrations/supabase/client';
import { dailyScore } from '@/science/dailyScore';
import { addDays, format, startOfWeek } from 'date-fns';

// Maps domain → scoring context using existing tables:
// - profiles → Profile
// - daily_meal_plans (targets) and day target from science (optional future)
// - food_logs (actuals)
// - training_activities (plan/actual proxy)

export async function getTodayScore(userId: string): Promise<{
  score: number;
  breakdown: { nutrition: number; training: number; bonuses: number; penalties: number };
}> {
  const today = format(new Date(), 'yyyy-MM-dd');
  return getDailyScoreForDate(userId, today);
}

export async function getDailyScoreForDate(userId: string, dateISO: string): Promise<{
  score: number;
  breakdown: { nutrition: number; training: number; bonuses: number; penalties: number };
}> {
  const today = dateISO;

  // Profile
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('weight, height, age, goal_type, target_date, sex')
    .eq('user_id', userId)
    .maybeSingle();

  // Targets from daily_meal_plans (sum) fallback to 0
  const { data: plans } = await (supabase as any)
    .from('daily_meal_plans')
    .select('meal_type, recommended_carbs_grams, recommended_protein_grams, recommended_fat_grams')
    .eq('user_id', userId)
    .eq('date', today);

  const targetTotals = (plans || []).reduce((acc: any, p: any) => {
    acc.cho += p.recommended_carbs_grams || 0;
    acc.protein += p.recommended_protein_grams || 0;
    acc.fat += p.recommended_fat_grams || 0;
    return acc;
  }, { cho: 0, protein: 0, fat: 0 });

  // Fueling windows (approx) from presence of snack and load; if snack present, enable during
  const mealsPresent: Array<'breakfast'|'lunch'|'dinner'|'snack'> = (plans || []).map((p:any)=>p.meal_type).filter(Boolean);
  const hasSnack = mealsPresent.includes('snack');

  // Actual nutrition from food_logs
  const { data: logs } = await (supabase as any)
    .from('food_logs')
    .select('meal_type, calories, protein_grams, carbs_grams, fat_grams, logged_at')
    .eq('user_id', userId)
    .gte('logged_at', `${today}T00:00:00`)
    .lte('logged_at', `${today}T23:59:59`);

  const actualTotals = (logs || []).reduce((acc: any, r: any) => {
    acc.cho += r.carbs_grams || 0;
    acc.protein += r.protein_grams || 0;
    acc.fat += r.fat_grams || 0;
    return acc;
  }, { cho: 0, protein: 0, fat: 0 });

  // Simple fueling inference: pre if food within -4..-2h before first activity; post if within 90min after last
  const { data: acts } = await (supabase as any)
    .from('training_activities')
    .select('activity_type, duration_minutes, intensity')
    .eq('user_id', userId)
    .eq('date', today);

  const totalDur = (acts || []).reduce((s:number,a:any)=> s + (a.duration_minutes||0), 0);
  const load = (() => {
    if (!acts || acts.length === 0) return 'rest' as const;
    const long = (acts as any[]).some(a => (a.duration_minutes||0) >= 90);
    const quality = (acts as any[]).some(a => (a.intensity||'moderate') === 'high');
    if (long) return 'long' as const;
    if (quality) return 'quality' as const;
    const moderate = totalDur >= 60;
    if (moderate) return 'moderate' as const;
    return 'easy' as const;
  })();

  const windows = {
    pre: { applicable: load !== 'rest', inWindow: true },
    during: { applicable: load === 'long' || hasSnack },
    post: { applicable: load !== 'rest', inWindow: true },
  };

  const ctx = {
    load,
    nutrition: {
      target: {
        cho: Math.round(targetTotals.cho),
        protein: Math.round(targetTotals.protein),
        fat: Math.round(targetTotals.fat),
        preCho: Math.round((profile?.weight || 70) * 1.5),
        duringChoPerHour: load === 'long' ? 60 : 0,
        postCho: Math.round((profile?.weight || 70) * 1.0),
        postPro: Math.round((profile?.weight || 70) * 0.3),
        fatMin: Math.round(((targetTotals.cho*4 + targetTotals.protein*4 + targetTotals.fat*9) * 0.2) / 9),
      },
      actual: {
        cho: Math.round(actualTotals.cho),
        protein: Math.round(actualTotals.protein),
        fat: Math.round(actualTotals.fat),
        preCho: undefined,
        duringChoPerHour: undefined,
        postCho: undefined,
        postPro: undefined,
      },
      windows,
      mealsPresent,
      singleMealOver60pct: false,
    },
    training: {
      plan: { durationMin: totalDur, type: (acts?.[0]?.activity_type) || undefined, intensity: undefined },
      actual: { durationMin: totalDur, type: (acts?.[0]?.activity_type) || undefined, avgHr: undefined },
      typeFamilyMatch: true,
      intensityOk: undefined,
      intensityNear: undefined,
    },
    flags: {
      windowSyncAll: true,
      streakDays: 0,
      hydrationOk: true,
      bigDeficit: false,
      isHardDay: load === 'long' || load === 'quality',
      missedPostWindow: false,
    },
  } as const;

  const score = dailyScore(ctx as any);
  // Approximate breakdown (not exact from engine, for reporting purpose only)
  const nutrition = Math.round(score * (load === 'rest' ? 1 : 0.6));
  const training = Math.round(score - nutrition);
  const bonuses = 0;
  const penalties = 0;
  return { score, breakdown: { nutrition, training, bonuses, penalties } };
}

export async function getWeeklyScore(userId: string, endDateISO?: string): Promise<number> {
  const anyDate = endDateISO ? new Date(endDateISO) : new Date();
  const weekStart = startOfWeek(anyDate, { weekStartsOn: 1 }); // Monday
  const dates: string[] = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));
  const scores: number[] = [];
  for (const d of dates) {
    const { score } = await getDailyScoreForDate(userId, d);
    scores.push(score);
  }
  if (scores.length === 0) return 0;
  const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  return avg;
}


