#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.log('Please set these in your .env file or environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateDatabase() {
  try {
    console.log('🔄 Updating database schema...');
    
    // First, let's check current profiles
    const { data: currentProfiles, error: selectError } = await supabase
      .from('profiles')
      .select('user_id, full_name, onboarding_completed, sex')
      .limit(5);

    if (selectError) {
      console.error('Error reading profiles:', selectError);
      return;
    }

    console.log('📊 Current profiles (before update):');
    console.table(currentProfiles);

    // Try to update profiles to mark onboarding as completed
    // This will work if the columns exist, or fail gracefully if they don't
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      })
      .neq('user_id', '00000000-0000-0000-0000-000000000000'); // Update all profiles

    if (updateError) {
      console.log('⚠️  Update failed (columns may not exist yet):', updateError.message);
      console.log('📝 Please run the SQL manually in Supabase dashboard:');
      console.log(`
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS sex TEXT CHECK (sex IN ('male', 'female'));

UPDATE public.profiles 
SET onboarding_completed = TRUE 
WHERE onboarding_completed IS FALSE OR onboarding_completed IS NULL;
      `);
    } else {
      console.log('✅ Successfully updated profiles');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

updateDatabase();