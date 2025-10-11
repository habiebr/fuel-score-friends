#!/bin/bash

# Deploy Critical Edge Functions to Supabase
# This script deploys the most important edge functions one by one

set -e

echo "🚀 Deploying critical edge functions to Supabase..."
echo ""

# List of critical functions to deploy
FUNCTIONS=(
  "auto-sync-google-fit"
  "sync-historical-google-fit-data"
  "sync-all-users-direct"
  "fetch-google-fit-data"
  "refresh-expiring-google-tokens"
  "refresh-all-google-tokens"
  "store-google-token"
  "update-actual-training"
  "auto-update-training"
  "morning-ai-batch"
  "generate-meal-plan"
  "nutrition-ai"
  "generate-recovery-plan"
  "smart-ai-cache"
  "aggregate-weekly-activity"
  "weekly-running-leaderboard"
)

SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

for func in "${FUNCTIONS[@]}"; do
  echo "📦 Deploying: $func"
  
  # Check if function directory exists
  if [ ! -d "supabase/functions/$func" ]; then
    echo "   ⚠️  Skipped (not found locally)"
    ((SKIP_COUNT++))
    echo ""
    continue
  fi
  
  # Deploy the function
  if supabase functions deploy "$func" --no-verify-jwt 2>&1 | grep -q "Deployed Functions"; then
    echo "   ✅ Deployed successfully"
    ((SUCCESS_COUNT++))
  else
    echo "   ❌ Failed to deploy"
    ((FAIL_COUNT++))
  fi
  
  echo ""
done

echo ""
echo "═══════════════════════════════════════════"
echo "📊 Deployment Summary"
echo "═══════════════════════════════════════════"
echo "✅ Successful: $SUCCESS_COUNT"
echo "❌ Failed: $FAIL_COUNT"
echo "⚠️  Skipped: $SKIP_COUNT"
echo "📦 Total: ${#FUNCTIONS[@]}"
echo ""

if [ $SUCCESS_COUNT -gt 0 ]; then
  echo "🎉 Deployment complete!"
  echo ""
  echo "📋 Next steps:"
  echo "   1. Setup cron job: Run setup_auto_sync_cron.sql in Supabase Dashboard"
  echo "   2. Monitor logs: https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/functions"
  echo "   3. Test auto-sync: Wait 5-10 minutes and check edge function logs"
fi
