# 🚀 Migrate to Cloud Supabase

## Quick Migration Steps

### 1. Go to Supabase Dashboard
- Open [https://supabase.com/dashboard](https://supabase.com/dashboard)
- Select your project: `qiwndzsrmtxmgngnupml`

### 2. Run the Migration SQL
- Go to **SQL Editor** → **New Query**
- Copy and paste the entire content from `supabase/migrations/20250101000001_complete_goals_migration.sql`
- Click **"Run"**

### 3. Verify Migration
After running the SQL, you should see:
- ✅ `target_date` and `fitness_level` columns added to `profiles` table
- ✅ `marathon_events` table created with sample data
- ✅ RLS policies set up correctly

### 4. Test Your App
- Refresh your webapp at http://localhost:8080
- Go to Goals page
- Try the two-step flow
- Save should now work!

## What This Migration Does

1. **Adds Missing Columns:**
   - `target_date` (DATE) - for race target dates
   - `fitness_level` (TEXT) - for beginner/intermediate/advanced

2. **Creates Marathon Events Table:**
   - Stores marathon events for the calendar
   - Includes sample data for testing
   - Sets up proper RLS policies

3. **Enables Full Goals Flow:**
   - Step 1: Running goal with date and fitness level
   - Step 2: Weekly training plan
   - Marathon calendar integration

## Troubleshooting

If you get any errors:
1. Check that you're in the right project
2. Make sure you have admin privileges
3. Try running the SQL in smaller chunks
4. Check the Supabase logs for detailed error messages

## Next Steps

After migration:
1. Test the goals save functionality
2. Try the marathon calendar
3. Set up your first goal and training plan
4. Enjoy the new two-step flow! 🎉

