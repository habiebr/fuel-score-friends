import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Groq from 'https://esm.sh/groq-sdk@0.3.0';
import { corsHeaders } from '../_shared/cors.ts';
import { calculateRecoveryNeeds, getIndonesianRecoveryMeals } from '../_shared/nutrition-unified.ts';

interface UserProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  restrictions: string[];
  behaviors: string[];
}

interface Workout {
  intensity: string;
  duration: number;
  distance?: number;
  calories_burned: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { profile, workout } = await req.json();

    // Calculate recovery needs using unified engine
    const recoveryNeeds = calculateRecoveryNeeds(profile, workout);

    // Use Groq AI to generate Indonesian-specific recovery meals
    const groq = new Groq();
    groq.apiKey = Deno.env.get('GROQ_API_KEY');

    const dietaryContext = profile.restrictions.length > 0 
      ? `considering these dietary restrictions: ${profile.restrictions.join(', ')}`
      : 'with no dietary restrictions';

    const quickMealPrompt = `
      Generate a quick post-run recovery snack suggestion for an Indonesian runner ${dietaryContext}.
      The snack should:
      - Be easily available in Indonesia
      - Provide ${recoveryNeeds.quickRecovery.calories} calories
      - Include ${recoveryNeeds.quickRecovery.proteinG}g protein
      - Include ${recoveryNeeds.quickRecovery.carbsG}g carbs
      - Include ${recoveryNeeds.quickRecovery.fatG}g fat
      - Be consumable within 30 minutes post-run
      - Use common Indonesian ingredients
      - Include scientific benefits for recovery

      Format the response as JSON:
      {
        "name": "snack name in Indonesian",
        "description": "brief description in Indonesian",
        "calories": number,
        "protein": number,
        "carbs": number,
        "fat": number,
        "benefits": ["benefit 1 in Indonesian", "benefit 2 in Indonesian", ...]
      }
    `;

    const fullMealPrompt = `
      Generate a complete post-run recovery meal suggestion for an Indonesian runner ${dietaryContext}.
      The meal should:
      - Be a traditional Indonesian dish
      - Provide ${recoveryNeeds.fullRecovery.calories} calories
      - Include ${recoveryNeeds.fullRecovery.proteinG}g protein
      - Include ${recoveryNeeds.fullRecovery.carbsG}g carbs
      - Include ${recoveryNeeds.fullRecovery.fatG}g fat
      - Be suitable for consumption within 2 hours post-run
      - Use common Indonesian ingredients
      - Include scientific benefits for recovery

      Format the response as JSON:
      {
        "name": "meal name in Indonesian",
        "description": "brief description in Indonesian",
        "calories": number,
        "protein": number,
        "carbs": number,
        "fat": number,
        "benefits": ["benefit 1 in Indonesian", "benefit 2 in Indonesian", ...]
      }
    `;

    try {
      const [quickResponse, fullResponse] = await Promise.all([
        groq.chat.completions.create({
          messages: [{ role: 'user', content: quickMealPrompt }],
          model: 'mixtral-8x7b-32768',
          temperature: 0.7,
          max_tokens: 1000,
          response_format: { type: 'json_object' }
        }),
        groq.chat.completions.create({
          messages: [{ role: 'user', content: fullMealPrompt }],
          model: 'mixtral-8x7b-32768',
          temperature: 0.7,
          max_tokens: 1000,
          response_format: { type: 'json_object' }
        })
      ]);

      const quickMeal = JSON.parse(quickResponse.choices[0]?.message?.content || '{}');
      const fullMeal = JSON.parse(fullResponse.choices[0]?.message?.content || '{}');

      return new Response(
        JSON.stringify({ quick: quickMeal, full: fullMeal }),
        { 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );

    } catch (aiError) {
      console.error('AI generation failed:', aiError);
      
      // Fallback to engine-calculated Indonesian suggestions
      const fallbackMeals = getIndonesianRecoveryMeals(recoveryNeeds);
      
      return new Response(
        JSON.stringify(fallbackMeals),
        { 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      }
    );
  }
});