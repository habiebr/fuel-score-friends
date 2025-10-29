# Storage Bucket Issue Report

**Date:** October 13, 2025  
**Issue:** Food photo uploads failing - storage buckets not configured  
**Severity:** 🔴 CRITICAL - Blocks core feature for ALL users

## Problem Summary

**NO users can upload food photos** because the required storage buckets (`food-photos` and `fitness-screenshots`) were never created in the production database.

### Evidence

```bash
$ node list-buckets.mjs
📦 Listing all storage buckets...
⚠️  No buckets found
```

The migration files exist locally but were never applied to production:
- ✅ `supabase/migrations/20250101150000_create_fitness_screenshots_bucket.sql` - exists
- ✅ `supabase/migrations/20250101150001_create_food_photos_bucket.sql` - exists
- ❌ Buckets not created in production database

## Impact

### Affected Features
1. **Food Photo Upload** - Users cannot upload food images for AI analysis
2. **Fitness Screenshot Upload** - Users cannot upload activity screenshots
3. **AI Meal Analysis** - Entire photo-based food logging is broken

### User Experience
When users try to upload a food photo:
1. Frontend tries to upload to `storage.from('food-photos')`
2. Supabase returns error: bucket doesn't exist
3. User sees error message
4. Food logging only works with manual entry

## Root Cause

The storage bucket migrations were created but never applied to production. The workflow should have been:

```bash
# Create migrations (✅ Done)
supabase migrations create create_food_photos_bucket

# Apply to production (❌ Never done)
supabase db push
```

## Solution

### Option 1: Apply via SQL Script (Recommended)

Created `apply-storage-buckets.sql` and `apply-storage-buckets.mjs` to fix this issue.

**Run:**
```bash
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
node apply-storage-buckets.mjs
```

This will:
1. Create `food-photos` bucket (10MB limit, private)
2. Create `fitness-screenshots` bucket (10MB limit, private)
3. Add RLS policies so authenticated users can upload/view/delete their own files
4. Verify buckets are created correctly

### Option 2: Manual Fix via Supabase Dashboard

1. **Go to:** Supabase Dashboard > Storage > Create new bucket
2. **Create "food-photos" bucket:**
   - Name: `food-photos`
   - Public: `false` (private)
   - File size limit: `10485760` (10MB)
   - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/heic`

3. **Create "fitness-screenshots" bucket:**
   - Same settings as food-photos

4. **Add RLS Policies:**
   - Go to Storage > Policies
   - For each bucket, create 3 policies:
     - INSERT: Users can upload their own files
     - SELECT: Users can view their own files
     - DELETE: Users can delete their own files
   - Use the policy definitions from `apply-storage-buckets.sql`

### Option 3: Push All Migrations

```bash
# This will apply ALL pending migrations
supabase db push
```

⚠️ **Warning:** This applies ALL migrations, not just storage buckets. Review pending migrations first.

## Storage Bucket Configuration

### food-photos Bucket
```sql
bucket_id: 'food-photos'
public: false
file_size_limit: 10485760 (10MB)
allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
```

### RLS Policies (food-photos)
```sql
-- INSERT: Users can upload their own files
WITH CHECK (bucket_id = 'food-photos' AND auth.uid()::text = (storage.foldername(name))[1])

-- SELECT: Users can view their own files
USING (bucket_id = 'food-photos' AND auth.uid()::text = (storage.foldername(name))[1])

-- DELETE: Users can delete their own files
USING (bucket_id = 'food-photos' AND auth.uid()::text = (storage.foldername(name))[1])
```

### File Path Structure
Files are stored with user ID as folder:
```
food-photos/
  └── {user_id}/
      ├── 1697123456789_abc123.jpg
      ├── 1697123567890_def456.png
      └── ...
```

This structure ensures:
- Users can only access their own files (enforced by RLS)
- No file name conflicts between users
- Easy cleanup when user deletes account

## Verification Steps

After applying the fix, verify it worked:

```bash
# 1. List buckets
export VITE_SUPABASE_ANON_KEY="eyJh..."
node list-buckets.mjs

# Expected output:
# Found 2 bucket(s):
# 1. food-photos
# 2. fitness-screenshots

# 2. Test storage access
node test-storage-access.mjs

# Expected output:
# ✅ food-photos bucket exists
# ✅ Users can upload when authenticated
```

## Testing in Production

Once buckets are created, test with a real user:

1. **Sign in to app:** https://app.nutrisync.id
2. **Go to Food Tracker**
3. **Click camera icon** to upload food photo
4. **Select a food image**
5. **Verify:**
   - ✅ "Uploading image..." completes
   - ✅ "Analyzing food with AI..." runs
   - ✅ Nutrition data appears
   - ✅ Can save to food log

## Prevention

To prevent this in the future:

1. **Always apply migrations after creating them:**
   ```bash
   supabase db push
   ```

2. **Add to deployment checklist:**
   - [ ] Check for pending migrations
   - [ ] Apply migrations to production
   - [ ] Verify critical resources (storage buckets, tables, policies)

3. **Add monitoring:**
   - Alert when storage upload fails
   - Check bucket existence in health check endpoint

## Related Files

- `supabase/migrations/20250101150001_create_food_photos_bucket.sql` - Food photos bucket migration
- `supabase/migrations/20250101150000_create_fitness_screenshots_bucket.sql` - Fitness screenshots bucket migration
- `src/components/FoodTrackerDialog.tsx` - Food upload UI component
- `supabase/functions/nutrition-ai/index.ts` - AI analysis edge function
- `apply-storage-buckets.sql` - Fix script (SQL)
- `apply-storage-buckets.mjs` - Fix script (Node.js)

## Next Steps

1. ✅ **URGENT:** Apply storage bucket fix using one of the solutions above
2. ✅ **Verify:** Test food photo upload with real user account
3. ✅ **Monitor:** Check error logs to ensure uploads are working
4. ✅ **Document:** Update deployment procedures to prevent similar issues

---

**Status:** 🔴 CRITICAL - Awaiting fix deployment  
**Owner:** DevOps / Database Admin  
**ETA:** Can be fixed in < 5 minutes with proper credentials
