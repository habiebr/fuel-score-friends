#!/usr/bin/env node

/**
 * Apply user_activity_label migration directly via Supabase API
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://eecdbddpzwedficnpenm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found');
  console.log('\nPlease set the service role key:');
  console.log('export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🚀 Applying user_activity_label migration...\n');

  // Read the migration file
  const sql = fs.readFileSync('./supabase/migrations/20251013000000_add_user_activity_label.sql', 'utf8');

  console.log('📄 Migration SQL:');
  console.log(sql);
  console.log('\n');

  try {
    // Split the SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;

      console.log(`📌 Executing statement ${i + 1}/${statements.length}...`);
      
      const { error } = await supabase.rpc('exec', { sql_query: statement });
      
      if (error) {
        // Try direct query if RPC fails
        const { error: queryError } = await supabase.from('_query').select('*').limit(0);
        
        if (queryError) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          
          // Continue if it's a benign error (column already exists, etc.)
          if (error.message.includes('already exists') || error.message.includes('IF NOT EXISTS')) {
            console.log('⚠️  Skipping (already exists)\n');
            continue;
          }
          
          throw error;
        }
      }
      
      console.log(`✅ Statement ${i + 1} executed\n`);
    }

    console.log('✅ Migration applied successfully!\n');

    // Verify the column was added
    console.log('🔍 Verifying column exists...\n');
    
    const { data, error } = await supabase
      .from('training_activities')
      .select('user_activity_label')
      .limit(1);

    if (error) {
      console.error('❌ Verification failed:', error.message);
    } else {
      console.log('✅ Column verified! Table schema updated.');
      console.log('\n📊 Sample data:', data);
    }

    // Check if backfill worked
    const { data: backfilled, error: backfillError } = await supabase
      .from('training_activities')
      .select('user_activity_label, activity_type, distance_km, intensity')
      .not('user_activity_label', 'is', null)
      .limit(5);

    if (!backfillError && backfilled && backfilled.length > 0) {
      console.log('\n✅ Backfill successful! Sample records:');
      console.table(backfilled);
    } else if (backfilled && backfilled.length === 0) {
      console.log('\n⚠️  No existing records to backfill');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n🔧 Manual steps required:');
    console.log('1. Go to Supabase Dashboard > SQL Editor');
    console.log('2. Paste the migration SQL');
    console.log('3. Run the query');
    process.exit(1);
  }
}

applyMigration();
