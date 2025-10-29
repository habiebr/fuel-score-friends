#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQL(sql) {
  try {
    // Use the Supabase client to execute raw SQL
    const { data, error } = await supabase.rpc('exec', { sql });
    
    if (error) {
      console.error('SQL execution error:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Unexpected error:', err);
    return false;
  }
}

async function updateDatabase() {
  try {
    console.log('🔄 Adding onboarding columns to profiles table...');
    
    // SQL statements to execute
    const sqlStatements = [
      `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;`,
      `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sex TEXT CHECK (sex IN ('male', 'female'));`,
      `UPDATE public.profiles SET onboarding_completed = TRUE WHERE onboarding_completed IS FALSE OR onboarding_completed IS NULL;`,
      `COMMENT ON COLUMN public.profiles.onboarding_completed IS 'Tracks whether user has completed the onboarding wizard';`,
      `COMMENT ON COLUMN public.profiles.sex IS 'Biological sex for BMR calculation (Mifflin-St Jeor equation)';`
    ];

    for (const sql of sqlStatements) {
      console.log(`Executing: ${sql.substring(0, 50)}...`);
      const success = await executeSQL(sql);
      if (success) {
        console.log('✅ Success');
      } else {
        console.log('❌ Failed');
      }
    }

    // Verify the changes
    console.log('🔍 Verifying changes...');
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, onboarding_completed, sex, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error verifying changes:', error);
    } else {
      console.log('📊 Recent profiles:');
      console.table(data);
    }

    console.log('🎉 Database update completed!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

updateDatabase();
