#!/usr/bin/env node

/**
 * Simple script to trigger nutrition score recalculation via Edge Function
 * 
 * Usage: node trigger-recalculate-scores.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL');
  console.error('   VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function triggerRecalculation() {
  console.log('🚀 Triggering nutrition score recalculation...\n');

  try {
    const { data, error } = await supabase.functions.invoke('recalculate-nutrition-scores', {
      body: {},
    });

    if (error) {
      throw new Error(`Edge Function error: ${error.message}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Recalculation failed');
    }

    console.log('✅ Recalculation completed successfully!');
    console.log(`📊 Processed: ${data.processed} combinations`);
    console.log(`❌ Errors: ${data.errors} combinations`);
    console.log(`📈 Total: ${data.total} combinations`);
    
    if (data.errors === 0) {
      console.log('🎉 All nutrition scores have been successfully recalculated!');
    } else {
      console.log('⚠️  Some errors occurred during recalculation.');
    }

  } catch (error) {
    console.error('❌ Failed to trigger recalculation:', error.message);
    process.exit(1);
  }
}

// Run the script
triggerRecalculation()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
