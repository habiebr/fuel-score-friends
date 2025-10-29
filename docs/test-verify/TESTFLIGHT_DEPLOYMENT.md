# TestFlight Deployment Guide - Nutrisync

## 📱 Mobile-Optimized Features

Your app is now fully optimized for iOS with:
- ✅ **Touch-friendly targets** (minimum 44x44pt)
- ✅ **iOS safe area insets** (notch & home indicator support)
- ✅ **Optimized spacing** for mobile screens
- ✅ **Active states** for better tap feedback
- ✅ **64x64 FAB** (iOS recommended size)
- ✅ **Production Capacitor config**

## 🚀 Step-by-Step Deployment

### Prerequisites

1. **macOS** with Xcode 15+ installed
2. **Apple Developer Account** ($99/year)
3. **Certificates & Provisioning Profiles** set up
4. **Node.js** and **npm** installed

### Step 1: Build Production Web App

```bash
# Build the PWA for production
npm run build:pwa

# Verify dist folder is created
ls -la dist/
```

### Step 2: Sync Capacitor

```bash
# Install Capacitor CLI if not already
npm install -g @capacitor/cli

# Sync web assets to native project
npx cap sync ios

# This copies your dist/ folder to iOS project
```

### Step 3: Open Xcode

```bash
# Open the iOS project in Xcode
npx cap open ios
```

### Step 4: Configure Xcode Project

#### A. Update Bundle Identifier
1. Select **App** in project navigator
2. Click **Signing & Capabilities**
3. Change **Bundle Identifier** to: `com.nutrisync.app`
4. Select your **Development Team**

#### B. Set Deployment Target
1. Under **General** tab
2. Set **Minimum Deployments** to iOS 14.0 or higher
3. Set **iPhone Deployment Target** to iOS 14.0

#### C. Configure Capabilities
Add these capabilities if needed:
- ✅ **HealthKit** (already configured)
- ✅ **Push Notifications** (optional)
- ✅ **Background Modes** (if using background sync)

#### D. Update Info.plist
Add health data usage descriptions:
```xml
<key>NSHealthShareUsageDescription</key>
<string>Nutrisync needs access to read your health data to track your fitness progress and provide personalized nutrition recommendations.</string>

<key>NSHealthUpdateUsageDescription</key>
<string>Nutrisync needs permission to save your nutrition data to the Health app.</string>
```

### Step 5: Configure App Icons

#### Quick Method (Recommended)
1. Go to **App/App/Assets.xcassets**
2. Right-click **AppIcon**
3. Delete existing icons
4. Drag your 1024x1024 PNG icon
5. Xcode will auto-generate all sizes

#### Your Icons Are Ready:
- `public/apple-touch-icon.png` (180x180)
- `public/pwa-192x192.png` (192x192)
- `public/pwa-512x512.png` (512x512)

### Step 6: Build Archive

1. **Select Target Device**:
   - Click scheme dropdown
   - Select **Any iOS Device (arm64)**

2. **Archive Build**:
   - Menu: **Product** → **Archive**
   - Wait for build to complete (2-5 minutes)

3. **Verify Archive**:
   - **Window** → **Organizer**
   - Your build should appear under **Archives**

### Step 7: Upload to App Store Connect

1. In **Organizer**, select your archive
2. Click **Distribute App**
3. Select **TestFlight & App Store**
4. Click **Next**
5. Choose **Upload**
6. Select your provisioning profile
7. Click **Upload**

### Step 8: Configure TestFlight

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select **My Apps**
3. Click **Nutrisync** (or create new app)
4. Go to **TestFlight** tab
5. Wait for processing (10-30 minutes)

#### Create Test Group
1. Click **Internal Testing** or **External Testing**
2. Click **+** to create group
3. Name: "Beta Testers"
4. Add testers by email
5. Save

#### Enable Beta
1. Select your uploaded build
2. Click **Submit for Review** (for external)
3. Or directly distribute (for internal)

### Step 9: Send Invites

Testers will receive:
1. **Email invitation** from App Store Connect
2. **TestFlight app** download link
3. **Install instructions**

### Step 10: Test on Device

Download TestFlight from App Store:
1. Open TestFlight app
2. Accept invitation
3. Install Nutrisync
4. Test all features!

## 🔧 Production Configuration

### Environment Variables

The app is configured to use production:
- **API URL**: `https://cursor.nutrisync.pages.dev`
- **Supabase**: Uses your production credentials
- **Bundle ID**: `com.nutrisync.app`

### Update Server URL (if needed)

Edit `capacitor.config.ts`:
```typescript
server: {
  url: 'https://your-production-url.com',
  cleartext: true
}
```

## 📱 Mobile Optimizations Applied

### Touch Targets
- ✅ **FAB**: 64x64 pt (iOS recommended)
- ✅ **Buttons**: Minimum 44x44 pt
- ✅ **Cards**: Active states for feedback

### Spacing
- ✅ **Padding**: 16px (4rem) for mobile
- ✅ **Gaps**: 12px (3rem) between elements
- ✅ **Bottom padding**: 28rem for FAB clearance

### Safe Areas
- ✅ **Top**: Respects status bar & notch
- ✅ **Bottom**: Respects home indicator
- ✅ **FAB**: Positioned above home indicator

### Gestures
- ✅ **Active states**: Scale down on tap
- ✅ **Touch manipulation**: CSS optimized
- ✅ **Smooth scrolling**: Native feel

## 🎨 App Store Assets

### App Icon
- **Size**: 1024x1024 px
- **Format**: PNG (no transparency)
- **Location**: `public/pwa-512x512.png` (upscale to 1024)

### Screenshots Required
Capture from iOS Simulator:
1. **6.7" Display** (iPhone 15 Pro Max): 3 required
2. **6.5" Display** (iPhone 14 Plus): Optional
3. **5.5" Display** (iPhone 8 Plus): Optional

