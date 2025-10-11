#!/usr/bin/env node

/**
 * Test script for Google Fit auto-sync edge function
 * 
 * This script tests the server-side Google Fit sync functionality
 * that runs automatically via cron to sync all users' fitness data.
 */

import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/auto-sync-google-fit`;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testGoogleFitSync() {
  log('\n🔍 Testing Google Fit Auto-Sync Edge Function', 'bright');
  log('='.repeat(50), 'cyan');

  // Validate environment variables
  if (!SUPABASE_URL) {
    log('❌ Error: VITE_SUPABASE_URL not found in environment', 'red');
    process.exit(1);
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    log('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in environment', 'red');
    log('💡 Please add this to your .env file', 'yellow');
    process.exit(1);
  }

  log(`\n📍 Function URL: ${FUNCTION_URL}`, 'blue');
  log(`🔑 Using service role key: ${SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`, 'blue');

  try {
    log('\n⏳ Calling auto-sync function...', 'yellow');
    
    const startTime = Date.now();
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const duration = Date.now() - startTime;

    log(`\n📊 Response Status: ${response.status} ${response.statusText}`, 
      response.ok ? 'green' : 'red');
    log(`⏱️  Duration: ${duration}ms`, 'cyan');

    const data = await response.json();
    
    log('\n📦 Response Data:', 'bright');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok && data.success) {
      log('\n✅ Sync completed successfully!', 'green');
      log(`   • Users synced: ${data.synced}`, 'green');
      log(`   • Users skipped: ${data.skipped}`, 'green');
      log(`   • Errors: ${data.errors}`, data.errors > 0 ? 'yellow' : 'green');
      log(`   • Total users: ${data.total}`, 'green');
      
      if (data.synced === 0 && data.total > 0) {
        log('\n💡 All users were skipped (likely synced recently)', 'yellow');
      }
      
      if (data.errors > 0) {
        log('\n⚠️  Some users encountered errors - check the function logs', 'yellow');
      }
    } else {
      log('\n❌ Sync failed!', 'red');
      if (data.error) {
        log(`   Error: ${data.error}`, 'red');
      }
    }

  } catch (error) {
    log('\n❌ Test failed with exception:', 'red');
    console.error(error);
    process.exit(1);
  }

  log('\n' + '='.repeat(50), 'cyan');
  log('✨ Test completed\n', 'bright');
}

// Additional function to check Google token status
async function checkGoogleTokens() {
  log('\n🔍 Checking Google Tokens Status', 'bright');
  log('='.repeat(50), 'cyan');

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: tokens, error } = await supabase
      .from('google_tokens')
      .select('user_id, is_active, expires_at, created_at')
      .eq('is_active', true);

    if (error) {
      log(`❌ Error fetching tokens: ${error.message}`, 'red');
      return;
    }

    if (!tokens || tokens.length === 0) {
      log('⚠️  No active Google tokens found', 'yellow');
      log('💡 Users need to connect Google Fit first', 'blue');
      return;
    }

    log(`\n✅ Found ${tokens.length} active Google Fit connection(s)`, 'green');
    
    tokens.forEach((token, index) => {
      const expiresAt = new Date(token.expires_at);
      const isExpired = expiresAt < new Date();
      const userId = token.user_id.substring(0, 8);
      
      log(`\n${index + 1}. User: ${userId}...`, 'cyan');
      log(`   • Status: ${isExpired ? '🔴 Expired' : '🟢 Active'}`, isExpired ? 'red' : 'green');
      log(`   • Expires: ${expiresAt.toLocaleString()}`, 'blue');
      log(`   • Created: ${new Date(token.created_at).toLocaleString()}`, 'blue');
    });

    // Check recent sync data
    const { data: recentSync, error: syncError } = await supabase
      .from('google_fit_data')
      .select('user_id, date, steps, calories_burned, last_synced_at')
      .order('last_synced_at', { ascending: false })
      .limit(5);

    if (!syncError && recentSync && recentSync.length > 0) {
      log('\n📊 Recent Sync Activity (last 5):', 'bright');
      recentSync.forEach((sync, index) => {
        const userId = sync.user_id.substring(0, 8);
        const syncedAt = new Date(sync.last_synced_at);
        const minutesAgo = Math.round((Date.now() - syncedAt.getTime()) / 60000);
        
        log(`\n${index + 1}. User: ${userId}...`, 'cyan');
        log(`   • Date: ${sync.date}`, 'blue');
        log(`   • Steps: ${sync.steps}`, 'blue');
        log(`   • Calories: ${Math.round(sync.calories_burned)}`, 'blue');
        log(`   • Last synced: ${minutesAgo} minutes ago`, 'blue');
      });
    }

  } catch (error) {
    log(`\n❌ Error checking tokens: ${error.message}`, 'red');
  }

  log('\n' + '='.repeat(50), 'cyan');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Google Fit Sync Tester

Usage:
  node test-google-fit-sync.js [options]

Options:
  --check-tokens    Check Google token status before syncing
  --sync-only       Only run the sync test
  -h, --help        Show this help message

Examples:
  node test-google-fit-sync.js                  # Run sync test
  node test-google-fit-sync.js --check-tokens   # Check tokens then sync
  node test-google-fit-sync.js --sync-only      # Only sync
    `);
    process.exit(0);
  }

  if (args.includes('--check-tokens')) {
    await checkGoogleTokens();
  }

  if (!args.includes('--check-only')) {
    await testGoogleFitSync();
  }
}

main();
