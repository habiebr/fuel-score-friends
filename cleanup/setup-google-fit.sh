#!/bin/bash

# Google Fit Setup Script
echo "🚀 Setting up Google Fit integration..."

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local file..."
    cp cloudflare.env.example .env.local
    echo "✅ .env.local created from template"
else
    echo "📝 .env.local already exists"
fi

# Update the client ID in .env.local
echo "🔧 Updating Google Client ID..."
sed -i.bak 's/VITE_GOOGLE_CLIENT_ID=.*/VITE_GOOGLE_CLIENT_ID=377345404477-nn873roguhu96ld5f21d5emnothqqvoa.apps.googleusercontent.com/' .env.local

echo "✅ Google Client ID updated"
echo ""
echo "📋 Next steps:"
echo "1. Get your Google API key from Google Cloud Console"
echo "2. Add it to .env.local: VITE_GOOGLE_API_KEY=your-api-key-here"
echo "3. Run: npm run dev"
echo "4. Go to /import page to test the integration"
echo ""
echo "📖 See GOOGLE_FIT_SETUP.md for detailed instructions"
