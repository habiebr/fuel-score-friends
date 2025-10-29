# Cloudflare Pages Deployment Guide

This guide will help you deploy your Fuel Score Friends app to Cloudflare Pages using Wrangler.

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Install globally with `npm install -g wrangler`
3. **Node.js**: Version 18 or higher

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:
```bash
cp cloudflare.env.example .env.local
```

Edit `.env.local` with your actual values:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `GROQ_API_KEY`: Your Groq API key

### 3. Authenticate with Cloudflare

```bash
wrangler login
```

### 4. Build the Project

```bash
npm run build:cf
```

### 5. Deploy to Cloudflare Pages

#### Option A: Deploy via Wrangler CLI
```bash
npm run wrangler:deploy
```

#### Option B: Deploy via Cloudflare Dashboard
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to Pages
3. Click "Create a project"
4. Connect your GitHub repository
5. Set build command: `npm run build:cf`
6. Set build output directory: `dist`
7. Add environment variables in the Pages settings

## Environment Variables

Set these in Cloudflare Pages dashboard:

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key | Yes |
| `GROQ_API_KEY` | Your Groq API key for AI functions | Yes |

## Build Configuration

The project is configured with:
- **Build Command**: `npm run build:cf`
- **Build Output Directory**: `dist`
- **Node.js Version**: 18.x
- **Framework Preset**: Vite

## Custom Domain (Optional)

1. In Cloudflare Pages dashboard, go to your project
2. For beta, open the `nutrisync-beta` project → Custom domains
3. Add `beta.nutrisync.id` and follow DNS instructions (CNAME to pages.dev)
4. Ensure SSL is active and domain is verified

## Disable Preview Deployments (Recommended)

In each Pages project:
1. Go to Settings → Previews
2. Toggle off "Preview deployments"
3. Save

Notes:
- Keep production branch set to `beta` for `nutrisync-beta`
- Keep production branch set to `main` for `nutrisync` (primary prod)

## Monitoring and Analytics

- **Analytics**: Available in Cloudflare Pages dashboard
- **Logs**: View real-time logs in the Pages dashboard
- **Performance**: Monitor Core Web Vitals

## Troubleshooting

### Common Issues

1. **Build Fails**: Check environment variables are set correctly
2. **404 on Refresh**: Ensure `_redirects` file is in the `dist` folder
3. **API Errors**: Verify Supabase and Groq API keys are correct

### Debug Commands

```bash
# Test build locally
npm run build:cf

# Preview locally with Wrangler
npm run wrangler:dev

# Check Wrangler configuration
wrangler whoami
```

## Scripts Reference

- `npm run build:cf` - Build for Cloudflare Pages
- `npm run wrangler:dev` - Preview locally with Wrangler
- `npm run wrangler:deploy` - Deploy to Cloudflare Pages
- `npm run cf:deploy` - Build and deploy in one command

## Support

For issues with:
- **Cloudflare Pages**: Check [Cloudflare Docs](https://developers.cloudflare.com/pages/)
- **Wrangler CLI**: Check [Wrangler Docs](https://developers.cloudflare.com/workers/wrangler/)
- **This App**: Check the project repository