Capture these screens:
1. Dashboard with nutrition data
2. Meal logging (FAB open)
3. Weekly trends chart
4. Timeline view
5. Quick recovery feature

### App Preview Video (Optional)
- **Length**: 15-30 seconds
- **Format**: .mov or .mp4
- **Orientation**: Portrait
- Show key features in action

## 📝 App Store Listing

### App Information

**Name**: Nutrisync

**Subtitle**: Marathon Training Nutrition Tracker

**Description**:
```
Nutrisync is the ultimate nutrition companion for marathon runners and endurance athletes.

KEY FEATURES:
• Smart Calorie Tracking - Adjusts based on your workouts
• Macro Nutrient Balance - Protein, Carbs, Fat tailored for runners
• Weekly Nutrition Trends - Track your progress over time
• Meal Timeline - Pre/post-run fueling recommendations
• Quick Meal Logging - Log meals in seconds
• Apple Health Integration - Syncs with your fitness data
• Marathon-Specific Advice - Science-based recommendations

PERFECT FOR:
✓ Marathon training
✓ Half-marathon prep
✓ 5K & 10K runners
✓ Endurance athletes
✓ Running enthusiasts

FEATURES:
• Beautiful calorie ring visualization
• Animated macro progress bars
• Runner-specific nutrition insights
• 7-day nutrition analytics
• Meal-by-meal timeline view
• Hydration tracking
• Quick-add meal templates
• Dark mode support

Based on scientific nutrition guidelines from ACSM and IOC.
```

**Keywords**: marathon, nutrition, running, fitness, calories, macros, health, training

**Category**: Health & Fitness

**Secondary**: Sports

## 🔒 Privacy & Permissions

### Privacy Policy
Create a privacy policy at:
- Your website or
- Use [Privacy Policy Generator](https://www.privacypolicygenerator.info/)

### Data Collection
Declare in App Store Connect:
- ✅ Health & Fitness Data
- ✅ User Content (food logs)
- ✅ Identifiers (email for account)

### Health Data Usage
Clearly state:
- Read: Steps, Calories, Heart Rate, Distance
- Purpose: Personalized nutrition recommendations

## 🐛 Testing Checklist

Before submitting:
- [ ] Test on real iOS device
- [ ] All navigation works
- [ ] FAB opens meal log
- [ ] Tabs switch correctly
- [ ] Data loads properly
- [ ] Images display correctly
- [ ] Safe areas respected (notch)
- [ ] Keyboard doesn't cover inputs
- [ ] Auth flow works
- [ ] No console errors

## 🚦 Build Versioning

Update version before each build:

**In Xcode**:
1. Select **App** target
2. **General** tab
3. **Version**: 1.0.0 (increment for each release)
4. **Build**: 1 (increment for each upload)

**Semantic Versioning**:
- **Major.Minor.Patch** (e.g., 1.0.0)
- Major: Breaking changes
- Minor: New features
- Patch: Bug fixes

## 🎯 Release Workflow

### Internal Testing (Fast)
1. Upload build
2. Add internal testers
3. Available immediately
4. Max 100 testers

### External Testing (Slower)
1. Upload build
2. Submit for beta review
3. Wait for approval (1-2 days)
4. Add up to 10,000 testers

### Production Release
1. Complete external testing
2. Submit for App Store review
3. Wait for approval (2-7 days)
4. Release to public

## 📊 Analytics & Monitoring

### TestFlight Metrics
Track in App Store Connect:
- Install rate
- Session duration
- Crash reports
- User feedback

### Crash Reporting
Already integrated:
- Vite error boundaries
- React error handling

## 🔄 Update Workflow

### For New Features
1. Update web app (`npm run build:pwa`)
2. Sync Capacitor (`npx cap sync ios`)
3. Increment build number
4. Archive & upload
5. Submit to TestFlight

### Hot Updates (Web Only)
Since you're using a remote server:
- Web changes deploy automatically
- No new TestFlight build needed
- Perfect for bug fixes & content updates

## 🆘 Troubleshooting

### Build Fails
```bash
# Clean build folder
rm -rf ios/App/App/build
rm -rf ios/App/DerivedData

# Clean Xcode
In Xcode: Product → Clean Build Folder

# Retry
npx cap sync ios
npx cap open ios
```

### Code Signing Issues
1. Xcode → **Preferences** → **Accounts**
2. Select your Apple ID
3. Click **Download Manual Profiles**
4. Retry build

### Upload Fails
- Check bundle ID matches App Store Connect
- Verify signing certificate is valid
- Ensure version/build is incremented

## 🎉 Success Checklist

- [ ] App builds without errors
- [ ] Archive created successfully
- [ ] Uploaded to App Store Connect
- [ ] Processing complete (no errors)
- [ ] TestFlight invite sent
- [ ] Installed on test device
- [ ] All features work on device
- [ ] Screenshots captured
- [ ] App Store listing complete
- [ ] Privacy policy uploaded

---

## 📱 Quick Commands

```bash
# Full deployment sequence
npm run build:pwa           # Build web app
npx cap sync ios            # Sync to iOS
npx cap open ios            # Open Xcode

# Then in Xcode:
# Product → Archive → Distribute → Upload
```

## 🔗 Useful Links

- [App Store Connect](https://appstoreconnect.apple.com)
- [Capacitor iOS Docs](https://capacitorjs.com/docs/ios)
- [TestFlight Guide](https://developer.apple.com/testflight/)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/ios)

---

**Your app is now mobile-ready!** 📱✨

**Production URL**: https://cursor.nutrisync.pages.dev  
**Bundle ID**: com.nutrisync.app  
**Status**: ✅ Ready for TestFlight

