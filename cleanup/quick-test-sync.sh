#!/bin/bash

# Quick Test - Google Fit Server Sync
# Run this script for a fast sync test

echo "🚀 Quick Google Fit Sync Test"
echo "=============================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    exit 1
fi

# Load .env
export $(cat .env | grep -v '^#' | xargs)

# Check for service role key
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ SUPABASE_SERVICE_ROLE_KEY not found in .env"
    echo ""
    echo "Get it from:"
    echo "  https://supabase.com/dashboard/project/qiwndzsrmtxmgngnupml/settings/api"
    echo ""
    echo "Then add to .env:"
    echo "  SUPABASE_SERVICE_ROLE_KEY=your-key-here"
    exit 1
fi

echo "✅ Environment loaded"
echo "📡 Testing sync function..."
echo ""

# Call the function
curl -s -X POST \
  "${VITE_SUPABASE_URL}/functions/v1/auto-sync-google-fit" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "✨ Test complete!"
