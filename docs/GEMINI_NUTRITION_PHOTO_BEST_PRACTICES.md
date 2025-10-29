# Gemini AI Best Practices for Nutrition Photo Analysis

## 📸 Current Implementation Analysis

Based on the existing `nutrition-ai` function, here are the **best practices** for using Gemini AI in nutrition/food photo analysis.

## 🎯 Core Architecture

### 1. **Multi-Format Image Support**
```typescript
// Support multiple image input formats
if (image.startsWith('http')) {
  // HTTP/HTTPS URLs
  const imgResp = await fetch(image);
  mimeType = imgResp.headers.get('content-type') || 'image/jpeg';
  const buf = new Uint8Array(await imgResp.arrayBuffer());
  base64Data = btoa(String.fromCharCode(...buf));
} else if (image.startsWith('data:')) {
  // Data URLs: data:image/jpeg;base64,...
  const commaIdx = image.indexOf(',');
  mimeType = image.substring(5, commaIdx).split(';')[0];
  base64Data = image.substring(commaIdx + 1);
} else {
  // Raw base64 strings
  base64Data = image;
}
```

### 2. **Model Selection: Gemini 2.5 Flash**
```typescript
import { GoogleGenAI } from "npm:@google/genai";

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Use the latest vision-capable model
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash", // Latest vision model
  contents: [
    { inlineData: { mimeType, data: base64Data } },
    { text: detailedPrompt }
  ],
});
```

## 📋 Prompt Engineering Best Practices

### 1. **Safety-First Approach**
```typescript
const prompt = `You are an expert sports nutritionist analyzing food photos for a marathon training app.

🚫 SAFETY CHECKS (Reject if any apply):
- Electronics: phones, screens, devices, computers
- Non-food: shoes, books, furniture, tools
- Non-edible: plastic, rubber, containers, soap
→ Return {"error": "Not a food item"} if rejected`
```

### 2. **Structured Analysis Framework**
```typescript
const prompt = `
✅ ANALYSIS RULES:

1. PACKAGED PRODUCTS (cereal, bars, yogurt, drinks, snacks):
   - MUST use nutrition label visible in photo
   - If no label: use official databases (USDA, NUTTAB, Indonesian Food Comp)
   - Use manufacturer's official nutrition data
   - DO NOT estimate - only use verified data

2. REGIONAL BRANDED PRODUCTS - Must verify:
   - USA: Coca-Cola, Pepsi, Cheetos, Doritos, Cheerios, etc.
   - Australia: Vegemite, Tim Tam, Milo, Weetabix, Arnott's, etc.
   - Indonesia: Indomie, Pocari Sweat, ABC Sauce, Kopi Luwak, etc.

3. FRESH FOODS (fruits, vegetables, cooked meals):
   - Estimate serving size by visual reference
   - Use region-specific standards
   - Be specific: "1 medium apple (150g)" not "1 apple"

4. SERVING SIZE (CRITICAL):
   - Use visual references in photo (coin, hand, plate)
   - Include measurement units (grams preferred)
   - Never guess - estimate based on visible elements

5. MACRONUTRIENT ACCURACY:
   - Protein×4 + Carbs×4 + Fat×9 ≈ Calories (±20% acceptable)
   - Be conservative - underestimate rather than overestimate

6. RUNNER-SPECIFIC FOCUS:
   - Prioritize carbs and protein accuracy
   - Include all carbs (even sugars) for workout fuel
   - Conservative estimates better than overestimates
`;
```

### 3. **JSON-Only Response Format**
```typescript
const prompt = `Return ONLY this JSON format (no markdown, no explanation):
{"food_name": "specific food name with size",
 "serving_size": "exact portion (e.g. 1 cup, 150g)",
 "calories": number,
 "protein_grams": number,
 "carbs_grams": number,
 "fat_grams": number}`
```

## 🔍 Validation Pipeline

### 1. **Multi-Layer Validation**
```typescript
// Layer 1: AI Error Detection
if (nutritionData.error) {
  return { success: false, message: 'Food not identified' };
}

// Layer 2: Edibility Validation
const edibleCheck = validateFoodIsEdible(nutritionData.food_name);
if (!edibleCheck.isEdible) {
  return { success: false, message: 'Non-edible item detected' };
}

// Layer 3: Nutrition Data Validation
const nutritionValidation = validateNutritionData(nutritionData);
if (!nutritionValidation.isValid) {
  console.warn('Nutrition validation warnings:', nutritionValidation.warnings);
}

// Layer 4: Packaged Product Verification
if (packagedCheck.isPackaged) {
  packagedVerification = verifyPackagedProductNutrition(
    nutritionData.food_name,
    nutritionValidation.correctedData,
    region
  );
}
```

