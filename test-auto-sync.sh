#!/bin/bash

# Test auto-sync-google-fit edge function
# This script manually triggers the background sync function to verify it works

echo "Testing auto-sync-google-fit function..."
echo "=========================================="

# Get credentials from .env if available
if [ -f .env ]; then
  source .env
fi

SUPABASE_URL="${VITE_SUPABASE_URL:-https://eecdbddpzwedficnpenm.supabase.co}"
ANON_KEY="${VITE_SUPABASE_ANON_KEY}"
# Use the CRON_SECRET from setup_auto_sync_cron.sql
CRON_SECRET="cc31eefcfdb9545d51cd6784229026eb559e8a8b4a05b77d4282fd3922bb6e5f"

# Check if we have required credentials
if [ -z "$CRON_SECRET" ]; then
  echo "❌ ERROR: CRON_SECRET not found"
  echo "Using default CRON_SECRET from setup script"
  exit 1
fi

echo ""
echo "📡 Calling auto-sync-google-fit function..."
echo "URL: $SUPABASE_URL/functions/v1/auto-sync-google-fit"
echo ""

# Make the request using CRON_SECRET
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  "$SUPABASE_URL/functions/v1/auto-sync-google-fit" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json")

# Extract HTTP code and body
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | sed 's/HTTP_CODE://')
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

echo "📊 Response:"
echo "HTTP Status: $HTTP_CODE"
echo "Body: $BODY"
echo ""

# Parse JSON response if jq is available
if command -v jq &> /dev/null; then
  echo "📈 Parsed Results:"
  echo "$BODY" | jq '.'
else
  echo "💡 Install 'jq' for prettier JSON output: brew install jq"
fi

# Check success
if [ "$HTTP_CODE" = "200" ]; then
  echo ""
  echo "✅ Function executed successfully!"
else
  echo ""
  echo "❌ Function failed with HTTP $HTTP_CODE"
fi
