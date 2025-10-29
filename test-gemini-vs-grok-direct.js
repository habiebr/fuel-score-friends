#!/usr/bin/env node

/**
 * Simple test to compare Gemini vs Grok for meal suggestions
 * This test calls the APIs directly without going through Supabase Edge Functions
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function testGeminiDirect() {
  if (!GEMINI_API_KEY) {
    console.log('❌ No GEMINI_API_KEY found');
    return null;
  }

  const context = `
You are an expert Indonesian nutritionist and meal planner for runners.

User Profile:
- Age: 30
- Weight: 70 kg
- Height: 175 cm
- Sex: male

Nutrition Targets for 2024-12-20:
- Training Load: moderate
- Total Calories: 2400 kcal
- Carbohydrates: 300g (50%)
- Protein: 120g (20%)
- Fat: 80g (30%)

Create a complete daily meal plan with AUTHENTIC INDONESIAN FOODS for:
- Breakfast: 600 kcal (P:30g, C:75g, F:20g)
- Lunch: 800 kcal (P:40g, C:100g, F:25g)
- Dinner: 700 kcal (P:35g, C:85g, F:20g)
- Snack: 300 kcal (P:15g, C:40g, F:15g)

REQUIREMENTS:
1. Use ONLY Indonesian foods (Nasi, Ayam, Ikan, Tempe, Tahu, Sayuran, etc.)
2. Include EXACT gram portions for ALL ingredients
3. Provide 2-3 meal options per meal type
4. Match the nutrition targets closely

Return ONLY valid JSON in this exact format:
{
  "breakfast": {
    "suggestions": [
      {
        "name": "Nasi Uduk + Ayam Goreng",
        "description": "Traditional coconut rice with fried chicken",
        "ingredients": [
          {"name": "Nasi Uduk", "amount": "150g", "calories": 200, "protein": 4, "carbs": 40, "fat": 2},
          {"name": "Ayam Goreng", "amount": "100g", "calories": 250, "protein": 25, "carbs": 0, "fat": 15}
        ],
        "total_calories": 450,
        "total_protein": 29,
        "total_carbs": 40,
        "total_fat": 17
      }
    ]
  },
  "lunch": { "suggestions": [ ... ] },
  "dinner": { "suggestions": [ ... ] },
  "snack": { "suggestions": [ ... ] }
}`;

  try {
    console.log('🤖 Testing Gemini...');
    const start = Date.now();
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: context
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
            responseMimeType: "application/json"
          }
        }),
      }
    );

    const time = Date.now() - start;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content in response');
    }

    const parsed = JSON.parse(content);
    
    return {
      success: true,
      responseTime: time,
      suggestions: parsed,
      mealCount: Object.keys(parsed).length,
      sampleBreakfast: parsed.breakfast?.suggestions?.[0]?.name || 'None'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      responseTime: 0
    };
  }
}

async function testGrokDirect() {
  if (!GROQ_API_KEY) {
    console.log('❌ No GROQ_API_KEY found');
    return null;
  }

  const context = `
You are an expert Indonesian nutritionist and meal planner for runners.

User Profile:
- Age: 30
- Weight: 70 kg
- Height: 175 cm
- Sex: male

Nutrition Targets for 2024-12-20:
- Training Load: moderate
- Total Calories: 2400 kcal
- Carbohydrates: 300g (50%)
- Protein: 120g (20%)
- Fat: 80g (30%)

Create a complete daily meal plan with AUTHENTIC INDONESIAN FOODS for:
- Breakfast: 600 kcal (P:30g, C:75g, F:20g)
- Lunch: 800 kcal (P:40g, C:100g, F:25g)
- Dinner: 700 kcal (P:35g, C:85g, F:20g)
- Snack: 300 kcal (P:15g, C:40g, F:15g)

REQUIREMENTS:
1. Use ONLY Indonesian foods (Nasi, Ayam, Ikan, Tempe, Tahu, Sayuran, etc.)
2. Include EXACT gram portions for ALL ingredients
3. Provide 2-3 meal options per meal type
4. Match the nutrition targets closely

Return ONLY valid JSON in this exact format:
{
  "breakfast": {
    "suggestions": [
      {
        "name": "Nasi Uduk + Ayam Goreng",
        "description": "Traditional coconut rice with fried chicken",
        "ingredients": [
          {"name": "Nasi Uduk", "amount": "150g", "calories": 200, "protein": 4, "carbs": 40, "fat": 2},
          {"name": "Ayam Goreng", "amount": "100g", "calories": 250, "protein": 25, "carbs": 0, "fat": 15}
        ],
        "total_calories": 450,
        "total_protein": 29,
        "total_carbs": 40,
        "total_fat": 17
      }
    ]
  },
  "lunch": { "suggestions": [ ... ] },
  "dinner": { "suggestions": [ ... ] },
  "snack": { "suggestions": [ ... ] }
}`;

  try {
    console.log('🚀 Testing Grok...');
    const start = Date.now();
    
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "You are an expert Indonesian nutritionist specializing in runner nutrition. Return ONLY valid JSON."
            },
            { role: "user", content: context }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
      }
    );

    const time = Date.now() - start;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in response');
    }

    const parsed = JSON.parse(content);
    
    return {
      success: true,
      responseTime: time,
      suggestions: parsed,
      mealCount: Object.keys(parsed).length,
      sampleBreakfast: parsed.breakfast?.suggestions?.[0]?.name || 'None'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      responseTime: 0
    };
  }
}

async function runTest() {
  console.log('🧪 Testing Gemini vs Grok for meal suggestions...\n');
  
  const geminiResult = await testGeminiDirect();
  const grokResult = await testGrokDirect();
  
  console.log('\n📊 Test Results:');
  console.log('================\n');
  
  if (geminiResult) {
    console.log('🤖 Gemini Results:');
    console.log(`- Success: ${geminiResult.success ? '✅' : '❌'}`);
    if (geminiResult.success) {
      console.log(`- Response Time: ${geminiResult.responseTime}ms`);
      console.log(`- Meals Generated: ${geminiResult.mealCount}`);
      console.log(`- Sample Breakfast: ${geminiResult.sampleBreakfast}`);
    } else {
      console.log(`- Error: ${geminiResult.error}`);
    }
    console.log('');
  }
  
  if (grokResult) {
    console.log('🚀 Grok Results:');
    console.log(`- Success: ${grokResult.success ? '✅' : '❌'}`);
    if (grokResult.success) {
      console.log(`- Response Time: ${grokResult.responseTime}ms`);
      console.log(`- Meals Generated: ${grokResult.mealCount}`);
      console.log(`- Sample Breakfast: ${grokResult.sampleBreakfast}`);
    } else {
      console.log(`- Error: ${grokResult.error}`);
    }
    console.log('');
  }
  
  if (geminiResult && grokResult && geminiResult.success && grokResult.success) {
    console.log('⚖️  Comparison:');
    console.log(`- Gemini Faster: ${geminiResult.responseTime < grokResult.responseTime ? '✅' : '❌'}`);
    console.log(`- Gemini More Meals: ${geminiResult.mealCount > grokResult.mealCount ? '✅' : '❌'}`);
    console.log(`- Speed Difference: ${Math.abs(geminiResult.responseTime - grokResult.responseTime)}ms`);
    console.log(`- Recommendation: ${geminiResult.responseTime < grokResult.responseTime ? 'GEMINI' : 'GROK'}`);
    console.log('');
  }
  
  console.log('📝 Full Results:');
  console.log(JSON.stringify({ gemini: geminiResult, grok: grokResult }, null, 2));
}

// Run the test
runTest().catch(console.error);