### 2. **Nutrition Data Validation**
```typescript
function validateNutritionData(nutritionData: any) {
  const { calories, protein_grams, carbs_grams, fat_grams } = nutritionData;

  // Calculate expected calories from macros
  const calculatedCalories = (protein_grams * 4) + (carbs_grams * 4) + (fat_grams * 9);

  // Check if within ±20% tolerance
  const tolerance = 0.20;
  const minCalories = calculatedCalories * (1 - tolerance);
  const maxCalories = calculatedCalories * (1 + tolerance);

  if (calories < minCalories || calories > maxCalories) {
    return {
      isValid: false,
      warnings: [`Calorie mismatch: expected ${calculatedCalories.toFixed(0)}, got ${calories}`],
      correctedData: nutritionData
    };
  }

  return { isValid: true, warnings: [], correctedData: nutritionData };
}
```

## 🌍 Regional Database Integration

### 1. **Region-Specific Databases**
```typescript
const db = getRegionalNutritionDatabase(foodName, region);

// Region mapping:
switch(region?.toLowerCase()) {
  case 'us': case 'usa': return 'USDA_FDC';
  case 'au': case 'australia': return 'NUTTAB';
  case 'id': case 'indonesia': return 'INDONESIAN_FOOD_COMP';
  default: return 'USDA_FDC'; // Default fallback
}
```

### 2. **Regional Branded Products**
```typescript
const regionalBrands = {
  usa: ['Coca-Cola', 'Pepsi', 'Cheetos', 'Doritos', 'Cheerios', 'Kellogg'],
  australia: ['Vegemite', 'Tim Tam', 'Milo', 'Weetabix', 'Arnott\'s', 'Farmers Union'],
  indonesia: ['Indomie', 'Pocari Sweat', 'ABC Sauce', 'Kopi Luwak', 'Ultra Milk']
};
```

## 📊 Error Handling & Monitoring

### 1. **Comprehensive Error Logging**
```typescript
try {
  const response = await ai.models.generateContent({...});

  console.log('✅ Gemini response received successfully');
  console.log('Response text length:', aiResponse?.length || 0);
  console.log('Response preview:', aiResponse?.substring(0, 200));

} catch (geminiError) {
  console.error('=== Gemini API Error ===');
  console.error('Error name:', geminiError?.name);
  console.error('Error message:', geminiError?.message);
  console.error('Error stack:', geminiError?.stack);

  // Structured error details for monitoring
  const errorDetails = {
    name: geminiError?.name || 'Unknown',
    message: geminiError?.message || 'Unknown error',
    cause: geminiError?.cause || null,
    type: typeof geminiError
  };
}
```

### 2. **Response Cleaning**
```typescript
// Handle markdown code blocks
let cleanedResponse = aiResponse.trim();

if (cleanedResponse.startsWith('```json')) {
  cleanedResponse = cleanedResponse.replace(/^```json\s*\n/, '').replace(/\n```\s*$/, '');
} else if (cleanedResponse.startsWith('```')) {
  cleanedResponse = cleanedResponse.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '');
}

// Parse JSON
const nutritionData = JSON.parse(cleanedResponse);
```

## 🚀 Performance Optimization

### 1. **Model Selection Strategy**
```typescript
// Use appropriate model based on task complexity
const models = {
  simple: "gemini-1.5-flash",      // Fast, cost-effective
  complex: "gemini-1.5-pro",       // Better reasoning
  vision: "gemini-2.5-flash"       // Latest vision model
};

const selectedModel = taskComplexity === 'vision' ? models.vision : models.simple;
```

### 2. **Temperature Settings**
```typescript
const generationConfig = {
  temperature: 0.1,      // Low temperature for consistent nutrition analysis
  topK: 40,             // Balanced creativity vs consistency
  topP: 0.95,           // Allow some variation but stay focused
  maxOutputTokens: 1024 // Limit response length
};
```

## 🔧 Implementation Checklist

### ✅ Current Implementation Status
- [x] Multi-format image support (URLs, data URLs, base64)
- [x] Comprehensive safety checks
- [x] Packaged vs fresh food differentiation
- [x] Regional database integration
- [x] Multi-layer validation pipeline
- [x] JSON-only response format
- [x] Error handling and logging
- [x] Response cleaning and parsing

### 🔄 Areas for Enhancement
- [ ] Batch processing for multiple images
- [ ] Confidence scoring for nutrition estimates
- [ ] Integration with nutrition databases APIs
- [ ] A/B testing framework for prompt optimization
- [ ] User feedback loop for accuracy improvement

## 📈 Best Practices Summary

### 1. **Prompt Engineering**
- Safety-first approach with clear rejection criteria
- Detailed analysis frameworks for different food types
- Specific output format requirements
- Context-aware regional considerations

### 2. **Data Validation**
- Multi-layer validation (AI → Edibility → Nutrition → Packaged)
- Conservative estimation principles
- Cross-verification with official databases
- Error tolerance with correction mechanisms

### 3. **Error Handling**
- Comprehensive logging for debugging
- Graceful degradation with fallbacks
- User-friendly error messages
- Monitoring and alerting systems

### 4. **Performance**
- Appropriate model selection for task complexity
- Optimized generation parameters
- Efficient image processing pipelines
- Caching strategies for repeated queries

This implementation demonstrates industry-leading practices for AI-powered nutrition analysis, balancing accuracy, safety, and user experience.
