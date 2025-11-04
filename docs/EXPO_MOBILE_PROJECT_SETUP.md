# Expo Mobile Project - Project Structure Reference

## 🚀 Expo Mobile App Created!

**Location**: `/Users/habiebraharjo/Project/nutrisync/nutrisync-mobile`

### Project Status

✅ **Expo Project**: Initialized and configured  
✅ **Dependencies**: Installed (routing, UI, notifications, health, Supabase)  
✅ **Project Structure**: Created (services, hooks, components, types)  
✅ **Core Services**: Ready (Supabase, Health, Notifications)  
✅ **Setup Guide**: Complete (SETUP_GUIDE.md in mobile project)  

### Key Files Created

**Services** (Core functionality)
- `src/services/supabase.ts` - Supabase client with SecureStore
- `src/services/health.service.ts` - Apple Health API integration
- `src/services/notification.service.ts` - Notifications system

**Documentation**
- `SETUP_GUIDE.md` - Complete implementation guide (Steps 1-8)
- Follow this guide to complete the setup

### Next Steps (In Order)

1. **Configure Environment Variables** (5 min)
   - Create `.env.local` in `nutrisync-mobile/`
   - Add SUPABASE_URL, SUPABASE_ANON_KEY, PROJECT_ID

2. **Create Authentication Hook** (10 min)
   - File: `src/hooks/useAuth.ts`
   - Copy code from SETUP_GUIDE.md Step 2

3. **Create Health Sync Hook** (10 min)
   - File: `src/hooks/useHealthSync.ts`
   - Copy code from SETUP_GUIDE.md Step 3

4. **Update app.json** (5 min)
   - Copy configuration from SETUP_GUIDE.md Step 4

5. **Create App Layout** (5 min)
   - File: `app/_layout.tsx`
   - Copy code from SETUP_GUIDE.md Step 5

6. **Create Login Screen** (10 min)
   - File: `app/(auth)/login.tsx`
   - Copy code from SETUP_GUIDE.md Step 6

7. **Create Dashboard Screen** (15 min)
   - File: `app/(tabs)/dashboard.tsx`
   - Copy code from SETUP_GUIDE.md Step 7

8. **Create Tab Navigation** (10 min)
   - File: `app/(tabs)/_layout.tsx`
   - Copy code from SETUP_GUIDE.md Step 8

### Getting Started Commands

```bash
# Navigate to mobile project
cd nutrisync-mobile

# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android simulator
npm run android

# Check for errors
npm run lint

# Generate native code for native build
npx expo prebuild --clean

# Build with EAS
npx eas build --platform ios
```

### Project Structure

```
nutrisync-mobile/
├── app/
│   ├── (auth)/
│   │   └── login.tsx (To create - Step 6)
│   ├── (tabs)/
│   │   ├── _layout.tsx (To create - Step 8)
│   │   ├── dashboard.tsx (To create - Step 7)
│   │   ├── meals.tsx (Placeholder)
│   │   └── training.tsx (Placeholder)
│   └── _layout.tsx (To create - Step 5)
├── src/
│   ├── services/
│   │   ├── supabase.ts ✅
│   │   ├── health.service.ts ✅
│   │   └── notification.service.ts ✅
│   ├── hooks/
│   │   ├── useAuth.ts (To create - Step 2)
│   │   └── useHealthSync.ts (To create - Step 3)
│   ├── components/
│   └── types/
├── assets/
│   ├── icon.png (Add your logo)
│   ├── splash.png (Add splash screen)
│   └── adaptive-icon.png (Android icon)
├── SETUP_GUIDE.md ✅
├── app.json (Update - Step 4)
├── .env.local (Create - Step 1)
├── package.json ✅
├── tsconfig.json ✅
└── README.md (Default)
```

### Key Dependencies Installed

```json
{
  "expo": "~51.0.0",
  "react-native": "^0.81.0",
  "expo-router": "Latest",
  "expo-notifications": "Latest",
  "expo-secure-store": "Latest",
  "react-native-paper": "^5.11.0",
  "react-native-health": "Latest",
  "@supabase/supabase-js": "Latest",
  "react-hook-form": "Latest",
  "zod": "Latest",
  "date-fns": "Latest",
  "@tanstack/react-query": "Latest"
}
```

### Important Notes

⚠️ **Apple Health Integration**
- Requires bare workflow or prebuild
- `react-native-health` doesn't work in Expo Go
- Must run: `npx expo prebuild` before testing
- Will need to build with EAS or Xcode

⚠️ **Native Code**
- Some packages require native compilation
- Use `npx expo prebuild --clean` to generate iOS/Android directories
- Test on physical device or simulator after prebuild

⚠️ **Environment Variables**
- Create `.env.local` (not tracked in git)
- Never commit secrets to repository
- Use `.env.example` for template

### Troubleshooting

**Error: "Cannot find module 'react-native-health'"**
- Normal until you prebuild
- Run: `npx expo prebuild --clean`

**iOS Build Fails**
- Ensure Xcode is installed
- Run: `xcode-select --install`
- Try: `npx expo prebuild --clean && npm run ios`

**Notification Permissions Not Requested**
- Only works on physical device
- Simulator has limited permissions support
- Test on real iPhone/Android device

### Quick Reference

| Command | Purpose |
|---------|---------|
| `npm start` | Start dev server |
| `npm run ios` | Open in iOS simulator |
| `npm run android` | Open in Android simulator |
| `npx expo prebuild` | Generate native code |
| `npx eas build` | Build with EAS |
| `npx eas submit` | Submit to TestFlight/Play Store |

### Integration with Main Repo

This mobile project is separate but shares:
- **Database**: Same Supabase instance
- **Business Logic**: Services can be shared
- **Authentication**: Same Supabase auth

To share code with web app, consider:
1. Extract shared services to `/shared` folder
2. Reference in both `web/` and `mobile/`
3. Keep UI/navigation separate

### Testing Checklist

- [ ] Environment variables configured
- [ ] Supabase credentials working
- [ ] Login screen works
- [ ] Dashboard displays
- [ ] Health permissions request works
- [ ] Notifications can be scheduled
- [ ] App works in iOS simulator
- [ ] App works on physical device (after prebuild)
- [ ] TestFlight build successful

### Documentation

- **Setup Guide**: `nutrisync-mobile/SETUP_GUIDE.md`
- **Expo Docs**: https://docs.expo.dev
- **React Native Paper**: https://callstack.github.io/react-native-paper/
- **Main Project Docs**: `docs/EXPO_*.md` in main repo

---

**Start with Step 1 in SETUP_GUIDE.md and follow through all 8 steps!** 🚀
