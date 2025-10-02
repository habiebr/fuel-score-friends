import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, userProfile } = await req.json();
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    console.log('Analyzing fitness screenshot...');
    console.log('Has image:', !!image);
    console.log('Has GEMINI_API_KEY:', !!GEMINI_API_KEY);
    
    if (!GEMINI_API_KEY) {
      console.error('No Gemini API key configured');
      return new Response(JSON.stringify({ 
        error: 'AI is not configured. Please set GEMINI_API_KEY.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!image) {
      return new Response(JSON.stringify({ 
        error: 'No image provided' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Google GenAI
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Prepare the prompt for fitness screenshot analysis
    const systemPrompt = `You are an expert sports nutritionist. Analyze a fitness app screenshot and produce two practical nutrition suggestion lists only.

Return ONLY valid JSON with this exact structure (no markdown):
{
  "instantRecoverySnack": [
    { "name": string, "description": string, "calories": number, "protein": number, "carbs": number, "fat": number, "foods": string[] }
  ],
  "recoveryMeal": [
    { "name": string, "description": string, "calories": number, "protein": number, "carbs": number, "fat": number, "foods": string[] }
  ]
}

Rules:
- Do not include any analysis summary, body metrics, or extra fields
- Focus snacks for immediate post-activity recovery (15–30 min)
- Focus meals for full recovery within 2–3 hours
- Use realistic, accessible foods and portions`;

    const profileText = userProfile ? `\n\nUser Profile (optional): ${JSON.stringify(userProfile)}` : '';
    const userPrompt = `Analyze this fitness screenshot and output only the two lists: instantRecoverySnack and recoveryMeal as specified.${profileText}`;

    // Prepare the image data (support data URLs, raw base64, or HTTP(S) URLs)
    let mimeType = "image/jpeg";
    let base64Data = "";
    if (typeof image === 'string' && image.startsWith('http')) {
      // Fetch remote image and convert to base64
      const imgResp = await fetch(image);
      if (!imgResp.ok) {
        throw new Error(`Failed to fetch image from URL: ${imgResp.status}`);
      }
      mimeType = imgResp.headers.get('content-type') || 'image/jpeg';
      const buf = new Uint8Array(await imgResp.arrayBuffer());
      let binary = '';
      for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
      base64Data = btoa(binary);
    } else if (typeof image === 'string' && image.startsWith('data:')) {
      // data URL: data:<mime>;base64,<data>
      const commaIdx = image.indexOf(',');
      const header = image.substring(0, commaIdx);
      base64Data = image.substring(commaIdx + 1);
      const mtMatch = header.match(/data:(.*?);base64/);
      if (mtMatch) mimeType = mtMatch[1];
    } else if (typeof image === 'string') {
      // Assume raw base64 string
      base64Data = image;
    } else {
      throw new Error('Unsupported image format');
    }

    const contents = [
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
      { text: `${systemPrompt}\n\n${userPrompt}` },
    ];

    console.log('Sending request to Gemini 2.5 Flash...');
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
    });

    console.log('Gemini response received');
    const responseText = response.text;
    console.log('Raw Gemini response:', responseText);

    // Parse the JSON response
    let suggestions;
    try {
      // Clean up the response text to extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      suggestions = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', parseError);
      console.error('Response text:', responseText);
      
      // Fallback: create a basic response structure
      suggestions = {
        instantRecoverySnack: [
          { name: "Greek yogurt & banana", description: "Quick carb + protein combo", calories: 250, protein: 18, carbs: 35, fat: 4, foods: ["1 cup Greek yogurt", "1 banana"] },
          { name: "Chocolate milk", description: "Convenient recovery drink", calories: 220, protein: 12, carbs: 30, fat: 6, foods: ["500 ml low‑fat chocolate milk"] }
        ],
        recoveryMeal: [
          { name: "Chicken, rice, veggies", description: "Balanced post‑workout plate", calories: 600, protein: 40, carbs: 70, fat: 15, foods: ["150g chicken breast", "1 cup cooked rice", "1 cup mixed veggies", "1 tsp olive oil"] },
          { name: "Salmon pasta bowl", description: "Omega‑3 rich recovery", calories: 650, protein: 35, carbs: 70, fat: 22, foods: ["120g salmon", "2 cups cooked pasta", "spinach", "olive oil"] }
        ]
      };
    }

    // Validate minimal structure
    if (!Array.isArray(suggestions.instantRecoverySnack)) suggestions.instantRecoverySnack = [];
    if (!Array.isArray(suggestions.recoveryMeal)) suggestions.recoveryMeal = [];

    console.log('Suggestions:', suggestions);

    return new Response(JSON.stringify({ 
      suggestions
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-fitness-screenshot:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
