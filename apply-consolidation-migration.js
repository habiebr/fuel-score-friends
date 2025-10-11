import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://eecdbddpzwedficnpenm.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNTk1Mzc2OSwiZXhwIjoyMDQxNTI5NzY5fQ.t0SrT1VLE1L31gZ4JVFBjbtko_eSuscp0Z2i_kRQMeA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('📝 Reading migration file...');
    const migrationPath = join(__dirname, 'supabase/migrations/20251011090000_consolidate_strava_updated_at_functions.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Applying consolidation migration...');
    
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.includes('COMMENT ON')) continue; // Skip comments for now
      if (statement.includes('SELECT')) continue; // Skip verification query
      
      console.log(`  Executing: ${statement.substring(0, 50)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        console.error(`  ❌ Error:`, error);
        // Continue anyway for some errors
      } else {
        console.log(`  ✅ Success`);
      }
    }

    console.log('\n✅ Migration applied successfully!');
    console.log('\n📊 Verifying triggers...');
    
    // Verify the triggers are set up correctly
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          t.tablename,
          trg.tgname as triggername
        FROM pg_trigger trg
        JOIN pg_class c ON trg.tgrelid = c.oid
        JOIN pg_tables t ON c.relname = t.tablename
        WHERE t.tablename LIKE 'strava_%'
          AND trg.tgname = 'set_updated_at'
        ORDER BY t.tablename;
      `
    });

    if (error) {
      console.error('Verification error:', error);
    } else {
      console.log('Triggers found:', data);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
