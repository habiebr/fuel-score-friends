# Building Mobile App with Capacitor

Your app is now configured for native iOS and Android deployment with Apple Health / Google Fit integration!

## 📱 What's Set Up

✅ Capacitor core & platform packages installed  
✅ Configuration file created (`capacitor.config.ts`)  
✅ Health data integration hooks ready  
✅ Garmin .fit file upload working in web  
✅ Hot reload enabled for faster development  

## 🚀 Build Instructions

### Prerequisites

**For iOS:**
- Mac with macOS
- Xcode installed (from App Store)
- Apple Developer account (for device testing)

**For Android:**
- Android Studio installed
- Java Development Kit (JDK)

### Step 1: Export to GitHub

1. Click the **"Export to Github"** button in Lovable
2. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
   cd YOUR_REPO
   ```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Add Native Platforms

**For iOS:**
```bash
npx cap add ios
npx cap update ios
```

**For Android:**
```bash
npx cap add android
npx cap update android
```

### Step 4: Build Web Assets

```bash
npm run build
npx cap sync
```

### Step 5: Add Health Plugin

Install the community health plugin manually:

```bash
npm install @awesome-cordova-plugins/health
npm install cordova-plugin-health
npx cap sync
```

### Step 6: Configure Native Permissions

**For iOS (Apple Health):**

Edit `ios/App/App/Info.plist` and add:

```xml
<key>NSHealthShareUsageDescription</key>
<string>We need access to read your health data to track your nutrition and activity</string>
<key>NSHealthUpdateUsageDescription</key>
<string>We need access to update your health data</string>
```

**For Android (Google Fit):**

Edit `android/app/src/main/AndroidManifest.xml` and add:

```xml
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
```

### Step 7: Open & Run in Native IDE

**For iOS:**
```bash
npx cap open ios
```
Then in Xcode:
- Select your device/simulator
- Click Run (▶️)

**For Android:**
```bash
npx cap open android
```
Then in Android Studio:
- Select your device/emulator
- Click Run (▶️)

## 🔄 Development Workflow

After making code changes in Lovable:

1. Git pull the latest changes:
   ```bash
   git pull origin main
   ```

2. Sync to native platforms:
   ```bash
   npm run build
   npx cap sync
   ```

3. Run on device (the app will hot-reload from Lovable!)

## 📊 Health Data Features

Once built as a native app:

- ✅ **Apple Health** (iOS): Steps, calories, heart rate, active minutes
- ✅ **Google Fit** (Android): Steps, calories, heart rate, active minutes
- ✅ **Garmin .fit files**: Works on both web and mobile
- ✅ **Auto-sync**: Sync health data with one tap in Profile

## 🐛 Troubleshooting

**iOS Build Issues:**
- Make sure Xcode Command Line Tools are installed: `xcode-select --install`
- Clean build folder in Xcode: Product → Clean Build Folder

**Android Build Issues:**
- Check JAVA_HOME is set correctly
- Make sure Android SDK is installed via Android Studio

**Health Plugin Not Working:**
- Verify permissions are added to Info.plist (iOS) or AndroidManifest.xml (Android)
- Test on a real device (health features don't work in simulators/emulators)

## 📚 Resources

- [Capacitor Docs](https://capacitorjs.com/docs)
- [iOS Health Integration](https://developer.apple.com/documentation/healthkit)
- [Google Fit Integration](https://developers.google.com/fit)
- [Lovable Mobile Guide](https://lovable.dev/blogs/mobile-development)

## 🎯 Next Steps

1. Build the mobile app following the steps above
2. Test health data sync on a real device
3. Add App Store / Play Store assets (icon, screenshots)
4. Deploy to TestFlight (iOS) or Internal Testing (Android)
5. Submit for App Store / Play Store review

---

Need help? Check the [Lovable Discord community](https://discord.gg/lovable) or documentation!
