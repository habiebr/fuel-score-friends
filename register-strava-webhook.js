#!/usr/bin/env node
// Register Strava Webhook Subscription
// Run with: node register-strava-webhook.js

import 'dotenv/config';

const STRAVA_CLIENT_ID = process.env.VITE_STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const CALLBACK_URL = process.env.STRAVA_WEBHOOK_CALLBACK_URL || 
  'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/strava-webhook';
const VERIFY_TOKEN = process.env.STRAVA_VERIFY_TOKEN || 'STRAVA_WEBHOOK_VERIFY';

async function registerWebhook() {
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    console.error('❌ Missing Strava credentials in .env file');
    console.log('Required:');
    console.log('  VITE_STRAVA_CLIENT_ID');
    console.log('  STRAVA_CLIENT_SECRET');
    process.exit(1);
  }

  console.log('🚀 Registering Strava Webhook...');
  console.log('  Callback URL:', CALLBACK_URL);
  console.log('  Verify Token:', VERIFY_TOKEN);

  try {
    const response = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        callback_url: CALLBACK_URL,
        verify_token: VERIFY_TOKEN,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Registration failed:', response.status, response.statusText);
      console.error('   Response:', errorText);
      
      if (response.status === 400) {
        console.log('\n💡 Possible issues:');
        console.log('   - Callback URL must be publicly accessible');
        console.log('   - Webhook endpoint must respond to GET verification');
        console.log('   - You may already have an active subscription');
      }
      
      process.exit(1);
    }

    const data = await response.json();
    console.log('\n✅ Webhook registered successfully!');
    console.log('   Subscription ID:', data.id);
    console.log('   Callback URL:', data.callback_url);
    console.log('\n📝 Save this subscription ID to your database:');
    console.log(`   INSERT INTO strava_webhook_subscriptions (subscription_id, callback_url, verify_token, is_active)`);
    console.log(`   VALUES (${data.id}, '${CALLBACK_URL}', '${VERIFY_TOKEN}', true);`);

  } catch (error) {
    console.error('❌ Error registering webhook:', error.message);
    process.exit(1);
  }
}

registerWebhook();
