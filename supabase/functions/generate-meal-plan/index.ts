import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

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

    const { date } = await req.json();
    const targetDate = date || new Date().toISOString().split('T')[0];

    console.log(`Generating meal plan for user ${user.id} on ${targetDate}`);

    // Fetch user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Fetch recent wearable data
    const { data: wearableData } = await supabaseClient
      .from('wearable_data')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(7);

    // Calculate daily calorie needs based on profile and activity
    const avgCaloriesBurned = wearableData && wearableData.length > 0
      ? wearableData.reduce((sum, d) => sum + (d.calories_burned || 0), 0) / wearableData.length
      : 0;

    const bmr = profile?.weight && profile?.height && profile?.age
      ? 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5
      : 2000;

    const activityMultipliers: { [key: string]: number } = {
      'sedentary': 1.2,
      'light': 1.375,
      'moderate': 1.55,
      'active': 1.725,
      'very_active': 1.9
    };
    const activityMultiplier = activityMultipliers[profile?.activity_level || 'moderate'] || 1.55;

    const totalDailyCalories = Math.round(bmr * activityMultiplier);

    // Calculate macro distribution based on fitness goals
    const goals = profile?.fitness_goals || ['maintain_weight'];
    let proteinPercent = 0.30, carbsPercent = 0.40, fatPercent = 0.30;

    if (goals.includes('build_muscle')) {
      proteinPercent = 0.35;
      carbsPercent = 0.40;
      fatPercent = 0.25;
    } else if (goals.includes('lose_weight')) {
      proteinPercent = 0.35;
      carbsPercent = 0.30;
      fatPercent = 0.35;
    } else if (goals.includes('improve_endurance')) {
      proteinPercent = 0.25;
      carbsPercent = 0.50;
      fatPercent = 0.25;
    }

    // Use AI to generate meal suggestions
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    const systemPrompt = `You are a nutrition expert. Generate specific meal suggestions based on the user's profile and calorie/macro targets.
    
User Profile:
- Activity Level: ${profile?.activity_level || 'moderate'}
- Fitness Goals: ${goals.join(', ')}
- Daily Calories: ${totalDailyCalories} kcal
- Protein: ${Math.round(totalDailyCalories * proteinPercent / 4)}g
- Carbs: ${Math.round(totalDailyCalories * carbsPercent / 4)}g
- Fat: ${Math.round(totalDailyCalories * fatPercent / 9)}g

Generate 3 specific meal suggestions for each meal type (breakfast, lunch, dinner).
Each suggestion should include the meal name and brief description.
Return ONLY a JSON array with this structure:
{
  "breakfast": [{"name": "...", "description": "..."}],
  "lunch": [{"name": "...", "description": "..."}],
  "dinner": [{"name": "...", "description": "..."}]
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate the meal plan now.' }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', aiResponse.status);
      throw new Error('Failed to generate meal suggestions');
    }

    const aiData = await aiResponse.json();
    let mealSuggestions;
    try {
      const content = aiData.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      mealSuggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : { breakfast: [], lunch: [], dinner: [] };
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      mealSuggestions = { breakfast: [], lunch: [], dinner: [] };
    }

    // Create meal plans for each meal
    const mealTypes = ['breakfast', 'lunch', 'dinner'];
    const mealCalorieDistribution: { [key: string]: number } = {
      'breakfast': 0.30,
      'lunch': 0.40,
      'dinner': 0.30
    };

    const plans = [];
    for (const mealType of mealTypes) {
      const mealCalories = Math.round(totalDailyCalories * (mealCalorieDistribution[mealType] || 0.33));
      const mealProtein = Math.round(mealCalories * proteinPercent / 4);
      const mealCarbs = Math.round(mealCalories * carbsPercent / 4);
      const mealFat = Math.round(mealCalories * fatPercent / 9);

      const { data: existingPlan } = await supabaseClient
        .from('daily_meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', targetDate)
        .eq('meal_type', mealType)
        .single();

      if (existingPlan) {
        // Update existing plan
        const { data: updated } = await supabaseClient
          .from('daily_meal_plans')
          .update({
            recommended_calories: mealCalories,
            recommended_protein_grams: mealProtein,
            recommended_carbs_grams: mealCarbs,
            recommended_fat_grams: mealFat,
            meal_suggestions: mealSuggestions[mealType] || [],
          })
          .eq('id', existingPlan.id)
          .select()
          .single();
        plans.push(updated);
      } else {
        // Create new plan
        const { data: created } = await supabaseClient
          .from('daily_meal_plans')
          .insert({
            user_id: user.id,
            date: targetDate,
            meal_type: mealType,
            recommended_calories: mealCalories,
            recommended_protein_grams: mealProtein,
            recommended_carbs_grams: mealCarbs,
            recommended_fat_grams: mealFat,
            meal_suggestions: mealSuggestions[mealType] || [],
          })
          .select()
          .single();
        plans.push(created);
      }
    }

    console.log(`Successfully generated meal plan for ${targetDate}`);

    return new Response(JSON.stringify({ 
      success: true, 
      plans,
      totalDailyCalories,
      macros: {
        protein: Math.round(totalDailyCalories * proteinPercent / 4),
        carbs: Math.round(totalDailyCalories * carbsPercent / 4),
        fat: Math.round(totalDailyCalories * fatPercent / 9)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating meal plan:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});