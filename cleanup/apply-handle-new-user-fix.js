#!/usr/bin/env node
// Apply the handle_new_user fix migration to Supabase
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  try {
    console.log('📝 Reading migration file...');
    const migrationPath = join(__dirname, 'supabase', 'migrations', '20251013120000_fix_handle_new_user_case.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    console.log('🚀 Applying migration to fix handle_new_user trigger...');
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      
      // Try alternative: execute via REST API
      console.log('⚠️  Trying alternative method...');
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql_string: sql })
      });
      
      if (!response.ok) {
        console.error('❌ Alternative method also failed');
        console.log('\n📋 Manual Steps Required:');
        console.log('1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/eecdbddpzwedficnpenm');
        console.log('2. Navigate to SQL Editor');
        console.log('3. Copy and paste the contents of:');
        console.log('   supabase/migrations/20251013120000_fix_handle_new_user_case.sql');
        console.log('4. Run the SQL');
        process.exit(1);
      }
    }

    console.log('✅ Migration applied successfully!');
    console.log('🎉 The signup issue should now be fixed.');
    console.log('\nℹ️  What was fixed:');
    console.log('  - Fixed CASE syntax error in handle_new_user trigger');
    console.log('  - Improved error handling for profile creation');
    console.log('  - Updated timezone validation to auto-fix instead of raising errors');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n📋 Manual Migration Required:');
    console.log('1. Go to: https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/sql/new');
    console.log('2. Copy the SQL from: supabase/migrations/20251013120000_fix_handle_new_user_case.sql');
    console.log('3. Paste and run it in the SQL Editor');
    process.exit(1);
  }
}

applyMigration();
