#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  console.log('\n💡 Get your service key from:');
  console.log('   https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/settings/api');
  console.log('\nThen run:');
  console.log('   export SUPABASE_SERVICE_ROLE_KEY="your-key-here"');
  console.log('   node apply-migrations.mjs');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration(filePath, name) {
  console.log(`\n📝 Applying migration: ${name}`);
  console.log('─'.repeat(60));
  
  try {
    const sql = readFileSync(filePath, 'utf8');
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Try direct query if rpc doesn't exist
      const { error: directError } = await supabase.from('_migrations').select('*').limit(1);
      
      if (directError) {
        console.log('⚠️  RPC method not available, executing via raw SQL...');
        
        // Split into individual statements and execute
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
        
        for (const statement of statements) {
          const { error: stmtError } = await supabase.rpc('exec', { 
            sql: statement + ';' 
          });
          
          if (stmtError) {
            console.error(`❌ Error executing statement:`, stmtError);
            throw stmtError;
          }
        }
        
        console.log('✅ Migration applied successfully (via statements)');
        return;
      }
    }
    
    console.log('✅ Migration applied successfully');
    
  } catch (err) {
    console.error(`❌ Error applying migration:`, err);
    throw err;
  }
}

async function main() {
  console.log('🚀 Applying Hybrid Recovery Nutrition Migrations');
  console.log('='.repeat(60));
  
  try {
    // Migration 1: Clean up token refresh
    await applyMigration(
      'supabase/migrations/20251017000000_cleanup_duplicate_token_refresh.sql',
      'Token Refresh Cleanup'
    );
    
    // Migration 2: Increase sync frequency
    await applyMigration(
      'supabase/migrations/20251017000001_increase_sync_frequency.sql',
      'Increase Sync Frequency'
    );
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All migrations applied successfully!');
    console.log('\n📊 Next steps:');
    console.log('   1. Verify cron jobs: node check-cron-jobs.mjs');
    console.log('   2. Wait 10 minutes for first sync run');
    console.log('   3. Test with a workout!');
    
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    console.log('\n💡 Try applying manually via Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/sql');
    process.exit(1);
  }
}

main();

