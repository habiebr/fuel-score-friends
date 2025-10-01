import { corsHeaders } from '../_shared/cors.ts';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();

    if (!image) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Groq AI to parse the training plan
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this training plan image and extract:
1. Number of training days per week
2. Types of workouts (easy run, long run, intervals, etc.)
3. Weekly mileage if visible
4. Any specific goals mentioned

Return a structured summary of the training schedule.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: image
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('AI API error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to parse training plan' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const parsedPlan = data.choices?.[0]?.message?.content || 'Unable to parse training plan';

    // Extract weekly runs count from the response
    const weeklyRunsMatch = parsedPlan.match(/(\d+)\s*(days?|runs?|sessions?)\s*per\s*week/i);
    const weeklyRuns = weeklyRunsMatch ? parseInt(weeklyRunsMatch[1]) : null;

    return new Response(
      JSON.stringify({
        success: true,
        message: parsedPlan,
        weeklyRuns,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in parse-training-plan:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
