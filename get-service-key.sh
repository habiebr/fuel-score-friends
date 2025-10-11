#!/bin/bash

# Helper script to get Supabase service role key
# This key is needed to test the auto-sync Google Fit function

echo "🔑 Getting Supabase Service Role Key..."
echo "========================================"
echo ""

PROJECT_REF="qiwndzsrmtxmgngnupml"

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed"
    echo ""
    echo "To install:"
    echo "  brew install supabase/tap/supabase"
    echo ""
    echo "Or get the key manually from:"
    echo "  https://supabase.com/dashboard/project/$PROJECT_REF/settings/api"
    exit 1
fi

echo "Getting service role key..."
echo ""

# Try to get the service role key using supabase CLI
supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep -A 1 "service_role" | tail -n 1 || {
    echo "⚠️  Could not retrieve key via CLI"
    echo ""
    echo "Please get it manually from:"
    echo "  https://supabase.com/dashboard/project/$PROJECT_REF/settings/api"
    echo ""
    echo "Then add it to .env file:"
    echo "  SUPABASE_SERVICE_ROLE_KEY=your-key-here"
}
