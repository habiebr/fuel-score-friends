#!/usr/bin/env node

// Simple test to check if GEMINI_API_KEY works
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function testGeminiKey() {
  if (!GEMINI_API_KEY) {
    console.log('❌ No GEMINI_API_KEY environment variable set');
    return;
  }

  console.log(`Testing Gemini API key: ${GEMINI_API_KEY.substring(0, 10)}...`);

  try {
    // Test the list models endpoint
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`,
      {
        method: "GET",
      }
    );

    console.log(`Response status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API key is valid!');
      console.log('Available models:');
      data.models?.forEach(model => {
        console.log(`  - ${model.name} (${model.supportedGenerationMethods?.join(', ') || 'no methods'})`);
      });
    } else {
      const errorText = await response.text();
      console.log('❌ API key test failed:');
      console.log(errorText);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

testGeminiKey();
