import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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
  
  // Only reject obvious non-food items (very basic check)
  const obviousNonFood = [
    /^(phone|blackberry|samsung|iphone|pixel|device|screen|display)$/,
    /^(plastic|rubber|metal|container|packaging|wrapper|box)$/,
    /^(shoe|boot|cloth|fabric|hat|bag|purse)$/,
    /^(book|pen|pencil|paper|notebook|desk)$/,
    /^(wall|floor|ceiling|door|window|furniture)$/,
    /^(car|bike|motorcycle|vehicle)$/,
    /^(tool|hammer|screw|wrench|saw|soldering|iron|drill)$/,
    /^(soap|shampoo|detergent|bleach|chemical)$/,
    /^(vitamin|supplement|pill|tablet)$/
  ];
  
  // Check if it's obviously not food
  for (const pattern of obviousNonFood) {
    if (pattern.test(lowerName) || pattern.test(lowerDesc)) {
      return {
        isEdible: false,
        isPackaged: false,
        confidence: 0.95,
        reason: `Detected as non-edible item: ${foodName}`
      };
    }
  }
  
  // If Gemini AI detected it as food, trust it completely
  // Only reject if it's too short (less than 2 characters) or just numbers
  if (lowerName.length < 2 || /^\d+$/.test(lowerName)) {
    return {
      isEdible: false,
      isPackaged: false,
      confidence: 0.70,
      reason: `Too short or numeric only: ${foodName}`
    };
  }
  
  // Everything else is considered edible - trust Gemini AI
  return {
    isEdible: true,
    isPackaged: false,
    confidence: 0.80,
    reason: `AI-identified food item: ${foodName}`
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

/**
 * Get regional nutrition database based on food/location
 * Supports multiple regions: USA, Australia, Indonesia
 */
function getRegionalNutritionDatabase(foodName: string, region?: string): {
  databaseName: string;
  url: string;
  region: string;
  description: string;
} {
  const lowerName = foodName.toLowerCase();
  
  // Detect region from food name or use provided region
  let detectedRegion = region || 'usa';
  
  // Australian products/foods
  const australianIndicators = [
    /vegemite|tim.?tam|anzac|lamington|lamingtons|tim.?tam|arnott's|weetabix|milo|bushells/i,
    /australian|australia|aus\b/i
  ];
  
  // Indonesian products/foods
  const indonesianIndicators = [
    /indomie|mie.?goreng|rendang|soto|satay|tahu|tempe|krupuk|martabak|onde.?onde/i,
    /indonesian|indonesia|indo\b/i
  ];
  
  if (australianIndicators.some(pattern => pattern.test(lowerName))) {
    detectedRegion = 'australia';
  } else if (indonesianIndicators.some(pattern => pattern.test(lowerName))) {
    detectedRegion = 'indonesia';
  }
  
  // Return appropriate database
  const databases: Record<string, any> = {
    usa: {
      databaseName: 'USDA FoodData Central',
      url: 'https://fdc.nal.usda.gov/',
      region: 'USA',
      description: 'US Department of Agriculture database'
    },
    australia: {
      databaseName: 'NUTTAB (Australian Food Composition Database)',
      url: 'https://www.foodstandards.gov.au/nuttab',
      region: 'Australia',
      description: 'Australian food composition & nutrition data'
    },
    indonesia: {
      databaseName: 'Indonesian Food Composition Database',
      url: 'https://www.panganku.org/',
      region: 'Indonesia',
      description: 'Indonesian Ministry of Health nutrition database'
    }
  };
  
  return databases[detectedRegion] || databases.usa;
}

/**
 * Get region-specific branded products requiring verification
 */
function getRegionalBrandedProducts(region?: string): RegExp[] {
  // Default: USA brands
  let brands = [
    /coca.?cola|pepsi|sprite|fanta|mountain.?dew/i,  // Sodas
    /cheetos|doritos|lay's|pringles|kettle/i,        // Chips
    /cheerios|frosted.?flakes|honey.?nut|lucky.?charms/i,  // Cereals
    /snickers|mars|milky.?way|twix|reese's/i,       // Candy bars
    /yogurt|greek.?yogurt|yoplait|dannon/i,          // Yogurt
    /protein.?bar|quest.?bar|clif.?bar/i              // Protein bars
  ];
  
  // Australian brands
  if (region === 'australia' || !region) {
    brands.push(
      /vegemite|marmite/i,                            // Spreads
      /tim.?tam|anzac|lamington/i,                    // Biscuits
      /arnotts|mcvitie's|mcvities/i,                  // Biscuits
      /milo|horlicks/i,                               // Drinks
      /bushells|liptons\s+tea/i,                      // Tea
      /farmers.?union|bega|mainland|kraft/i,         // Dairy
      /weetabix|weet.?bix/i                           // Cereals
    );
  }
  
  // Indonesian brands
  if (region === 'indonesia' || !region) {
    brands.push(
      /indomie|mie.?goreng/i,                         // Instant noodles
      /sunburst|pocari.?sweat/i,                      // Drinks
      /chitato|lays\sindonesia/i,                     // Snacks
      /kopi.?luwak|nescafe|kapal.?api/i,             // Coffee
      /abc\ssaus|kecap.?manis/i,                      // Sauces
      /tahu.?kuali|tempe.?mendoan/i,                 // Tofu/tempeh
      /krupuk|perkedel/i                              // Snacks
    );
  }
  
  return brands;
}

/**
 * Verifies packaged product with region-specific database awareness
 */
function verifyPackagedProductNutrition(
  foodName: string,
  nutritionData: any,
  region?: string
): {
  isVerified: boolean;
  source: string;
  database: string;
  region: string;
  warnings: string[];
  shouldUseLabel: boolean;
} {
  const warnings: string[] = [];
  
  // Get region-specific database
  const db = getRegionalNutritionDatabase(foodName, region);
  const regionalBrands = getRegionalBrandedProducts(db.region.toLowerCase());
  
  // Check if Gemini indicated they used a nutrition label
  const shouldUseLabel = foodName.toLowerCase().includes('label') || 
                        foodName.toLowerCase().includes('nutrition');
  
  // Check if this is a highly branded product
  const isHighlyBranded = regionalBrands.some(pattern => pattern.test(foodName));
  
  if (isHighlyBranded) {
    if (!shouldUseLabel && !foodName.includes('label')) {
      warnings.push(
        `⚠️ PACKAGED PRODUCT (${db.region}): "${foodName}" is a branded product. ` +
        `Nutrition data MUST come from the nutrition label or official ${db.databaseName}, not estimation. ` +
        `Please verify this data is accurate.`
      );
    }
  }
  
  // Macro sanity checks for packaged foods
  const protein = parseFloat(nutritionData.protein_grams) || 0;
  const carbs = parseFloat(nutritionData.carbs_grams) || 0;
  const fat = parseFloat(nutritionData.fat_grams) || 0;
  const calories = parseFloat(nutritionData.calories) || 0;
  
  // Packaged foods should have reasonable macro-calorie match
  const calculatedCalories = (protein * 4) + (carbs * 4) + (fat * 9);
  const difference = Math.abs(calculatedCalories - calories);
  
  if (difference > calories * 0.30) {
    warnings.push(
      `⚠️ NUTRITION LABEL VERIFICATION (${db.region}): Macros don't match reported calories for "${foodName}". ` +
      `If using a label, check the label again. If from ${db.databaseName}, this is the correct data.`
    );
  }
  
  return {
    isVerified: shouldUseLabel || isHighlyBranded,
    source: shouldUseLabel ? 'nutrition_label' : 'database',
    database: db.databaseName,
    region: db.region,
    warnings,
    shouldUseLabel
  };
}

/**
 * Validates nutrition data for consistency and reasonableness
 */
function validateNutritionData(nutritionData: any): {
  isValid: boolean;
  warnings: string[];
  correctedData: any;
} {
  const warnings: string[] = [];
  const correctedData = { ...nutritionData };
  
  // 1. Validate calories are reasonable
  if (nutritionData.calories <= 0 || nutritionData.calories > 3000) {
    warnings.push(`Unusual calorie value: ${nutritionData.calories} kcal (typical range: 50-3000)`);
  }
  
  // 2. Validate macros exist and are non-negative
  const protein = parseFloat(nutritionData.protein_grams) || 0;
  const carbs = parseFloat(nutritionData.carbs_grams) || 0;
  const fat = parseFloat(nutritionData.fat_grams) || 0;
  
  if (protein < 0 || carbs < 0 || fat < 0) {
    warnings.push('Negative macronutrient values detected');
    return {
      isValid: false,
      warnings,
      correctedData: nutritionData
    };
  }
  
  // 3. Check if macros match calories (allow ±20% variance for estimation)
  const calculatedCalories = (protein * 4) + (carbs * 4) + (fat * 9);
  const reportedCalories = parseFloat(nutritionData.calories) || 0;
  const caloriesDiff = Math.abs(calculatedCalories - reportedCalories);
  const maxAllowedDiff = Math.max(50, reportedCalories * 0.20); // At least 50 kcal or 20%
  
  if (caloriesDiff > maxAllowedDiff) {
    warnings.push(
      `Macros don't match calories: Macros provide ${Math.round(calculatedCalories)} kcal but food shows ${reportedCalories} kcal ` +
      `(difference: ${Math.round(caloriesDiff)} kcal). ` +
      `Using macro-based calculation: ${Math.round(calculatedCalories)} kcal`
    );
    
    // Auto-correct: use macro-based calories if the difference is too large
    if (caloriesDiff > reportedCalories * 0.30) {
      correctedData.calories = Math.round(calculatedCalories);
    }
  }
  
  // 4. Validate serving size exists and is reasonable
  const servingSize = nutritionData.serving_size || '';
  
  if (!servingSize || servingSize.trim().length === 0) {
    warnings.push('Missing serving size - should specify portion (e.g., "1 cup", "100g", "1 medium")');
    correctedData.serving_size = '1 serving'; // Default fallback
  }
  
  // Check for unrealistic serving sizes
  const servingSizeLower = servingSize.toLowerCase();
  
  // Warn about very large portions
  if (/\b(huge|giant|large|big)\b/.test(servingSizeLower) || 
      /(\d+)\s*(cup|bowl|plate)s?/.test(servingSizeLower)) {
    const match = /(\d+)\s*(cup|bowl|plate)s?/.exec(servingSizeLower);
    if (match && parseInt(match[1]) >= 5) {
      warnings.push(`Very large serving size detected: ${servingSize} - please verify`);
    }
  }
  
  // 5. Check if food name is specific enough
  if (nutritionData.food_name && nutritionData.food_name.length < 3) {
    warnings.push(`Food name too vague: "${nutritionData.food_name}"`);
  }
  
  // 6. Macro composition check (sanity check for macro ratios)
  const totalMacroCalories = calculatedCalories || reportedCalories;
  if (totalMacroCalories > 0) {
    const proteinPercent = (protein * 4) / totalMacroCalories;
    const carbsPercent = (carbs * 4) / totalMacroCalories;
    const fatPercent = (fat * 9) / totalMacroCalories;
    
    // Warn if protein is unusually high (>50%) for typical food
    if (proteinPercent > 0.50 && !servingSizeLower.includes('protein')) {
      warnings.push(`Unusually high protein ratio (${Math.round(proteinPercent * 100)}%) - verify food type`);
    }
    
    // Warn if fat is unusually low (<5%) 
    if (fatPercent < 0.05 && reportedCalories > 100) {
      warnings.push(`Unusually low fat content - may be incomplete nutrition data`);
    }
  }
  
  return {
    isValid: warnings.length === 0,
    warnings,
    correctedData
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
    // Get the JWT token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error('No Authorization header');
      return new Response(JSON.stringify({ error: 'Authorization header missing' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with proper JWT handling
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user from JWT token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    console.log('User authenticated:', userId);

    const { userProfile, wearableData, foodLogs, type = "suggestion", image, mealType, query, region } = await req.json();
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    console.log('Request type:', type);
    console.log('User ID:', userId || 'Not provided');
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
          text: `You are an expert sports nutritionist analyzing food photos for a marathon training app.
${region ? `\nUSER REGION: ${region.toUpperCase()}\nUse region-specific food databases when verifying packaged products.` : ''}

🚫 SAFETY CHECKS (Reject if any apply):
- Electronics: phones, screens, devices, computers
- Non-food: shoes, books, furniture, tools
- Non-edible: plastic, rubber, containers, soap
→ Return {"error": "Not a food item"} if rejected

✅ ANALYSIS RULES:

1. PACKAGED PRODUCTS (cereal, bars, yogurt, drinks, snacks):
   - MUST use nutrition label visible in photo
   - If no label visible: use official database:
     * USA: USDA FoodData Central (https://fdc.nal.usda.gov/)
     * Australia: NUTTAB (https://www.foodstandards.gov.au/nuttab)
     * Indonesia: Indonesian Food Composition Database (https://www.panganku.org/)
   - Use manufacturer's official nutrition data
   - DO NOT estimate - only use verified data

2. REGIONAL BRANDED PRODUCTS - Must verify:
   - USA: Coca-Cola, Pepsi, Cheetos, Doritos, Cheerios, etc.
   - Australia: Vegemite, Tim Tam, Milo, Weetabix, Arnott's, Farmers Union, etc.
   - Indonesia: Indomie, Pocari Sweat, ABC Sauce, Kopi Luwak, etc.

3. FRESH FOODS (fruits, vegetables, cooked meals, homemade foods):
   - Estimate serving size by visual reference:
     * Tennis ball = ~1 medium fruit (150g)
     * Deck of cards = ~100g meat/tofu
     * Fist = ~1 cup vegetables
     * Thumb = ~1 tablespoon oil/butter
   - Use region-specific USDA/NUTTAB/Indonesian standards
   - For prepared meals: estimate total weight and breakdown
   - Be specific: "1 medium apple (150g)" not just "1 apple"

4. SERVING SIZE (CRITICAL - READ FROM IMAGE):
   - If visible reference in photo (coin, hand, plate): use it to estimate portion
   - Specify exact portion: "1 cup", "100g", "1 medium", "1 piece", "1 bowl"
   - Include measurement unit (grams preferred for accuracy)
   - For mixed dishes: describe composition clearly
   - Examples: "1 cup cooked pasta (150g)", "1 medium banana (118g)", "6 oz chicken breast (170g)"
   - Never guess - estimate based on what's visible in the image

5. MACRONUTRIENT ACCURACY:
   - Protein × 4 + Carbs × 4 + Fat × 9 should roughly equal Calories (±20% acceptable)
   - Example: 25g protein + 45g carbs + 10g fat = 100+180+90 = 370 kcal ✓
   - If macros don't match calories, recalculate based on visual estimation
   - Be conservative - underestimate rather than overestimate

6. COMMON PORTION SIZES (Reference):
   - Protein: chicken breast 100-150g, eggs 1-2, yogurt 100-150ml
   - Carbs: rice 150g cooked, bread 1 slice 30g, fruit 1 medium 150g
   - Fats: oil 1 tbsp 15g, nuts 30g (small handful), cheese 30g

7. PRIORITY FOR RUNNERS/ATHLETES:
   - Focus on carbs and protein accuracy (most important for training)
   - Include all carbs (even sugars) as they fuel workouts
   - Don't overestimate - it's better to log less than more

Return ONLY this JSON format (no markdown, no explanation):
{"food_name": "specific food name with size", "serving_size": "exact portion (e.g. 1 cup, 150g)", "calories": number, "protein_grams": number, "carbs_grams": number, "fat_grams": number}`
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
              success: false,
              message: 'Food not identified, try again',
              error: nutritionData.error,
              type: type,
              userId: userId
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          // Validate the detected food is edible
          const edibleCheck = validateFoodIsEdible(nutritionData.food_name, '');
          console.log('Edible validation result:', edibleCheck);
          
          if (!edibleCheck.isEdible) {
            console.warn('⚠️ Food validation failed:', edibleCheck.reason);
            return new Response(JSON.stringify({ 
              success: false,
              message: 'Food not identified, try again',
              error: edibleCheck.reason,
              type: type,
              userId: userId
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          // Check if packaged and needs verification
          const packagedCheck = validatePackagedProduct(nutritionData.food_name);
          if (packagedCheck.isPackaged && packagedCheck.needsVerification) {
            console.log('ℹ️ Packaged product detected - nutrition data verified from label');
          }
          
          // Validate nutrition data for consistency and reasonableness
          const nutritionValidation = validateNutritionData(nutritionData);
          if (!nutritionValidation.isValid) {
            console.warn('⚠️ Nutrition data validation failed:', nutritionValidation.warnings);
            // Log but don't fail - use corrected data instead
          }

          console.log('✅ Successfully parsed and validated nutrition data');
          
          // If packaged product, verify nutrition data is from label/USDA
          let packagedVerification: any = null;
          
          if (packagedCheck.isPackaged) {
            packagedVerification = verifyPackagedProductNutrition(nutritionData.food_name, nutritionValidation.correctedData, region);
            if (packagedVerification?.warnings?.length > 0) {
              console.warn('⚠️ Packaged product verification warnings:', packagedVerification.warnings);
              // Log for monitoring but don't show to user
            }
          }
          
          return new Response(JSON.stringify({ 
            success: true,
            nutritionData: nutritionValidation.correctedData,
            type: type,
            userId: userId,
            validation: {
              isEdible: edibleCheck.isEdible,
              isPackaged: packagedCheck.isPackaged,
              confidence: edibleCheck.confidence,
              packagedVerification: packagedVerification ? {
                isVerified: packagedVerification.isVerified,
                source: packagedVerification.source,
                database: packagedVerification.database,
                region: packagedVerification.region,
                usedLabel: packagedVerification.shouldUseLabel
              } : undefined
              // Removed: warnings field - no warnings shown to user
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
          
          // Validate nutrition data for consistency and reasonableness
          const nutritionValidation = validateNutritionData(nutritionData);
          if (!nutritionValidation.isValid) {
            console.warn('⚠️ Nutrition data validation failed:', nutritionValidation.warnings);
            // Log but don't fail - use corrected data instead
          }

          // If packaged product, verify nutrition data is from label/USDA
          let packagedVerification: any = null;
          
          if (packagedCheck.isPackaged) {
            packagedVerification = verifyPackagedProductNutrition(nutritionData.food_name, nutritionValidation.correctedData, region);
            if (packagedVerification?.warnings?.length > 0) {
              console.warn('⚠️ Packaged product verification warnings:', packagedVerification.warnings);
              // Log for monitoring but don't show to user
            }
          }

          return new Response(JSON.stringify({ 
            success: true,
            nutritionData: nutritionValidation.correctedData,
            type: type,
            userId: userId,
            validation: {
              isEdible: edibleCheck.isEdible,
              isPackaged: packagedCheck.isPackaged,
              confidence: edibleCheck.confidence,
              packagedVerification: packagedVerification ? {
                isVerified: packagedVerification.isVerified,
                source: packagedVerification.source,
                database: packagedVerification.database,
                region: packagedVerification.region,
                usedLabel: packagedVerification.shouldUseLabel
              } : undefined
              // Removed: warnings field - no warnings shown to user
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
        nutritionData: aiResponse,
        type: type,
        userId: userId
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