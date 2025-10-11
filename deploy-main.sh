#!/bin/bash
set -euo pipefail

echo "🚀 Starting production deployment from main branch..."

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "main" ]; then
  echo "⚠️  Not on main branch. Current: $current_branch"
  echo "🔄 Switching to main..."
  git checkout main
  echo "🔁 Merging latest from beta..."
  git merge --no-edit beta || true
fi

echo "🔨 Building PWA..."
npm run build:pwa

echo "🌐 Deploying to Cloudflare Pages (main) ..."
CLOUDFLARE_ACCOUNT_ID=5a73505af9ed48e44ce4caeaa0fdf73f \
npx wrangler pages deploy dist --project-name nutrisync --branch=main --commit-dirty=true

echo "✅ Production deployment triggered. Ensure domain mapping points app.nutrisync.id to the Pages project main branch."


