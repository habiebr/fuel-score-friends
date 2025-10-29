#!/usr/bin/env node
/**
 * Apply migrations via Supabase Management API
 * This script reads migration files and executes them via the SQL endpoint
 */

import { readFileSync } from 'fs';

const supabaseProjectRef = 'eecdbddpzwedficnpenm';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  console.log('\n💡 Get your service key from:');
  console.log(`   https://supabase.com/dashboard/project/${supabaseProjectRef}/settings/api`);
  console.log('\nThen run:');
  console.log('   export SUPABASE_SERVICE_ROLE_KEY="your-key-here"');
  console.log('   node apply-migrations-simple.mjs');
  process.exit(1);
}

async function executeSql(sql) {
  const url = `https://${supabaseProjectRef}.supabase.co/rest/v1/rpc/exec`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return response;
}

async function applyMigration(filePath, name) {
  console.log(`\n📝 Applying: ${name}`);
  console.log('─'.repeat(60));
  
  try {
    const sql = readFileSync(filePath, 'utf8');
    console.log(`   File: ${filePath}`);
    console.log(`   Size: ${sql.length} bytes`);
    
    await executeSql(sql);
    
    console.log('✅ Applied successfully');
    return true;
    
  } catch (err) {
    console.error(`❌ Error:`, err.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Applying Hybrid Recovery Nutrition Migrations');
  console.log('='.repeat(60));
  console.log(`📍 Project: ${supabaseProjectRef}`);
  
  const migrations = [
    {
      file: 'supabase/migrations/20251017000000_cleanup_duplicate_token_refresh.sql',
      name: 'Token Refresh Cleanup'
    },
    {
      file: 'supabase/migrations/20251017000001_increase_sync_frequency.sql',
      name: 'Increase Sync Frequency'
    }
  ];
  
  let successCount = 0;
  
  for (const migration of migrations) {
    const success = await applyMigration(migration.file, migration.name);
    if (success) successCount++;
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (successCount === migrations.length) {
    console.log('✅ All migrations applied successfully!');
    console.log('\n📊 Verify with:');
    console.log('   node check-cron-jobs.mjs');
    console.log('\n🧪 Test in 10 minutes after first cron run');
  } else {
    console.log(`⚠️  Applied ${successCount}/${migrations.length} migrations`);
    console.log('\n💡 Try applying manually via Supabase Dashboard:');
    console.log(`   https://supabase.com/dashboard/project/${supabaseProjectRef}/sql`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});

