#!/bin/bash

# Setup script for historical resync
# This will help you get your service role key and run the resync

echo "🔧 Historical Resync Setup"
echo "=========================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    exit 1
fi

# Get the project ID from .env
PROJECT_ID=$(grep "VITE_SUPABASE_PROJECT_ID" .env | cut -d'"' -f2)
if [ -z "$PROJECT_ID" ]; then
    PROJECT_ID=$(grep "VITE_SUPABASE_URL" .env | cut -d'/' -f3 | cut -d'.' -f1)
fi

echo "📋 Your Supabase Project: $PROJECT_ID"
echo ""

# Check for service role key
if grep -q "SUPABASE_SERVICE_ROLE_KEY" .env; then
    echo "⚠️  Checking if service role key matches your project..."
    
    # Decode the JWT to check project
    SERVICE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env | cut -d'=' -f2)
    KEY_PROJECT=$(echo $SERVICE_KEY | cut -d'.' -f2 | base64 -d 2>/dev/null | grep -o '"ref":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$KEY_PROJECT" ] && [ "$KEY_PROJECT" != "$PROJECT_ID" ]; then
        echo "❌ Service role key is for wrong project: $KEY_PROJECT"
        echo "   Your project is: $PROJECT_ID"
        echo ""
        echo "📖 Get the correct service role key for project $PROJECT_ID:"
        echo "   https://supabase.com/dashboard/project/$PROJECT_ID/settings/api"
        echo ""
        
        # Remove old key
        grep -v "SUPABASE_SERVICE_ROLE_KEY" .env > .env.tmp && mv .env.tmp .env
        
        read -p "Do you have the correct service role key? (y/n) " -n 1 -r
        echo ""
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            read -p "Paste your service role key: " SERVICE_KEY
            echo ""
            echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY" >> .env
            echo "✅ Updated service role key in .env"
        else
            echo ""
            echo "❌ Cannot proceed without correct service role key"
            exit 1
        fi
    else
        echo "✅ Service role key looks correct"
    fi
else
    echo "⚠️  Service role key not found in .env"
    echo ""
    echo "📖 To get your service role key for project $PROJECT_ID:"
    echo "   https://supabase.com/dashboard/project/$PROJECT_ID/settings/api"
    echo ""
    read -p "Do you have your service role key ready? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        read -p "Paste your service role key: " SERVICE_KEY
        echo ""
        echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY" >> .env
        echo "✅ Added service role key to .env"
    else
        echo ""
        echo "❌ Cannot proceed without service role key"
        echo "   Please get it from the Supabase dashboard and run this again"
        exit 1
    fi
fi

echo ""
echo "🔍 Checking other required environment variables..."

# Check other required vars
MISSING=0

if ! grep -q "VITE_SUPABASE_URL" .env; then
    echo "❌ VITE_SUPABASE_URL missing"
    MISSING=1
fi

if [ $MISSING -eq 1 ]; then
    echo ""
    echo "⚠️  Some environment variables are missing"
    echo "   Please add them to .env before running the resync"
    exit 1
fi

echo "✅ All required environment variables present"
echo ""
echo "ℹ️  Note: Google API credentials are stored in Supabase edge function secrets"
echo "   The resync script will use tokens from the database"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 Ready to run historical resync!"
echo ""
echo "To start the resync, run:"
echo "  node resync-historical-sessions.js"
echo ""
echo "This will:"
echo "  • Find all users with Google Fit connected"
echo "  • Fetch sessions from Google Fit API"
echo "  • Update existing records with session data"
echo "  • Store sessions in google_fit_sessions table"
echo ""
read -p "Run the resync now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "▶️  Starting resync..."
    echo ""
    node resync-historical-sessions.js
else
    echo ""
    echo "👋 Resync cancelled. Run 'node resync-historical-sessions.js' when ready."
fi
