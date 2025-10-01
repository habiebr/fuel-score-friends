# Cursor Branch Deployment Guide

This project is configured to always deploy from the `cursor` branch to ensure consistent deployments.

## 🚀 Quick Deployment

### Option 1: Use the Deployment Script (Recommended)
```bash
./deploy-cursor.sh
```

### Option 2: Use npm Scripts
```bash
npm run deploy
# or
npm run pwa:deploy
```

## 📋 What the Deployment Does

1. **Branch Check**: Ensures you're on the `cursor` branch
2. **Auto-Switch**: If not on cursor branch, automatically switches to it
3. **Build PWA**: Runs the PWA build process
4. **Deploy**: Deploys to Cloudflare Pages with cursor branch
5. **Confirmation**: Shows deployment URLs

## 🔧 Configuration

### Package.json Scripts
- `npm run deploy` - Full deployment with account ID
- `npm run pwa:deploy` - PWA deployment only
- `npm run cf:deploy` - Cloudflare deployment only

### Deployment Script Features
- ✅ Branch validation
- ✅ Automatic branch switching
- ✅ PWA build
- ✅ Cloudflare Pages deployment
- ✅ Cursor branch targeting
- ✅ Error handling

## 🌐 Deployment URLs

After successful deployment, your PWA will be available at:

- **Latest Deployment**: `https://[deployment-id].nutrisync.pages.dev`
- **Cursor Branch Alias**: `https://cursor.nutrisync.pages.dev`
- **Production**: `https://nutrisync.pages.dev`

## 🔄 Workflow

### Daily Development
1. Work on the `cursor` branch
2. Make your changes
3. Run `./deploy-cursor.sh` to deploy
4. Test on the live URL

### Branch Management
- **cursor**: Development and deployment branch
- **main**: Production branch (optional)

## 🛠️ Troubleshooting

### If Not on Cursor Branch
The script will automatically switch to the cursor branch:
```bash
⚠️  Not on cursor branch. Current branch: main
🔄 Switching to cursor branch...
✅ On cursor branch: cursor
```

### If Deployment Fails
1. Check your Cloudflare authentication: `npx wrangler whoami`
2. Verify you have the correct permissions
3. Check the build output for errors
4. Ensure all dependencies are installed: `npm install`

### Manual Deployment
If the script fails, you can deploy manually:
```bash
# Ensure you're on cursor branch
git checkout cursor

# Build the PWA
npm run build:pwa

# Deploy manually
CLOUDFLARE_ACCOUNT_ID=5a73505af9ed48e44ce4caeaa0fdf73f npx wrangler pages deploy dist --project-name nutrisync --branch=cursor --commit-dirty=true
```

## 📱 PWA Features

Your deployed PWA includes:
- ✅ Installable on mobile devices
- ✅ Offline functionality
- ✅ Auto-updates
- ✅ Mobile-optimized interface
- ✅ Fast loading with caching

## 🔐 Security

- All deployments use your authenticated Cloudflare account
- Account ID is configured: `5a73505af9ed48e44ce4caeaa0fdf73f`
- Deployments are scoped to the `nutrisync` project only

## 📊 Monitoring

Check your deployments in the Cloudflare dashboard:
1. Go to [Cloudflare Pages](https://dash.cloudflare.com/pages)
2. Select the `nutrisync` project
3. View deployment history and logs

## 🎯 Best Practices

1. **Always work on cursor branch** for development
2. **Test locally** before deploying: `npm run preview`
3. **Check deployment URLs** after each deployment
4. **Monitor PWA features** in Chrome DevTools
5. **Keep dependencies updated** regularly

---

**Ready to deploy?** Just run `./deploy-cursor.sh` and your PWA will be live! 🚀
