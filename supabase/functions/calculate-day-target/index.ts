import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';
import { 
  calculateBMR, 
  getActivityFactor, 
  getMacroTargetsPerKg, 
  getMealRatios, 
  calculateFuelingWindows,
  UserProfile,
  TrainingLoad
} from '../_shared/nutrition-unified.ts';

interface DayTarget {
  date: string;
  load: TrainingLoad;
  kcal: number;
  grams: {
    cho: number;
    protein: number;
    fat: number;
  };
  fueling: {
    pre?: { hoursBefore: number; cho_g: number };
    duringCHOgPerHour?: number | null;
    post?: { minutesAfter: number; cho_g: number; protein_g: number };
  };
  meals: Array<{
    meal: string;
    ratio: number;
    cho_g: number;
    protein_g: number;
    fat_g: number;
    kcal: number;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { profile, load, date } = await req.json();

    if (!profile || !load || !date) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate BMR
    const bmr = calculateBMR(profile);
    
    // Get activity factor
    const activityFactor = getActivityFactor(load);
    const tdee = Math.round(bmr * activityFactor / 10) * 10;

    // Calculate macros
    const { cho: choPerKg, protein: proteinPerKg } = getMacroTargetsPerKg(load);
    const choGrams = Math.round(profile.weightKg * choPerKg);
    const proteinGrams = Math.round(profile.weightKg * proteinPerKg);
    
    // Fat = minimum 20% of kcal
    const minFatKcal = tdee * 0.2;
    const fatGrams = Math.round(minFatKcal / 9);

    // Split into meals
    const mealRatios = getMealRatios(load);
    const meals = Object.entries(mealRatios)
      .filter(([_, ratio]) => ratio > 0)
      .map(([meal, ratio]) => ({
        meal,
        ratio,
        cho_g: Math.round(choGrams * ratio),
        protein_g: Math.round(proteinGrams * ratio),
        fat_g: Math.round(fatGrams * ratio),
        kcal: Math.round(tdee * ratio / 10) * 10
      }));

    // Calculate fueling windows
    const fueling = calculateFuelingWindows(profile, load);

    const dayTarget: DayTarget = {
      date,
      load,
      kcal: tdee,
      grams: {
        cho: choGrams,
        protein: proteinGrams,
        fat: fatGrams
      },
      fueling,
      meals
    };

    return new Response(JSON.stringify(dayTarget), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error calculating day target:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
