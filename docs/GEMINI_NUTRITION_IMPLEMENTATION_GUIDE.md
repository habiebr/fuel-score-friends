# Gemini Nutrition Photo Analysis - Implementation Guide

## 🚀 Quick Start Template

Here's a production-ready implementation based on the best practices:

```typescript
import { GoogleGenAI } from "npm:@google/genai";

export async function analyzeFoodPhoto(image: string, region: string = 'us') {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // 1. Process image (support multiple formats)
  const { mimeType, base64Data } = await processImage(image);

  // 2. Generate comprehensive prompt
  const prompt = generateNutritionPrompt(region);

  // 3. Call Gemini with optimized settings
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      { inlineData: { mimeType, data: base64Data } },
      { text: prompt }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
      responseMimeType: "application/json"
    }
  });

  // 4. Process and validate response
  const nutritionData = await processGeminiResponse(response.text());

  // 5. Validate through multiple layers
  const validation = await validateNutritionData(nutritionData, region);

  return {
    success: validation.isValid,
    data: validation.correctedData,
    warnings: validation.warnings,
    confidence: validation.confidence
  };
}
```

## 🛠️ Core Functions Implementation

### 1. Image Processing Function
```typescript
async function processImage(image: string) {
  let mimeType = "image/jpeg";
  let base64Data = "";

  try {
    if (image.startsWith('http')) {
      // HTTP/HTTPS URLs
      const response = await fetch(image);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      mimeType = response.headers.get('content-type') || 'image/jpeg';
      const buffer = await response.arrayBuffer();
      base64Data = Buffer.from(buffer).toString('base64');

    } else if (image.startsWith('data:')) {
      // Data URLs: data:image/jpeg;base64,...
      const commaIdx = image.indexOf(',');
      const header = image.substring(0, commaIdx);
      base64Data = image.substring(commaIdx + 1);

      const mimeMatch = header.match(/data:(.*?);base64/);
      if (mimeMatch) mimeType = mimeMatch[1];

    } else {
      // Raw base64 strings
      base64Data = image;
    }

    return { mimeType, base64Data };

  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}
```

### 2. Comprehensive Prompt Generator
```typescript
function generateNutritionPrompt(region: string = 'us') {
  const regionalDatabases = {
    us: 'USDA FoodData Central',
    au: 'NUTTAB (Food Standards Australia)',
    id: 'Indonesian Food Composition Database'
  };

  const regionalBrands = {
    us: ['Coca-Cola', 'Pepsi', 'Cheetos', 'Doritos', 'Cheerios', 'Kellogg'],
    au: ['Vegemite', 'Tim Tam', 'Milo', 'Weetabix', 'Arnott\'s', 'Farmers Union'],
    id: ['Indomie', 'Pocari Sweat', 'ABC Sauce', 'Kopi Luwak', 'Ultra Milk']
  };

  return `You are an expert sports nutritionist analyzing food photos for athletes.

REGION: ${region.toUpperCase()}
PRIMARY DATABASE: ${regionalDatabases[region] || regionalDatabases['us']}
REGIONAL BRANDS: ${regionalBrands[region]?.join(', ') || 'None specified'}

🚫 SAFETY CHECKS (Reject if any apply):
- Electronics: phones, screens, devices, computers, keyboards
- Non-food: shoes, books, furniture, tools, clothing
- Non-edible: plastic, rubber, containers, soap, cleaning products
→ Return {"error": "Not a food item"} if rejected

✅ ANALYSIS FRAMEWORK:

1. FOOD TYPE CLASSIFICATION:
   - PACKAGED: Use visible nutrition label OR official database
   - FRESH: Estimate using visual references and standard portions
   - PREPARED: Break down ingredients and estimate total weight

2. SERVING SIZE ESTIMATION:
   - Use visual references: coin = 2.5cm, hand = ~15cm, plate = ~25cm
   - Standard portions: tennis ball = 150g fruit, deck of cards = 100g protein
   - Be specific: "1 medium apple (150g)" not "1 apple"

3. NUTRITION ACCURACY PRIORITIES:
   - Carbs: Critical for athletes (include all sugars)
   - Protein: Important for recovery
   - Fat: Conservative estimates
   - Calories: Should match macros within ±20%

4. DATABASE VERIFICATION:
   - Packaged products: Cross-reference with official nutrition data
   - Branded items: Use manufacturer specifications
   - Generic items: Use regional nutritional standards

Return ONLY valid JSON:
{
  "food_name": "specific food with exact portion",
  "serving_size": "detailed size description (e.g., 1 cup cooked, 150g)",
  "calories": number,
  "protein_grams": number,
  "carbs_grams": number,
  "fat_grams": number,
  "confidence": number,
  "source": "label|database|estimate",
  "region": "${region}"
}`;
}
```

### 3. Response Processing with Validation
```typescript
async function processGeminiResponse(aiResponse: string) {
  try {
    // Clean response (remove markdown if present)
    let cleanedResponse = aiResponse.trim();

    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const nutritionData = JSON.parse(cleanedResponse);

    // Check for AI rejection
    if (nutritionData.error) {
      throw new Error(`AI rejected: ${nutritionData.error}`);
    }

    // Validate required fields
    const required = ['food_name', 'serving_size', 'calories', 'protein_grams', 'carbs_grams', 'fat_grams'];
    for (const field of required) {
      if (!(field in nutritionData)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return nutritionData;

  } catch (error) {
    throw new Error(`Response processing failed: ${error.message}`);
  }
}
```

