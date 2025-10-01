import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai";

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
    const { userProfile, wearableData, foodLogs, type = "suggestion", image, mealType, query } = await req.json();
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    console.log('Request type:', type);
    console.log('Has image:', !!image);
    console.log('Has GROQ_API_KEY:', !!GROQ_API_KEY);
    console.log('Has GEMINI_API_KEY:', !!GEMINI_API_KEY);
    
    if (!GROQ_API_KEY) {
      console.error('No GROQ API key configured');
      return new Response(JSON.stringify({ 
        error: 'AI is not configured. Please set GROQ_API_KEY.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let systemPrompt = "";
    let prompt = "";
    let messages: any[] = [];

    if (type === "food_photo") {
      // Food photo analysis using Google GenAI SDK with Gemini 2.5 Flash
      if (!image) {
        throw new Error('Image is required for food photo analysis');
      }

      if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is required for food photo analysis');
      }

      // Initialize Google GenAI
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      // Prepare the image data
      const imageData = image.includes(',') ? image.split(',')[1] : image;
      
      const contents = [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: imageData,
          },
        },
        { 
          text: `You are an expert nutritionist. Analyze the food in the image and provide detailed nutritional information. Be as accurate as possible based on typical serving sizes.

Analyze this food image and return nutrition data in this exact JSON format: {"food_name": "name of the food", "serving_size": "estimated serving size", "calories": number, "protein_grams": number, "carbs_grams": number, "fat_grams": number}. Only return the JSON, no other text.`
        },
      ];

      console.log('Sending food photo to Gemini 2.5 Flash...');
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
      });

      console.log('Gemini response received for food photo');
      const aiResponse = response.text;
      console.log('Raw Gemini response:', aiResponse);

      // Parse the JSON response
      try {
        // Remove markdown code blocks if present
        let cleanedResponse = aiResponse.trim();
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/^```json\s*\n/, '').replace(/\n```\s*$/, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '');
        }
        
        const nutritionData = JSON.parse(cleanedResponse);
        return new Response(JSON.stringify({ 
          nutritionData,
          type: type 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (parseError) {
        console.error('Failed to parse nutrition data:', aiResponse);
        return new Response(JSON.stringify({ 
          error: 'Failed to parse nutrition data from AI response' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (type === "food_search") {
      // Web-based food search
      if (!query) {
        throw new Error('Query is required for food search');
      }

      systemPrompt = `You are a nutrition database expert. When given a food name, provide accurate nutritional information based on standard USDA database values and common serving sizes.`;
      
      prompt = `Provide detailed nutrition information for: "${query}". Return data in this exact JSON format: {"food_name": "specific food name", "serving_size": "typical serving size (e.g., 1 cup, 100g, 1 medium)", "calories": number, "protein_grams": number, "carbs_grams": number, "fat_grams": number}. Use standard serving sizes and accurate USDA values. Only return the JSON, no other text.`;
      
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];
    } else if (type === "suggestion") {
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

    // For non-food-photo types, use Groq
    if (type !== "food_photo") {
      // Prepare messages based on type
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];

      console.log('Sending request to GROQ API with', messages.length, 'messages');
      
      const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
      const model = 'llama-3.1-8b-instant';

      console.log('Provider: groq, Model:', model);

      const requestBody = {
        model,
        messages,
        temperature: 0.7,
        max_completion_tokens: 300,
        top_p: 1,
        stream: false
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('AI API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Groq API error:', response.status, errorText);
        
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'Payment required, please add funds to your AI provider account.' }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (response.status === 401) {
          return new Response(JSON.stringify({ error: 'Invalid API key. Please contact support.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        return new Response(JSON.stringify({ 
          error: 'AI gateway error', 
          details: `Provider: groq, Status: ${response.status}, Response: ${errorText}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      // For food search, parse the JSON response
      if (type === "food_search") {
        try {
          // Remove markdown code blocks if present
          let cleanedResponse = aiResponse.trim();
          if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*\n/, '').replace(/\n```\s*$/, '');
          } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '');
          }
          
          const nutritionData = JSON.parse(cleanedResponse);
          return new Response(JSON.stringify({ 
            nutritionData,
            type: type 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (parseError) {
          console.error('Failed to parse nutrition data:', aiResponse);
          return new Response(JSON.stringify({ 
            error: 'Failed to parse nutrition data from AI response' 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ 
        suggestion: aiResponse,
        type: type 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in nutrition-ai function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Full error details:', error);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});