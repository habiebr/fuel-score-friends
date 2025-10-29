#!/usr/bin/env node

/**
 * Interactive Google Fit Sync Tester
 * 
 * This script helps you test and verify the Google Fit auto-sync functionality
 */

import 'dotenv/config';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
let SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function print(msg, color = 'reset') {
  console.log(`${c[color]}${msg}${c.reset}`);
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(`${c.cyan}${prompt}${c.reset} `, resolve);
  });
}

async function main() {
  print('\n╔════════════════════════════════════════════════════════╗', 'bright');
  print('║     Google Fit Server Sync Test - Interactive Mode    ║', 'bright');
  print('╚════════════════════════════════════════════════════════╝', 'bright');

  // Step 1: Check environment
  print('\n📋 Step 1: Environment Check', 'yellow');
  print('─'.repeat(60), 'cyan');

  if (!SUPABASE_URL) {
    print('❌ VITE_SUPABASE_URL not found in .env', 'red');
    rl.close();
    process.exit(1);
  }
  print(`✅ Supabase URL: ${SUPABASE_URL}`, 'green');

  if (!SERVICE_ROLE_KEY) {
    print('⚠️  Service role key not found in .env', 'yellow');
    print('\n📖 You can find your service role key at:', 'blue');
    print(`   https://supabase.com/dashboard/project/qiwndzsrmtxmgngnupml/settings/api`, 'cyan');
    print('\n⚠️  WARNING: This is a secret key with admin access!', 'red');
    print('   Do NOT share it or commit it to version control.', 'red');
    
    const answer = await question('\nWould you like to enter it now? (y/n)');
    
    if (answer.toLowerCase() === 'y') {
      SERVICE_ROLE_KEY = await question('Paste your service role key: ');
      
      const saveAnswer = await question('Save to .env file? (y/n)');
      if (saveAnswer.toLowerCase() === 'y') {
        const fs = await import('fs');
        const envPath = '/Users/habiebraharjo/fuel-score-friends/.env';
        const envContent = await fs.promises.readFile(envPath, 'utf-8');
        await fs.promises.writeFile(
          envPath, 
          envContent + `\nSUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}\n`
        );
        print('✅ Saved to .env file', 'green');
      }
    } else {
      print('\n❌ Cannot proceed without service role key', 'red');
      rl.close();
      process.exit(1);
    }
  } else {
    print(`✅ Service role key: ${SERVICE_ROLE_KEY.substring(0, 20)}...`, 'green');
  }

  // Step 2: Check Google Tokens
  print('\n📋 Step 2: Checking Google Fit Connections', 'yellow');
  print('─'.repeat(60), 'cyan');

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: tokens, error } = await supabase
      .from('google_tokens')
      .select('user_id, is_active, expires_at, created_at')
      .eq('is_active', true);

    if (error) {
      print(`❌ Error: ${error.message}`, 'red');
      rl.close();
      process.exit(1);
    }

    if (!tokens || tokens.length === 0) {
      print('⚠️  No active Google Fit connections found', 'yellow');
      print('\n💡 To test the sync:', 'blue');
      print('   1. Open the app on a device', 'cyan');
      print('   2. Connect to Google Fit from Settings', 'cyan');
      print('   3. Run this test again', 'cyan');
      rl.close();
      process.exit(0);
    }

    print(`✅ Found ${tokens.length} active Google Fit connection(s)`, 'green');
    
    tokens.forEach((token, i) => {
      const expires = new Date(token.expires_at);
      const isExpired = expires < new Date();
      const userId = token.user_id.substring(0, 8);
      
      print(`\n   ${i + 1}. User ${userId}...`, 'cyan');
      print(`      Status: ${isExpired ? '🔴 Expired' : '🟢 Active'}`, isExpired ? 'red' : 'green');
      print(`      Expires: ${expires.toLocaleString()}`, 'blue');
    });

    // Check recent syncs
    const { data: recentSync } = await supabase
      .from('google_fit_data')
      .select('user_id, date, steps, last_synced_at')
      .order('last_synced_at', { ascending: false })
      .limit(1);

    if (recentSync && recentSync.length > 0) {
      const lastSync = recentSync[0];
      const minutesAgo = Math.round((Date.now() - new Date(lastSync.last_synced_at).getTime()) / 60000);
      print(`\n📊 Last sync: ${minutesAgo} minutes ago`, 'blue');
      print(`   • ${lastSync.steps} steps on ${lastSync.date}`, 'cyan');
    } else {
      print('\n📊 No previous syncs found', 'blue');
    }

  } catch (error) {
    print(`❌ Error: ${error.message}`, 'red');
    rl.close();
    process.exit(1);
  }

  // Step 3: Test the sync
  print('\n📋 Step 3: Test Sync Function', 'yellow');
  print('─'.repeat(60), 'cyan');

  const proceedAnswer = await question('\nReady to test the sync? (y/n)');
  
  if (proceedAnswer.toLowerCase() !== 'y') {
    print('\n👋 Test cancelled', 'yellow');
    rl.close();
    process.exit(0);
  }

  const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/auto-sync-google-fit`;
  
  print('\n⏳ Calling auto-sync function...', 'yellow');
  print(`   ${FUNCTION_URL}`, 'cyan');

  try {
    const startTime = Date.now();
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    print(`\n📊 Response (${duration}ms):`, 'bright');
    print('─'.repeat(60), 'cyan');
    
    if (response.ok && data.success) {
      print('✅ Sync completed successfully!', 'green');
      print(`\n   📈 Results:`, 'bright');
      print(`      • Users synced:  ${data.synced}`, 'green');
      print(`      • Users skipped: ${data.skipped}`, 'yellow');
      print(`      • Errors:        ${data.errors}`, data.errors > 0 ? 'red' : 'green');
      print(`      • Total users:   ${data.total}`, 'cyan');

      if (data.synced === 0 && data.skipped > 0) {
        print('\n   ℹ️  All users were skipped (recently synced within 5 minutes)', 'blue');
        print('      This is normal - prevents API rate limiting', 'blue');
      }

      if (data.errors > 0) {
        print('\n   ⚠️  Some users had errors', 'yellow');
        const viewLogs = await question('   View function logs? (y/n)');
        if (viewLogs.toLowerCase() === 'y') {
          print('\n   Run:', 'cyan');
          print('      supabase functions logs auto-sync-google-fit', 'yellow');
        }
      }

    } else {
      print('❌ Sync failed!', 'red');
      print(`   Status: ${response.status}`, 'red');
      print(`   Error: ${data.error || 'Unknown error'}`, 'red');
    }

  } catch (error) {
    print(`\n❌ Error: ${error.message}`, 'red');
  }

  print('\n' + '═'.repeat(60), 'bright');
  print('✨ Test complete!\n', 'green');
  
  rl.close();
}

main().catch((error) => {
  console.error(error);
  rl.close();
  process.exit(1);
});
