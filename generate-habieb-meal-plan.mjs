// Generate meal plan for Muhammad Habieb
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateMealPlan() {
  const userId = '8c2006e2-5512-4865-ba05-618cf2161ec1';
  const today = new Date().toISOString().split('T')[0];

  console.log(`🍽️  Triggering meal plan generation for Muhammad Habieb on ${today}...\n`);

  try {
    const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
      body: { date: today, useAI: false } // Use templates for faster generation
    });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('✅ Meal plan generated successfully!');
    console.log('Response:', data);
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
}

generateMealPlan().catch(console.error);
