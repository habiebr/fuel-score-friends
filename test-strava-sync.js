#!/usr/bin/env node
// Test Strava Sync
// Run with: node test-strava-sync.js

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testStravaSync() {
  console.log('🧪 Testing Strava Sync...\n');

  try {
    // Get first user with Strava token
    const { data: tokens, error: tokenError } = await supabase
      .from('strava_tokens')
      .select('user_id, athlete_id, expires_at')
      .limit(1);

    if (tokenError) {
      console.error('❌ Error fetching tokens:', tokenError);
      process.exit(1);
    }

    if (!tokens || tokens.length === 0) {
      console.log('⚠️  No users with Strava tokens found');
      console.log('💡 Connect Strava from the app first');
      process.exit(0);
    }

    const token = tokens[0];
    console.log('✅ Found user with Strava token');
    console.log('   User ID:', token.user_id);
    console.log('   Athlete ID:', token.athlete_id);
    console.log('   Expires:', new Date(token.expires_at).toLocaleString());
    console.log('');

    // Check if token is expired
    const isExpired = new Date(token.expires_at) <= new Date();
    if (isExpired) {
      console.log('⚠️  Token is expired - will be refreshed automatically');
    }

    // Get user's auth session (we'll create a temporary one for testing)
    const { data: userData } = await supabase.auth.admin.getUserById(token.user_id);
    if (!userData || !userData.user) {
      console.error('❌ Could not get user data');
      process.exit(1);
    }

    console.log('🔄 Calling sync-strava-activities function...\n');

    // Call the edge function
    const { data, error } = await supabase.functions.invoke('sync-strava-activities', {
      body: {
        per_page: 10, // Just sync 10 activities for testing
      },
    });

    if (error) {
      console.error('❌ Sync failed:', error);
      process.exit(1);
    }

    if (data?.success) {
      console.log('✅ Sync completed successfully!');
      console.log('   Activities synced:', data.synced);
      console.log('   Total fetched:', data.total_fetched);
      
      if (data.errors && data.errors.length > 0) {
        console.log('   Errors:', data.errors.length);
      }

      if (data.activities && data.activities.length > 0) {
        console.log('\n📋 Latest activities:');
        data.activities.slice(0, 5).forEach((activity, index) => {
          console.log(`   ${index + 1}. ${activity.name} (${activity.type})`);
          console.log(`      Distance: ${(activity.distance / 1000).toFixed(2)} km`);
          console.log(`      Date: ${new Date(activity.start_date).toLocaleString()}`);
        });
      }

      // Check database
      console.log('\n🗄️  Checking database...');
      const { count } = await supabase
        .from('strava_activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', token.user_id);

      console.log(`   Total activities in DB: ${count}`);

    } else {
      console.error('❌ Sync failed:', data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testStravaSync();
