#!/bin/bash

# Apply user_activity_label migration using psql
# This connects directly to the database

echo "🚀 Applying user_activity_label migration..."
echo ""

# Read environment variables
if [ -z "$SUPABASE_DB_PASSWORD" ]; then
  echo "❌ SUPABASE_DB_PASSWORD not set"
  echo ""
  echo "Please set your database password:"
  echo "export SUPABASE_DB_PASSWORD='your-db-password'"
  echo ""
  echo "You can find it in Supabase Dashboard > Settings > Database > Connection string"
  exit 1
fi

# Database connection
DB_HOST="aws-0-ap-southeast-1.pooler.supabase.com"
DB_PORT="6543"
DB_NAME="postgres"
DB_USER="postgres.eecdbddpzwedficnpenm"

# Apply migration
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f supabase/migrations/20251013000000_add_user_activity_label.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration applied successfully!"
  echo ""
  echo "Verifying column exists..."
  PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'training_activities' AND column_name = 'user_activity_label';"
else
  echo ""
  echo "❌ Migration failed"
  echo ""
  echo "Alternative: Apply via Supabase Dashboard"
  echo "1. Go to: https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/sql/new"
  echo "2. Paste contents of: supabase/migrations/20251013000000_add_user_activity_label.sql"
  echo "3. Run the query"
fi
