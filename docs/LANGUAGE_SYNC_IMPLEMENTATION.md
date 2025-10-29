# Language Preference Cross-Device Sync

**Status:** ✅ Implemented & Deployed to Beta

## Summary

Language preferences are now saved to the user's profile and synced across all devices. When a user changes their language on one device, it will be automatically synced to all other devices.

## What Was Implemented

### 1. Database Migration
- Added `language_preference` column to `profiles` table
- Migration file: `supabase/migrations/20251220000000_add_language_preference.sql`
- Default value: `'en'` (English)

### 2. TypeScript Types
- Updated `src/integrations/supabase/types.ts`
- Added `language_preference` to Row, Insert, and Update types

### 3. LanguageContext Updates
- Modified `src/contexts/LanguageContext.tsx` to:
  - Load language preference from Supabase on startup
  - Save language preference to Supabase when changed
  - Fallback to localStorage if Supabase unavailable
  - Automatically get user ID from session

### 4. Language Switcher
- Already visible in Profile page (`src/pages/ProfileNew.tsx`)
- No changes needed - it automatically uses the updated context

## How to Apply Migration

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Paste the SQL from `supabase/migrations/20251220000000_add_language_preference.sql`
5. Click **Run**

### Option 2: Via Supabase CLI
```bash
supabase db push
```

## How It Works

### On Login/App Start
1. Check if user is logged in
2. If logged in, load language preference from Supabase
3. If not logged in or no preference found, use localStorage
4. Apply the language to the app

### When Language Changes
1. Save to localStorage immediately (for offline support)
2. Save to Supabase profile (for cross-device sync)
3. Update i18n configuration

### Fallback Strategy
- **Logged in**: Supabase → localStorage → 'en' (default)
- **Not logged in**: localStorage → 'en' (default)

## Testing

### Test Cross-Device Sync
1. Login on Device A
2. Change language to Bahasa Indonesia
3. Login on Device B
4. Language should automatically be Bahasa Indonesia ✅

### Test Offline Support
1. Change language while online
2. Go offline
3. Reload app
4. Language should be preserved from localStorage ✅

### Test New User
1. New user login
2. Should default to English (en)
3. Change language
4. Should save preference for future sessions ✅

## Supported Languages

- **English (en)** - 🇺🇸 Default
- **Bahasa Indonesia (id)** - 🇮🇩

## Files Changed

- `src/contexts/LanguageContext.tsx` - Cross-device sync logic
- `src/integrations/supabase/types.ts` - TypeScript types
- `supabase/migrations/20251220000000_add_language_preference.sql` - Database migration
- No changes needed to UI components (LanguageSwitcher already in place)

## Deployment

✅ Deployed to: https://beta.nutrisync.id  
✅ Committed to: GitHub main branch

## Next Steps

1. **Apply the migration** to Supabase (see instructions above)
2. **Test** the cross-device sync with multiple devices
3. **Monitor** for any issues with language persistence
4. **Consider** adding more languages in the future

