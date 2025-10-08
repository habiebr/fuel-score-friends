#!/bin/bash

# Deploy script for cursor branch
# This script ensures we're on the cursor branch and deploys from there

set -e  # Exit on any error

echo "🚀 Starting deployment from cursor branch..."

# Check if we're on the cursor branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "cursor" ]; then
    echo "⚠️  Not on cursor branch. Current branch: $CURRENT_BRANCH"
    echo "🔄 Switching to cursor branch..."
    git checkout cursor
fi

echo "✅ On cursor branch: $(git branch --show-current)"

# Build the PWA
echo "🔨 Building PWA..."
npm run build:pwa

# Deploy to Cloudflare Pages: beta project for cursor branch
echo "🌐 Deploying to Cloudflare Pages (beta project)..."
CLOUDFLARE_ACCOUNT_ID=5a73505af9ed48e44ce4caeaa0fdf73f npx wrangler pages deploy dist --project-name nutrisync-beta --branch=cursor --commit-dirty=true

echo "✅ Deployment complete!"
echo "🌍 Beta PWA is live at: https://nutrisync-beta.pages.dev (map to beta.nutrisync.id)"
echo "🔗 Cursor branch URL: https://cursor.nutrisync.pages.dev"
