import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userProfile, wearableData, foodLogs, type = "suggestion" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    let systemPrompt = "";
    let prompt = "";

    if (type === "suggestion") {
      systemPrompt = `You are a certified nutritionist and fitness expert. Provide personalized nutrition advice based on user data. Be concise, actionable, and encouraging. Always consider their activity level, goals, and current nutrition intake.`;
      
      prompt = `User Profile:
- Age: ${userProfile.age || 'Not provided'}
- Height: ${userProfile.height || 'Not provided'}cm
- Weight: ${userProfile.weight || 'Not provided'}kg  
- Activity Level: ${userProfile.activity_level || 'moderate'}
- Goals: ${userProfile.fitness_goals?.join(', ') || 'maintain weight'}

Today's Activity:
- Steps: ${wearableData.steps || 0}
- Calories Burned: ${wearableData.calories_burned || 0}
- Active Minutes: ${wearableData.active_minutes || 0}

Recent Meals: ${foodLogs.length > 0 ? foodLogs.map((log: any) => `${log.food_name} (${log.calories} cal)`).join(', ') : 'No meals logged today'}

Please provide 2-3 specific, actionable nutrition suggestions for their next meal or snack. Focus on what would best support their goals and current activity level.`;
    } else if (type === "score") {
      systemPrompt = `You are a nutrition scoring algorithm. Calculate a daily nutrition score from 0-100 based on meals logged, nutritional balance, and activity level.`;
      
      prompt = `Calculate a nutrition score based on:
Meals: ${foodLogs.map((log: any) => `${log.food_name} - ${log.calories}cal, ${log.protein_grams}g protein`).join(', ')}
Activity: ${wearableData.calories_burned || 0} calories burned
Goals: ${userProfile.fitness_goals?.join(', ') || 'maintain weight'}

Return just the numeric score (0-100) and a brief explanation.`;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add funds to your Lovable AI workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'AI gateway error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    return new Response(JSON.stringify({ 
      suggestion: aiResponse,
      type: type 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in nutrition-ai function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});