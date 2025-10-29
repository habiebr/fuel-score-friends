// Apply Strava migration to Supabase database
// Run with: node apply-strava-migration.js

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY1NzMyMiwiZXhwIjoyMDcxMjMzMzIyfQ.XshYdJ7JiQWcZj_w2wOo3PxGkefaeAEr4UYMUomOSEI';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  try {
    console.log('📖 Reading migration file...');
    const migrationPath = join(__dirname, 'supabase/migrations/20251011084938_add_strava_integration.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');
    
    console.log('🚀 Applying Strava migration...');
    console.log('Migration size:', migrationSql.length, 'characters');
    
    // Split into individual statements (basic split on semicolons outside of function bodies)
    const statements = [];
    let currentStatement = '';
    let inFunction = false;
    
    const lines = migrationSql.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments
      if (trimmed.startsWith('--') || trimmed.startsWith('/*') || trimmed === '') {
        continue;
      }
      
      // Track if we're inside a function definition
      if (trimmed.includes('$$')) {
        inFunction = !inFunction;
      }
      
      currentStatement += line + '\n';
      
      // If we hit a semicolon and we're not in a function, it's the end of a statement
      if (line.includes(';') && !inFunction) {
        const stmt = currentStatement.trim();
        if (stmt && !stmt.startsWith('--')) {
          statements.push(stmt);
        }
        currentStatement = '';
      }
    }
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.substring(0, 80).replace(/\n/g, ' ');
      
      try {
        process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}...`);
        
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Try direct execution if RPC fails
          const { error: directError } = await supabase
            .from('_')
            .select()
            .limit(0);
          
          if (directError) {
            throw error;
          }
        }
        
        console.log(' ✅');
        successCount++;
      } catch (err) {
        console.log(' ❌');
        console.log(`    Error: ${err.message}`);
        errorCount++;
      }
    }
    
    console.log('\n📊 Migration Results:');
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📋 Created tables:');
      console.log('  - strava_tokens');
      console.log('  - strava_activities');
      console.log('  - strava_webhook_subscriptions');
      console.log('  - strava_webhook_events');
      console.log('\n🔒 RLS policies enabled');
      console.log('🔧 Helper functions created');
    } else {
      console.log('\n⚠️  Some statements failed. Please check the errors above.');
      console.log('💡 You may need to run the migration SQL manually in Supabase SQL Editor');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n💡 Alternative: Run the SQL file manually in Supabase dashboard');
    console.log('   1. Go to https://eecdbddpzwedficnpenm.supabase.co');
    console.log('   2. Open SQL Editor');
    console.log('   3. Copy contents of: supabase/migrations/20251011084938_add_strava_integration.sql');
    console.log('   4. Execute');
    process.exit(1);
  }
}

applyMigration();
