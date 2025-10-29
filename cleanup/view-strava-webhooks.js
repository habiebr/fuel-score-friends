#!/usr/bin/env node
// View Strava Webhook Subscriptions
// Run with: node view-strava-webhooks.js

import 'dotenv/config';

const STRAVA_CLIENT_ID = process.env.VITE_STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

async function viewWebhooks() {
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    console.error('❌ Missing Strava credentials in .env file');
    process.exit(1);
  }

  console.log('📋 Fetching Strava webhook subscriptions...\n');

  try {
    const response = await fetch(
      `https://www.strava.com/api/v3/push_subscriptions?` + new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to fetch webhooks:', response.status, response.statusText);
      console.error('   Response:', errorText);
      process.exit(1);
    }

    const subscriptions = await response.json();

    if (subscriptions.length === 0) {
      console.log('No active webhook subscriptions found.');
      console.log('\n💡 Register a webhook with: node register-strava-webhook.js');
      return;
    }

    console.log(`Found ${subscriptions.length} subscription(s):\n`);
    subscriptions.forEach((sub, index) => {
      console.log(`${index + 1}. Subscription ID: ${sub.id}`);
      console.log(`   Callback URL: ${sub.callback_url}`);
      console.log(`   Created: ${new Date(sub.created_at).toLocaleString()}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error fetching webhooks:', error.message);
    process.exit(1);
  }
}

viewWebhooks();