### 4. Multi-Layer Validation System
```typescript
async function validateNutritionData(nutritionData: any, region: string) {
  const validations = [];

  // 1. Basic structure validation
  const structureValid = validateStructure(nutritionData);
  validations.push({ check: 'structure', passed: structureValid });

  // 2. Edibility validation
  const edibleValid = validateEdibility(nutritionData.food_name);
  validations.push({ check: 'edibility', passed: edibleValid });

  // 3. Nutrition calculation validation
  const nutritionValid = validateNutritionCalculations(nutritionData);
  validations.push({ check: 'nutrition', passed: nutritionValid.passed });

  // 4. Portion size reasonableness
  const portionValid = validatePortionSize(nutritionData);
  validations.push({ check: 'portion', passed: portionValid });

  // 5. Regional verification (packaged products)
  const regionalValid = await validateRegionalData(nutritionData, region);
  validations.push({ check: 'regional', passed: regionalValid });

  // Calculate overall confidence
  const passedChecks = validations.filter(v => v.passed).length;
  const confidence = passedChecks / validations.length;

  // Determine if data is acceptable
  const isValid = passedChecks >= validations.length * 0.7; // 70% threshold

  return {
    isValid,
    confidence,
    correctedData: nutritionValid.correctedData || nutritionData,
    warnings: validations.filter(v => !v.passed).map(v => v.check),
    validations
  };
}
```

## 🎯 Use Case Examples

### Example 1: Packaged Product (Cereal Box)
```typescript
const result = await analyzeFoodPhoto(cerealBoxImage, 'us');
// Expected: Use nutrition label data for Cheerios
// Output: { food_name: "Cheerios cereal (1 cup)", calories: 140, ... }
```

### Example 2: Fresh Food (Apple)
```typescript
const result = await analyzeFoodPhoto(appleImage, 'us');
// Expected: Estimate using USDA data for medium apple
// Output: { food_name: "Medium apple (150g)", calories: 80, ... }
```

### Example 3: Prepared Meal (Sandwich)
```typescript
const result = await analyzeFoodPhoto(sandwichImage, 'us');
// Expected: Break down ingredients and estimate portions
// Output: { food_name: "Turkey sandwich (whole)", calories: 350, ... }
```

## 🔧 Advanced Features

### 1. Confidence Scoring
```typescript
function calculateConfidence(nutritionData: any, validations: any[]) {
  let confidence = 1.0;

  // Reduce confidence for estimates vs verified data
  if (nutritionData.source === 'estimate') confidence *= 0.8;
  if (nutritionData.source === 'database') confidence *= 0.95;
  if (nutritionData.source === 'label') confidence *= 1.0;

  // Reduce for validation failures
  const failedValidations = validations.filter(v => !v.passed).length;
  confidence *= Math.max(0.5, 1 - (failedValidations * 0.1));

  return Math.round(confidence * 100) / 100;
}
```

### 2. Regional Database Integration
```typescript
async function validateRegionalData(nutritionData: any, region: string) {
  if (!nutritionData.source || nutritionData.source === 'estimate') {
    return true; // Estimates don't need regional validation
  }

  const regionalDB = getRegionalDatabase(region);
  const verified = await regionalDB.verifyNutrition(nutritionData);

  return verified.isValid;
}
```

### 3. Batch Processing
```typescript
async function analyzeMultiplePhotos(images: string[], region: string) {
  const results = [];

  for (const image of images) {
    try {
      const result = await analyzeFoodPhoto(image, region);
      results.push(result);

      // Rate limiting to avoid API limits
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      results.push({ success: false, error: error.message });
    }
  }

  return results;
}
```

## 📊 Performance Monitoring

### 1. Key Metrics to Track
```typescript
const metrics = {
  totalRequests: 0,
  successfulAnalyses: 0,
  averageResponseTime: 0,
  errorRate: 0,
  validationFailureRate: 0,
  regionalAccuracy: {},
  foodTypeAccuracy: {}
};
```

### 2. Error Categorization
```typescript
const errorCategories = {
  api_errors: ['API timeout', 'Rate limit exceeded', 'Invalid API key'],
  parsing_errors: ['Invalid JSON', 'Missing fields', 'Malformed response'],
  validation_errors: ['Non-edible detected', 'Invalid nutrition data', 'Portion estimate failed'],
  regional_errors: ['Database unavailable', 'Brand not found', 'Regional mismatch']
};
```

## 🚀 Deployment Checklist

- [ ] Environment variables configured (GEMINI_API_KEY)
- [ ] Regional databases accessible
- [ ] Error monitoring in place
- [ ] Rate limiting implemented
- [ ] Fallback mechanisms tested
- [ ] Performance benchmarks established
- [ ] User feedback collection enabled

This implementation provides a robust, production-ready solution for AI-powered nutrition photo analysis using Gemini's vision capabilities.
