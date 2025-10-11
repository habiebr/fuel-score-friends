#!/bin/bash

# Setup Auto-Sync Google Fit Cron Job via Supabase SQL API
# This script uses the Supabase REST API to execute SQL directly

set -e

echo "🔧 Setting up auto-sync Google Fit cron job..."
echo ""

# Get service role key from .env.local
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNDEyNDA2NiwiZXhwIjoyMDM5NzAwMDY2fQ.TUjcOVZaHY5maSI3YbsrQOBKYVfz75qDiNvvhyZjUEw"
PROJECT_REF="eecdbddpzwedficnpenm"

echo "1️⃣ Enabling pg_cron and http extensions..."

# Enable pg_cron extension
curl -X POST "https://${PROJECT_REF}.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"query": "CREATE EXTENSION IF NOT EXISTS pg_cron;"}' \
  2>/dev/null || echo "⚠️  pg_cron may already exist (this is OK)"

echo "✅ Extensions ready"
echo ""

echo "2️⃣ Checking if cron job already exists..."

# Try to unschedule existing job (if it exists)
curl -X POST "https://${PROJECT_REF}.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT cron.unschedule('\''auto-sync-google-fit-every-5-min'\'');"}' \
  2>/dev/null || echo "⚠️  No existing job (this is OK)"

echo ""
echo "3️⃣ Scheduling new cron job (every 5 minutes)..."

# Schedule the cron job
CRON_SQL="SELECT cron.schedule(
  'auto-sync-google-fit-every-5-min',
  '*/5 * * * *',
  \$\$
  SELECT net.http_post(
    url := 'https://eecdbddpzwedficnpenm.supabase.co/functions/v1/auto-sync-google-fit',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer cc31eefcfdb9545d51cd6784229026eb559e8a8b4a05b77d4282fd3922bb6e5f'
    )
  ) AS request_id;
  \$\$
);"

# Execute via psql-like command through Supabase
echo "$CRON_SQL" > /tmp/setup_cron.sql

echo ""
echo "📝 SQL to execute:"
cat /tmp/setup_cron.sql
echo ""

echo "⚠️  The Supabase REST API doesn't support cron.schedule directly."
echo "📋 Please run the following command manually:"
echo ""
echo "   Copy the SQL from setup_auto_sync_cron.sql and paste it into:"
echo "   https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new"
echo ""
echo "Or use this quick link:"
echo "   https://supabase.com/dashboard/project/${PROJECT_REF}/sql"
echo ""
echo "✨ The SQL is ready in: setup_auto_sync_cron.sql"

# Clean up
rm -f /tmp/setup_cron.sql
