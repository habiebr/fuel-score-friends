#!/bin/bash
# Inject environment variables into config.js for Cloudflare Pages deployment

set -e

echo "📝 Injecting environment variables into config.js..."

# Check if environment variables are set
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "⚠️  Warning: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set"
  echo "Using placeholders - app may not work correctly"
fi

# Create config.js with actual values
cat > dist/config.js << EOF
// Runtime configuration - DO NOT EDIT
// Generated during deployment
window.__SUPABASE_URL__ = '${VITE_SUPABASE_URL:-https://eecdbddpzwedficnpenm.supabase.co}';
window.__SUPABASE_ANON_KEY__ = '${VITE_SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2NTczMjIsImV4cCI6MjA3MTIzMzMyMn0.DsT8hmM9CPW-0yrcchJAKOulyH6p_GnjoVIz1S0CbvI}';
EOF

echo "✅ Config.js updated with environment variables"
