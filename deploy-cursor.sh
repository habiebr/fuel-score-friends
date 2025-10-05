#!/bin/bash

# Deploy script for cursor branch
# This script ensures we're on the cursor branch and deploys from there

set -e  # Exit on any error

echo "🚀 Starting deployment from cursor branch..."

# Enforce cursor branch for deploys
bash scripts/ensure-cursor-branch.sh

echo "✅ On cursor branch: cursor"

# Build the PWA
echo "🔨 Building PWA..."
npm run build:pwa

# Deploy to Cloudflare Pages with cursor branch
echo "🌐 Deploying to Cloudflare Pages..."
CLOUDFLARE_ACCOUNT_ID=5a73505af9ed48e44ce4caeaa0fdf73f npx wrangler pages deploy dist --project-name nutrisync --branch=cursor --commit-dirty=true

echo "✅ Deployment complete!"
echo "🌍 Your PWA is live at: https://nutrisync.pages.dev"
echo "🔗 Cursor branch URL: https://cursor.nutrisync.pages.dev"
