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
    const { image } = await req.json();
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
    const systemPrompt = `You are an expert fitness and nutrition AI assistant. Analyze fitness app screenshots to extract body metrics and provide personalized nutrition recommendations.

Your task:
1. Extract body metrics from the image (weight, height, body fat %, muscle mass, BMI, age, gender, activity level)
2. Calculate appropriate macro recommendations based on the extracted data
3. Suggest specific meals that align with the macro goals

Return ONLY a valid JSON object with this exact structure:
{
  "bodyMetrics": {
    "weight": number (in kg),
    "height": number (in cm),
    "bodyFat": number (percentage),
    "muscleMass": number (in kg),
    "bmi": number,
    "age": number,
    "gender": "male" | "female",
    "activityLevel": "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extremely_active"
  },
  "macroRecommendations": {
    "calories": number,
    "protein": number (in grams),
    "carbs": number (in grams),
    "fat": number (in grams),
    "proteinPercentage": number (percentage of calories),
    "carbsPercentage": number (percentage of calories),
    "fatPercentage": number (percentage of calories)
  },
  "mealSuggestions": [
    {
      "name": string,
      "description": string,
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "foods": [string array of food items]
    }
  ],
  "analysis": "Brief summary of what you found and your recommendations"
}

Guidelines:
- If a metric is not visible or unclear, omit it from the response
- Use standard formulas for BMI calculation if weight/height are available
- Base macro recommendations on the person's goals (weight loss, maintenance, or muscle gain)
- Suggest 3-5 practical meal options
- Be realistic and practical with recommendations
- If the image shows workout data, consider it for activity level assessment`;

    const userPrompt = `Analyze this fitness app screenshot and extract all available body metrics, then provide personalized nutrition recommendations.`;

    // Prepare the image data
    const imageData = image.includes(',') ? image.split(',')[1] : image;
    
    const contents = [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageData,
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
    let analysisResult;
    try {
      // Clean up the response text to extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      analysisResult = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', parseError);
      console.error('Response text:', responseText);
      
      // Fallback: create a basic response structure
      analysisResult = {
        bodyMetrics: {
          weight: null,
          height: null,
          bodyFat: null,
          muscleMass: null,
          bmi: null,
          age: null,
          gender: null,
          activityLevel: "moderately_active"
        },
        macroRecommendations: {
          calories: 2000,
          protein: 150,
          carbs: 200,
          fat: 70,
          proteinPercentage: 30,
          carbsPercentage: 40,
          fatPercentage: 30
        },
        mealSuggestions: [
          {
            name: "Balanced Breakfast",
            description: "A nutritious start to your day",
            calories: 400,
            protein: 25,
            carbs: 35,
            fat: 15,
            foods: ["eggs", "oatmeal", "berries", "almonds"]
          },
          {
            name: "Protein-Packed Lunch",
            description: "Satisfying midday meal",
            calories: 500,
            protein: 35,
            carbs: 40,
            fat: 20,
            foods: ["chicken breast", "quinoa", "vegetables", "olive oil"]
          },
          {
            name: "Light Dinner",
            description: "Evening meal for recovery",
            calories: 450,
            protein: 30,
            carbs: 30,
            fat: 25,
            foods: ["salmon", "sweet potato", "broccoli", "avocado"]
          }
        ],
        analysis: "Unable to fully analyze the image. Here are general nutrition recommendations based on a moderate activity level."
      };
    }

    // Validate and clean up the response
    if (!analysisResult.bodyMetrics) {
      analysisResult.bodyMetrics = {};
    }
    if (!analysisResult.macroRecommendations) {
      analysisResult.macroRecommendations = {
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 70,
        proteinPercentage: 30,
        carbsPercentage: 40,
        fatPercentage: 30
      };
    }
    if (!analysisResult.mealSuggestions) {
      analysisResult.mealSuggestions = [];
    }
    if (!analysisResult.analysis) {
      analysisResult.analysis = "Analysis completed successfully.";
    }

    console.log('Analysis result:', analysisResult);

    return new Response(JSON.stringify({ 
      analysisResult 
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
