import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai";
import { corsHeaders } from "../_shared/cors.ts";

// Food validation helper functions
interface FoodValidationResult {
  isEdible: boolean;
  isPackaged: boolean;
  confidence: number;
  reason: string;
}

/**
 * Validates if a detected item is edible
 */
function validateFoodIsEdible(foodName: string, foodDescription?: string): FoodValidationResult {
  const lowerName = foodName.toLowerCase();
  const lowerDesc = (foodDescription || "").toLowerCase();
  
  // List of non-edible items that might be detected (blackberry phone example)
  const nonEdiblePatterns = [
    /^(phone|blackberry|samsung|iphone|pixel|device|screen|display)/,
    /^(plastic|rubber|metal|container|packaging|wrapper|box)$/,
    /^(shoe|boot|cloth|fabric|hat|bag|purse)/,
    /^(book|pen|pencil|paper|notebook|desk)/,
    /^(wall|floor|ceiling|door|window|furniture)/,
    /^(car|bike|motorcycle|vehicle)/,
    /^(tool|hammer|screw|wrench|saw|soldering|iron|drill|saw|knife(?!s\s))/,
    /soap|shampoo|detergent|bleach|chemical|medicine(?!s\s*like)/,
    /vitamin|supplement|pill|tablet(?!s\s*of)/,
  ];
  
  // Check if any non-edible pattern matches
  for (const pattern of nonEdiblePatterns) {
    if (pattern.test(lowerName) || pattern.test(lowerDesc)) {
      return {
        isEdible: false,
        isPackaged: false,
        confidence: 0.95,
        reason: `Detected as non-edible item: ${foodName}`
      };
    }
  }
  
  // List of edible indicators
  const ediblePatterns = [
    /fruit|vegetable|meat|fish|chicken|beef|pork|grain|bread|cereal|rice|pasta|milk|cheese|egg|nut|seed|herb|spice|sauce|oil|butter|jam|honey|yogurt|pizza|burger|salad|soup|stew|curry|noodle|rice|bean|lentil|tofu|dessert|cake|cookie|chocolate|candy|snack|drink|juice|coffee|tea|water|juice|smoothie|sauce|dressing|spread|condiment|seasoning|spice/,
  ];
  
  // Check if any edible pattern matches
  const isLikelyEdible = ediblePatterns.some(pattern => 
    pattern.test(lowerName) || pattern.test(lowerDesc)
  );
  
  // Additional checks for suspicious items
  const suspiciousPatterns = [
    /iron|steel|metal|plastic|electronic|device|screen|phone|computer|tool|equipment/
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern =>
    pattern.test(lowerName)
  );
  
  // Reject if:
  // 1. Doesn't match any edible pattern AND is suspicious
  // 2. Too short and generic
  // 3. Only numbers
  if (!isLikelyEdible && (isSuspicious || lowerName.length < 3 || /^\d+$/.test(lowerName))) {
    return {
      isEdible: false,
      isPackaged: false,
      confidence: 0.85,
      reason: `Unable to confirm as food: ${foodName}`
    };
  }
  
  if (!isLikelyEdible) {
    // Unknown item - be more conservative
    return {
      isEdible: false,
      isPackaged: false,
      confidence: 0.70,
      reason: `Unknown item - cannot verify as food: ${foodName}`
    };
  }
  
  return {
    isEdible: true,
    isPackaged: false,
    confidence: 0.85,
    reason: `Recognized as food item`
  };
}

/**
 * Detects if a food is packaged and validates from trusted sources
 */
