import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DashboardResponse = {
  dailyScore: number;
  weeklyScore: number;
  calories: { consumed: number; target: number };
  macros: {
    protein: { consumed: number; target: number };
    carbs: { consumed: number; target: number };
    fat: { consumed: number; target: number };
  };
  weeklyKm: { current: number; target: number };
  insights: Array<{ icon: string; title: string; message: string; color: string }>; 
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, serviceRole);

    // Auth: prefer user from auth context, fallback to body
    const { data: auth } = await supabase.auth.getUser();
    const body = await req.json().catch(() => ({}));
    const userId: string | undefined = auth?.user?.id || body?.user_id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const today = new Date().toISOString().slice(0, 10);

    // Fetch in parallel
    const [mealPlans, foodLogs, profile, nutritionScore, weeklyData] = await Promise.all([
      supabase.from('daily_meal_plans').select('*').eq('user_id', userId).eq('date', today),
      supabase.from('food_logs').select('*').eq('user_id', userId).gte('logged_at', `${today}T00:00:00`).lte('logged_at', `${today}T23:59:59`),
      (supabase as any).from('profiles').select('age, sex, weight_kg, height_cm, activity_level').eq('user_id', userId).maybeSingle(),
      supabase.from('nutrition_scores').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
      (async () => {
        try {
          const { data, error } = await (supabase as any).rpc('get_weekly_google_fit_summary', { p_user_id: userId });
          if (error) return { totalDistanceKm: 0, target: 30 };
          return data || { totalDistanceKm: 0, target: 30 };
        } catch (_) {
          return { totalDistanceKm: 0, target: 30 };
        }
      })(),
    ]);

    // Aggregate
    const consumed = aggregateFood(foodLogs?.data || []);
    const target = estimateTargets(profile?.data);
    const macrosTargets = deriveMacrosFromCalories(target);
    const weeklyKm = { current: weeklyData.totalDistanceKm || 0, target: weeklyData.target || 30 };

    const resp: DashboardResponse = {
      dailyScore: nutritionScore?.data?.score || 0,
      weeklyScore: 0, // omit heavy calc; frontend can show later if needed
      calories: { consumed: consumed.calories, target },
      macros: {
        protein: { consumed: consumed.protein, target: macrosTargets.protein },
        carbs: { consumed: consumed.carbs, target: macrosTargets.carbs },
        fat: { consumed: consumed.fat, target: macrosTargets.fat },
      },
      weeklyKm,
      insights: [],
    };

    return json(resp);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function aggregateFood(foodLogs: any[]) {
  const sum = foodLogs.reduce((acc, f) => {
    acc.calories += f.calories || 0;
    acc.protein += f.protein_grams || 0;
    acc.carbs += f.carbs_grams || 0;
    acc.fat += f.fat_grams || 0;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  return sum;
}

function estimateTargets(profile?: any): number {
  // Simple BMR * activity multiplier to avoid importing app code here
  if (!profile) return 2400;
  const sex = (profile.sex || 'male').toLowerCase();
  const w = profile.weight_kg || 70; const h = profile.height_cm || 170; const a = profile.age || 30;
  const bmr = sex === 'female' ? 447.593 + (9.247 * w) + (3.098 * h) - (4.330 * a) : 88.362 + (13.397 * w) + (4.799 * h) - (5.677 * a);
  const mult = 1.5;
  return Math.round(bmr * mult);
}

function deriveMacrosFromCalories(cal: number) {
  const protein = Math.round((cal * 0.3) / 4);
  const carbs = Math.round((cal * 0.5) / 4);
  const fat = Math.round((cal * 0.2) / 9);
  return { protein, carbs, fat };
}


