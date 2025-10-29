#!/usr/bin/env node
// Delete Strava Webhook Subscription
// Run with: node delete-strava-webhook.js <subscription_id>

import 'dotenv/config';

const STRAVA_CLIENT_ID = process.env.VITE_STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

async function deleteWebhook(subscriptionId) {
  if (!subscriptionId) {
    console.error('❌ Usage: node delete-strava-webhook.js <subscription_id>');
    console.log('\n💡 Get subscription ID with: node view-strava-webhooks.js');
    process.exit(1);
  }

  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    console.error('❌ Missing Strava credentials in .env file');
    process.exit(1);
  }

  console.log(`🗑️  Deleting Strava webhook subscription ${subscriptionId}...\n`);

  try {
    const response = await fetch(
      `https://www.strava.com/api/v3/push_subscriptions/${subscriptionId}?` + new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
      }),
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to delete webhook:', response.status, response.statusText);
      console.error('   Response:', errorText);
      process.exit(1);
    }

    console.log('✅ Webhook subscription deleted successfully!');
    console.log('\n📝 Don\'t forget to remove it from your database:');
    console.log(`   DELETE FROM strava_webhook_subscriptions WHERE subscription_id = ${subscriptionId};`);

  } catch (error) {
    console.error('❌ Error deleting webhook:', error.message);
    process.exit(1);
  }
}

const subscriptionId = process.argv[2];
deleteWebhook(subscriptionId);
