#!/bin/bash

# Deploy script for beta branch
# This script ensures we're on the beta branch and deploys from there

set -e  # Exit on any error

echo "🚀 Starting deployment from beta branch..."

# Check if we're on the beta branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "beta" ]; then
    echo "⚠️  Not on beta branch. Current branch: $CURRENT_BRANCH"
    echo "🔄 Switching to beta branch..."
    git checkout beta
fi

echo "✅ On beta branch: $(git branch --show-current)"

# Build the PWA
echo "🔨 Building PWA..."
npm run build:pwa

# Deploy to Cloudflare Pages: beta project for beta branch
echo "🌐 Deploying to Cloudflare Pages (beta project)..."
CLOUDFLARE_ACCOUNT_ID=5a73505af9ed48e44ce4caeaa0fdf73f npx wrangler pages deploy dist --project-name nutrisync-beta --branch=beta --commit-dirty=true

echo "✅ Deployment complete!"
echo "🌍 Beta PWA is live at: https://nutrisync-beta.pages.dev (map to beta.nutrisync.id)"
echo "🔗 Beta branch URL: https://beta.nutrisync.pages.dev"



