#!/usr/bin/env node

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function executeSQL(sql) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      const error = await response.text();
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
      `UPDATE public.profiles SET onboarding_completed = TRUE WHERE onboarding_completed IS FALSE OR onboarding_completed IS NULL;`
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

    console.log('🎉 Database update completed!');
    console.log('📝 Please verify the changes in your Supabase dashboard.');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

updateDatabase();
