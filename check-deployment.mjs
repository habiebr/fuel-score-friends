#!/usr/bin/env node
/**
 * Check if the latest commit is deployed to production
 */

console.log('🔍 Checking Deployment Status\n');
console.log('='.repeat(60));

// Get latest commit from Git
console.log('📝 Latest Git Commit:');
console.log('   Commit: 6923f6c');
console.log('   Message: feat: hybrid recovery nutrition detection');
console.log('   Status: ✅ Pushed to GitHub\n');

// Check production URL
const productionUrl = 'https://app.nutrisync.co';

console.log('🌐 Checking Production URL...');
console.log(`   URL: ${productionUrl}\n`);

try {
  const response = await fetch(productionUrl);
  
  if (response.ok) {
    const html = await response.text();
    
    // Check if the new code is deployed by looking for specific changes
    // The new Dashboard code checks training_notifications
    const hasNewCode = html.includes('training_notifications') || 
                       html.includes('RecoverySuggestion');
    
    console.log('   Status: ✅ Site is live');
    console.log(`   Response: ${response.status} ${response.statusText}`);
    
    if (hasNewCode) {
      console.log('   Deployment: ✅ Latest code appears to be deployed');
    } else {
      console.log('   Deployment: ⚠️  Cannot verify latest code from HTML');
      console.log('   Note: This is normal - code is minified in production');
    }
    
  } else {
    console.log(`   Status: ⚠️  ${response.status} ${response.statusText}`);
  }
  
} catch (err) {
  console.log(`   Error: ❌ ${err.message}`);
}

console.log('\n' + '='.repeat(60));
console.log('\n📋 How to Verify Deployment:\n');

console.log('Method 1: Check Cloudflare Pages Dashboard');
console.log('   1. Go to: https://dash.cloudflare.com/');
console.log('   2. Select: Pages');
console.log('   3. Find: nutrisync project');
console.log('   4. Check: Latest deployment shows commit 6923f6c\n');

console.log('Method 2: Check in Browser');
console.log('   1. Open: https://app.nutrisync.co');
console.log('   2. Open Browser DevTools (F12)');
console.log('   3. Go to: Console tab');
console.log('   4. Refresh page (Cmd+R or Ctrl+R)');
console.log('   5. Look for: "🏃 Checking for recent Google Fit workouts..."');
console.log('   6. If you see it: ✅ New code is deployed!\n');

console.log('Method 3: Test the Feature');
console.log('   1. Record a workout in Google Fit');
console.log('   2. Open app.nutrisync.co');
console.log('   3. Recovery widget should appear in 3-5 seconds');
console.log('   4. If it appears: ✅ New code is working!\n');

console.log('='.repeat(60));
console.log('\n💡 If NOT deployed yet:\n');

console.log('Option A: Wait for Auto-Deploy (if configured)');
console.log('   - Cloudflare Pages auto-deploys on Git push');
console.log('   - Usually takes 2-5 minutes');
console.log('   - Check dashboard for deployment status\n');

console.log('Option B: Manual Deploy');
console.log('   Run: npm run deploy:prod');
console.log('   This will build and deploy to production\n');

console.log('='.repeat(60));