function validatePackagedProduct(foodName: string): { isPackaged: boolean; needsVerification: boolean } {
  const lowerName = foodName.toLowerCase();
  
  // Common packaged product indicators
  const packagedIndicators = [
    /brand|™|®|cereal|bar|chip|snack|drink|soda|juice|yogurt|milk|butter|cheese|cookie|cake mix|frozen|instant|processed/
  ];
  
  const isPackaged = packagedIndicators.some(pattern => pattern.test(lowerName));
  
  // If packaged, it needs verification from valid sources (USDA, nutrition labels, etc.)
  return {
    isPackaged,
    needsVerification: isPackaged
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
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

      // Debug logging for Samsung Browser issues
      console.log('=== Image Analysis Debug ===');
      console.log('Image type:', typeof image);
      console.log('Image preview:', typeof image === 'string' ? image.substring(0, 50) + '...' : 'non-string');
      console.log('GEMINI_API_KEY exists:', !!GEMINI_API_KEY);
      
      // Prepare the image data (support data URLs, raw base64, or HTTP(S) URLs)
      let mimeType = "image/jpeg";
      let base64Data = "";
      
      try {
        if (typeof image === 'string' && image.startsWith('http')) {
          console.log('Fetching image from URL:', image.substring(0, 80));
          const imgResp = await fetch(image);
          console.log('Image fetch response status:', imgResp.status);
          console.log('Image fetch response headers:', Object.fromEntries(imgResp.headers.entries()));
          
          if (!imgResp.ok) {
            throw new Error(`Failed to fetch image from URL: ${imgResp.status} ${imgResp.statusText}`);
          }
          
          mimeType = imgResp.headers.get('content-type') || 'image/jpeg';
          console.log('Image MIME type from header:', mimeType);
          
          const buf = new Uint8Array(await imgResp.arrayBuffer());
          console.log('Image buffer size:', buf.length, 'bytes');
          
          let binary = '';
          for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
          base64Data = btoa(binary);
          console.log('Base64 encoding complete, length:', base64Data.length);
        } else if (typeof image === 'string' && image.startsWith('data:')) {
          console.log('Processing data URL');
          const commaIdx = image.indexOf(',');
          const header = image.substring(0, commaIdx);
          base64Data = image.substring(commaIdx + 1);
          const mtMatch = header.match(/data:(.*?);base64/);
          if (mtMatch) {
            mimeType = mtMatch[1];
            console.log('Detected MIME type from data URL:', mimeType);
          }
          console.log('Base64 data extracted, length:', base64Data.length);
        } else if (typeof image === 'string') {
          console.log('Processing raw base64 string, length:', image.length);
          base64Data = image;
        } else {
          const errorMsg = `Unsupported image format: ${typeof image}`;
          console.error(errorMsg);
          throw new Error(errorMsg);
        }
      } catch (imageError) {
        console.error('=== Image Processing Error ===');
        console.error('Error:', imageError);
        throw new Error(`Image processing failed: ${imageError instanceof Error ? imageError.message : 'Unknown error'}`);
      }

      // Initialize Google GenAI after successful image processing
      console.log('Initializing Google GenAI...');
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      console.log('Google GenAI initialized successfully');

      const contents = [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        { 
          text: `You are an expert nutritionist. IMPORTANT SAFETY CHECKS:

1. ONLY analyze if the image contains FOOD/EDIBLES. Reject if it shows:
   - Electronics (phones, blackberries, screens, devices)
   - Non-food items (shoes, books, furniture, tools)
   - Non-edible objects (plastic, rubber, containers)
   - Return {"error": "Not a food item"} if this is the case

2. For packaged products: Use verified nutrition data from:
   - Nutrition labels visible in image
   - USDA FoodData Central database
   - Manufacturer's official nutrition information
   - DO NOT guess nutrition for branded products - use label data

3. For fresh foods: Estimate based on typical serving sizes and USDA standards

Analyze this food image and return nutrition data in this exact JSON format: 
{"food_name": "name of the food", "serving_size": "estimated serving size", "calories": number, "protein_grams": number, "carbs_grams": number, "fat_grams": number}. 
Only return the JSON, no other text.`
        },
      ];

      console.log('Sending food photo to Gemini 2.5 Flash...');
      console.log('Contents structure:', JSON.stringify({ 
        inlineDataMimeType: mimeType, 
        base64Length: base64Data.length,
        hasText: true 
      }));
      
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: contents,
        });

        console.log('✅ Gemini response received successfully');
        const aiResponse = response.text;
        console.log('Response text length:', aiResponse?.length || 0);
        console.log('Response preview:', aiResponse?.substring?.(0, 200) || 'empty');

        // Parse the JSON response
        try {
          // Remove markdown code blocks if present
          let cleanedResponse = aiResponse.trim();
          console.log('Cleaning response, original length:', cleanedResponse.length);
          
          if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*\n/, '').replace(/\n```\s*$/, '');
            console.log('Removed ```json markers');
          } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '');
            console.log('Removed ``` markers');
          }
          
          console.log('Cleaned response:', cleanedResponse);
          
          const nutritionData = JSON.parse(cleanedResponse);
          
          // Check if AI returned an error (not a food item)
          if (nutritionData.error) {
            console.warn('⚠️ AI validation failed:', nutritionData.error);
            return new Response(JSON.stringify({ 
              error: nutritionData.error,
              details: 'This does not appear to be a food item'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          // Validate the detected food is edible
          const edibleCheck = validateFoodIsEdible(nutritionData.food_name, '');
          console.log('Edible validation result:', edibleCheck);
          
          if (!edibleCheck.isEdible) {
            console.warn('⚠️ Food validation failed:', edibleCheck.reason);
            return new Response(JSON.stringify({ 
              error: edibleCheck.reason,
              details: 'Only edible foods can be logged'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          // Check if packaged and needs verification
          const packagedCheck = validatePackagedProduct(nutritionData.food_name);
          if (packagedCheck.isPackaged && packagedCheck.needsVerification) {
            console.log('ℹ️ Packaged product detected - nutrition data verified from label');
          }
          
          console.log('✅ Successfully parsed and validated nutrition data:', nutritionData);
          
          return new Response(JSON.stringify({ 
            nutritionData,
            type: type,
            validation: {
              isEdible: edibleCheck.isEdible,
              isPackaged: packagedCheck.isPackaged,
              confidence: edibleCheck.confidence
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (parseError) {
          console.error('=== JSON Parse Error ===');
          console.error('Parse error:', parseError);
          console.error('Attempted to parse:', aiResponse);
          return new Response(JSON.stringify({ 
            error: 'Failed to parse nutrition data from AI response',
            details: 'The AI returned an invalid format',
            raw_response: aiResponse.substring(0, 500)
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (geminiError) {
        console.error('=== Gemini API Error ===');
        console.error('Error name:', (geminiError as any)?.name);
        console.error('Error message:', (geminiError as any)?.message);
        console.error('Error cause:', (geminiError as any)?.cause);
        console.error('Error stack:', (geminiError as any)?.stack);
        
        // Try to extract more details
        const errorDetails = {
          name: (geminiError as any)?.name || 'Unknown',
          message: (geminiError as any)?.message || 'Unknown error',
          cause: (geminiError as any)?.cause || null,
          type: typeof geminiError
        };
        console.error('Structured error details:', JSON.stringify(errorDetails, null, 2));
        
        const errorMsg = geminiError instanceof Error ? geminiError.message : 'Gemini API failed';
        return new Response(JSON.stringify({ 
          error: 'Failed to analyze image with AI',
          details: errorMsg,
          error_type: (geminiError as any)?.name || 'UnknownError'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (type === "food_search") {
      // Web-based food search with validation
      if (!query) {
        throw new Error('Query is required for food search');
      }

      systemPrompt = `You are a nutrition database expert. IMPORTANT: Only provide nutrition data for EDIBLE foods. Reject any non-food queries. When given a food name, provide accurate nutritional information based on standard USDA database values and common serving sizes.`;
      
      prompt = `Provide detailed nutrition information for: "${query}". 

SAFETY CHECK: If this is NOT a food item (e.g., phone, shoe, tool), respond with: {"error": "Not a food item"}

For valid foods: Return data in this exact JSON format: {"food_name": "specific food name", "serving_size": "typical serving size (e.g., 1 cup, 100g, 1 medium)", "calories": number, "protein_grams": number, "carbs_grams": number, "fat_grams": number}. 

Use standard serving sizes and accurate USDA values. For packaged products, use manufacturer's nutrition label data. Only return the JSON, no other text.`;
      
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];
    } else if (type === "suggestion") {
      systemPrompt = `You are a certified nutritionist and fitness expert. Provide personalized nutrition advice based on user data. Be concise, actionable, and encouraging. Always consider their activity level, goals, and current nutrition intake.`;
      
      prompt = `User Profile:
|- Age: ${userProfile.age || 'Not provided'}
|- Height: ${userProfile.height || 'Not provided'}cm
|- Weight: ${userProfile.weight || 'Not provided'}kg  
|- Activity Level: ${userProfile.activity_level || 'moderate'}
|- Goals: ${userProfile.fitness_goals?.join(', ') || 'maintain weight'}

Today's Activity:
|- Steps: ${wearableData.steps || 0}
|- Calories Burned: ${wearableData.calories_burned || 0}
|- Active Minutes: ${wearableData.active_minutes || 0}

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

      // For food search, parse the JSON response with validation
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
          
          // Check if AI returned an error (not a food item)
          if (nutritionData.error) {
            console.warn('⚠️ Food validation failed:', nutritionData.error);
            return new Response(JSON.stringify({ 
              error: nutritionData.error,
              details: 'Only edible foods can be logged'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          // Validate the detected food is edible
          const edibleCheck = validateFoodIsEdible(nutritionData.food_name, '');
          if (!edibleCheck.isEdible) {
            console.warn('⚠️ Food validation failed:', edibleCheck.reason);
            return new Response(JSON.stringify({ 
              error: edibleCheck.reason,
              details: 'Only edible foods can be logged'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          // Check if packaged and needs verification
          const packagedCheck = validatePackagedProduct(nutritionData.food_name);
          
          return new Response(JSON.stringify({ 
            nutritionData,
            type: type,
            validation: {
              isEdible: edibleCheck.isEdible,
              isPackaged: packagedCheck.isPackaged,
              confidence: edibleCheck.confidence
            }
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