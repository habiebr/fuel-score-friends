#!/usr/bin/env node

/**
 * One-time script to resync historical Google Fit data WITH sessions
 * for all users who have Google Fit connected
 * 
 * This will update existing records to include session data
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// How many days back to resync
const DAYS_BACK = 30;

// Color codes
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(msg, color = 'reset') {
  console.log(`${c[color]}${msg}${c.reset}`);
}

// Activity type mapping
const ACTIVITY_TYPES = {
  1: 'Cycling',
  7: 'Walking',
  8: 'Running',
  9: 'Jogging',
  10: 'Sprinting',
  56: 'Rock Climbing',
  57: 'Beach Run',
  58: 'Stair Run',
  59: 'Treadmill Run',
  71: 'Road Biking',
  72: 'Trail Running',
  82: 'Swimming',
  112: 'CrossFit',
  116: 'HIIT',
  117: 'Spinning',
  119: 'Indoor Cycling',
  169: 'Swimming',
  170: 'Open Water Swimming',
  171: 'Pool Swimming',
  173: 'Running'
};

const EXERCISE_ACTIVITY_CODES = new Set([
  1, 8, 9, 10, 56, 57, 58, 59, 71, 72, 82, 
  112, 116, 117, 119, 169, 170, 171, 173
]);

const EXCLUDED_ACTIVITY_CODES = new Set([7]); // Walking

async function fetchSessionsForDay(accessToken, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    const response = await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/sessions?` +
      `startTime=${startOfDay.toISOString()}&` +
      `endTime=${endOfDay.toISOString()}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('TOKEN_EXPIRED');
      }
      return [];
    }

    const data = await response.json();
    const sessions = data.session || [];

    // Filter to only exercise sessions
    const exerciseSessions = sessions.filter(s => {
      const activityType = Number(s.activityType);
      if (EXCLUDED_ACTIVITY_CODES.has(activityType)) return false;
      return EXERCISE_ACTIVITY_CODES.has(activityType);
    });

    // Normalize sessions
    return exerciseSessions.map(s => ({
      id: s.id,
      name: s.name || ACTIVITY_TYPES[s.activityType] || 'Workout',
      description: s.description,
      activityType: s.activityType,
      _activityTypeNumeric: s.activityType,
      startTimeMillis: s.startTimeMillis,
      endTimeMillis: s.endTimeMillis,
      activeTimeMillis: s.activeTimeMillis,
      application: s.application
    }));

  } catch (error) {
    if (error.message === 'TOKEN_EXPIRED') {
      throw error;
    }
    console.warn(`  ⚠️  Failed to fetch sessions for ${date.toISOString().split('T')[0]}:`, error.message);
    return [];
  }
}

async function refreshToken(supabase, userId, refreshToken) {
  // Call the refresh edge function instead of doing it directly
  // This avoids needing Google client credentials locally
  try {
    const { data, error } = await supabase.functions.invoke('refresh-google-fit-token', {
      body: { userId }
    });

    if (error || !data?.success) {
      throw new Error(data?.error || 'Token refresh failed');
    }

    return data.accessToken;

  } catch (error) {
    // If edge function fails, user will need to reconnect Google Fit
    throw new Error(`Token refresh failed: ${error.message}. User may need to reconnect Google Fit.`);
  }
}

async function resyncHistoricalDataForUser(supabase, user, daysBack) {
  const userId = user.user_id;
  const userIdShort = userId.substring(0, 8);
  
  log(`\n📊 Processing user ${userIdShort}...`, 'cyan');

  // Get or refresh access token
  let accessToken = user.access_token;
  const expiresAt = new Date(user.expires_at);
  
  if (expiresAt <= new Date()) {
    log(`  🔄 Token expired, refreshing...`, 'yellow');
    try {
      accessToken = await refreshToken(supabase, userId, user.refresh_token);
      log(`  ✅ Token refreshed`, 'green');
    } catch (error) {
      log(`  ❌ Token refresh failed: ${error.message}`, 'red');
      return { success: false, daysUpdated: 0, sessionsAdded: 0 };
    }
  }

  // Get existing google_fit_data records for this user
  const { data: existingRecords, error: fetchError } = await supabase
    .from('google_fit_data')
    .select('date, sessions')
    .eq('user_id', userId)
    .gte('date', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (fetchError) {
    log(`  ❌ Error fetching records: ${fetchError.message}`, 'red');
    return { success: false, daysUpdated: 0, sessionsAdded: 0 };
  }

  if (!existingRecords || existingRecords.length === 0) {
    log(`  ℹ️  No existing records found`, 'blue');
    return { success: true, daysUpdated: 0, sessionsAdded: 0 };
  }

  log(`  📋 Found ${existingRecords.length} existing records`, 'blue');

  let daysUpdated = 0;
  let totalSessionsAdded = 0;

  // Process each day
  for (const record of existingRecords) {
    const date = new Date(record.date + 'T00:00:00Z');
    const dateStr = record.date;

    // Skip if already has sessions
    if (record.sessions && Array.isArray(record.sessions) && record.sessions.length > 0) {
      continue;
    }

    try {
      // Fetch sessions for this day
      const sessions = await fetchSessionsForDay(accessToken, date);

      if (sessions.length > 0) {
        // Update record with sessions
        const { error: updateError } = await supabase
          .from('google_fit_data')
          .update({
            sessions: sessions,
            last_synced_at: new Date().toISOString(),
            sync_source: 'historical_resync_with_sessions'
          })
          .eq('user_id', userId)
          .eq('date', dateStr);

        if (updateError) {
          log(`  ⚠️  Failed to update ${dateStr}: ${updateError.message}`, 'yellow');
        } else {
          log(`  ✅ ${dateStr}: Added ${sessions.length} session(s)`, 'green');
          daysUpdated++;
          totalSessionsAdded += sessions.length;

          // Store sessions in google_fit_sessions table
          const sessionRecords = sessions.map(s => ({
            user_id: userId,
            session_id: String(s.id || `${s.startTimeMillis}-${s.endTimeMillis}`),
            start_time: new Date(Number(s.startTimeMillis)).toISOString(),
            end_time: new Date(Number(s.endTimeMillis)).toISOString(),
            activity_type: s.name,
            name: s.name,
            description: s.description || s.name,
            source: 'google_fit_resync',
            raw: s
          }));

          await supabase
            .from('google_fit_sessions')
            .upsert(sessionRecords, { onConflict: 'user_id,session_id' });
        }
      }

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      if (error.message === 'TOKEN_EXPIRED') {
        log(`  ❌ Token expired during sync`, 'red');
        break;
      }
      log(`  ⚠️  Error processing ${dateStr}: ${error.message}`, 'yellow');
    }
  }

  log(`  🎯 Updated ${daysUpdated} days with ${totalSessionsAdded} total sessions`, 'green');
  
  return { 
    success: true, 
    daysUpdated, 
    sessionsAdded: totalSessionsAdded 
  };
}

async function main() {
  log('\n╔════════════════════════════════════════════════════════╗', 'bright');
  log('║   One-Time Historical Resync - Add Session Data       ║', 'bright');
  log('╚════════════════════════════════════════════════════════╝', 'bright');

  // Validate environment
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    log('\n❌ Missing environment variables:', 'red');
    if (!SUPABASE_URL) log('  - VITE_SUPABASE_URL', 'red');
    if (!SUPABASE_SERVICE_ROLE_KEY) log('  - SUPABASE_SERVICE_ROLE_KEY', 'red');
    process.exit(1);
  }

  log(`\n⚙️  Configuration:`, 'blue');
  log(`   • Days back: ${DAYS_BACK}`, 'cyan');
  log(`   • Supabase URL: ${SUPABASE_URL}`, 'cyan');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get all users with active Google Fit tokens
  log(`\n🔍 Finding users with Google Fit connected...`, 'yellow');
  
  const { data: users, error: usersError } = await supabase
    .from('google_tokens')
    .select('user_id, access_token, refresh_token, expires_at')
    .eq('is_active', true);

  if (usersError) {
    log(`\n❌ Error fetching users: ${usersError.message}`, 'red');
    process.exit(1);
  }

  if (!users || users.length === 0) {
    log(`\n⚠️  No users with Google Fit found`, 'yellow');
    process.exit(0);
  }

  log(`✅ Found ${users.length} user(s) with Google Fit connected\n`, 'green');

  // Process each user
  let totalDaysUpdated = 0;
  let totalSessionsAdded = 0;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    log(`\n[${ i + 1}/${users.length}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'cyan');
    
    const result = await resyncHistoricalDataForUser(supabase, user, DAYS_BACK);
    
    if (result.success) {
      successCount++;
      totalDaysUpdated += result.daysUpdated;
      totalSessionsAdded += result.sessionsAdded;
    } else {
      errorCount++;
    }

    // Delay between users
    if (i < users.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Summary
  log('\n\n╔════════════════════════════════════════════════════════╗', 'bright');
  log('║                    RESYNC COMPLETE                     ║', 'bright');
  log('╚════════════════════════════════════════════════════════╝', 'bright');
  
  log(`\n📊 Summary:`, 'bright');
  log(`   • Users processed:     ${users.length}`, 'cyan');
  log(`   • Successful:          ${successCount}`, 'green');
  log(`   • Errors:              ${errorCount}`, errorCount > 0 ? 'red' : 'green');
  log(`   • Days updated:        ${totalDaysUpdated}`, 'green');
  log(`   • Sessions added:      ${totalSessionsAdded}`, 'green');

  if (totalSessionsAdded > 0) {
    log(`\n✨ Successfully added ${totalSessionsAdded} workout sessions!`, 'green');
    log(`\n📋 Next steps:`, 'blue');
    log(`   1. Verify data in Supabase dashboard`, 'cyan');
    log(`   2. Check google_fit_data.sessions column`, 'cyan');
    log(`   3. Check google_fit_sessions table`, 'cyan');
    log(`   4. Update frontend to display session data`, 'cyan');
  } else {
    log(`\nℹ️  No sessions were added. Possible reasons:`, 'blue');
    log(`   • All records already have sessions`, 'cyan');
    log(`   • No workout sessions exist in Google Fit`, 'cyan');
    log(`   • Users didn't log workouts during this period`, 'cyan');
  }

  log('\n');
}

main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
