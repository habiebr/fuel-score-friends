#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Checking cron job status...${NC}\n"

# Check if cron job exists
echo "1. Checking if cron job exists..."
supabase db remote --db-url "postgresql://postgres.eecdbddpzwedficnpenm:Habzxasqw123!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres" \
  query "SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE '%auto-sync%';" 2>/dev/null

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Query executed${NC}\n"
else
  echo -e "${RED}✗ Failed to query cron jobs${NC}\n"
fi

# Check recent cron job runs
echo "2. Checking recent cron job executions..."
supabase db remote --db-url "postgresql://postgres.eecdbddpzwedficnpenm:Habzxasqw123!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres" \
  query "SELECT status, return_message, start_time FROM cron.job_run_details WHERE jobname LIKE '%auto-sync%' ORDER BY start_time DESC LIMIT 5;" 2>/dev/null

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Query executed${NC}\n"
else
  echo -e "${RED}✗ Failed to query cron job runs${NC}\n"
fi

# Check data freshness
echo "3. Checking Google Fit data freshness (last 5 syncs)..."
supabase db remote --db-url "postgresql://postgres.eecdbddpzwedficnpenm:Habzxasqw123!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres" \
  query "SELECT user_id, date, last_synced_at, NOW() - last_synced_at as time_since_sync FROM google_fit_data WHERE date = CURRENT_DATE ORDER BY last_synced_at DESC LIMIT 5;" 2>/dev/null

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Query executed${NC}\n"
else
  echo -e "${RED}✗ Failed to query data freshness${NC}\n"
fi

echo -e "${YELLOW}Done!${NC}"
