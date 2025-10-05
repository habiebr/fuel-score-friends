# 🚀 Complete Supabase Migration Guide

## 📋 **Migration Steps**

### **Step 1: Run Database Migration**
1. **Go to [Supabase Dashboard](https://supabase.com/dashboard)**
2. **Select your "nutrisync" project**
3. **Go to SQL Editor** → **New Query**
4. **Copy and paste** the entire content from `complete_migration.sql`
5. **Click "Run"**

### **Step 2: Get Your Supabase Credentials**
1. **In your Supabase Dashboard** → **Settings** → **API**
2. **Copy your Project URL**: `https://eecdbddpzwedficnpenm.supabase.co`
3. **Copy your anon/public key** (starts with `eyJ...`)

### **Step 3: Update App Configuration**
Create a `.env` file in your project root with:

```bash
# Supabase Configuration for NutriSync
VITE_SUPABASE_URL=https://eecdbddpzwedficnpenm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_actual_anon_key_here
```

**Replace `your_actual_anon_key_here` with your real anon key from Step 2.**

### **Step 4: Test the Migration**
1. **Start your development server**: `npm run dev`
2. **Open** http://localhost:8080
3. **Test the Goals page** - should save without errors now!

---

## 🗄️ **What Gets Migrated**

### **Database Tables:**
- ✅ `profiles` - User profiles with goals and training plans
- ✅ `nutrition_scores` - Daily nutrition tracking
- ✅ `food_logs` - Individual food entries
- ✅ `daily_meal_plans` - AI meal recommendations
- ✅ `wearable_data` - Fitness tracker data
- ✅ `wearable_laps` - Detailed workout analysis
- ✅ `marathon_events` - Marathon event database
- ✅ `friends` - Social features

### **Security & Features:**
- ✅ **Row Level Security (RLS)** on all tables
- ✅ **User authentication** and data isolation
- ✅ **Social features** (friends can view nutrition scores)
- ✅ **Public marathon events** for browsing
- ✅ **Auto-triggers** for user creation and timestamps
- ✅ **Sample data** for testing

### **Missing Columns Fixed:**
- ✅ `target_date` - for race target dates
- ✅ `fitness_level` - for beginner/intermediate/advanced

---

## 🎯 **Expected Results**

After migration:
1. **Goals page will save successfully** ✅
2. **Two-step flow will work** (goal → training plan) ✅
3. **Marathon calendar will show events** ✅
4. **All database operations will work** ✅
5. **User authentication will work** ✅

---

## 🔧 **Troubleshooting**

### **If migration fails:**
1. **Check you're in the right project** (nutrisync)
2. **Run the SQL in smaller chunks**
3. **Check Supabase logs** for detailed errors

### **If app still has issues:**
1. **Verify your `.env` file** has correct credentials
2. **Restart your dev server** after adding `.env`
3. **Check browser console** for any errors

### **If you need help:**
- Check the Supabase Dashboard logs
- Verify all tables were created successfully
- Make sure RLS policies are enabled

---

## 🎉 **You're All Set!**

Once migration is complete, your NutriSync app will be fully connected to your cloud Supabase database with all features working! 🚀

---

## 🔌 Strava Integration

Add these Function env vars in Supabase:

```
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=https://<project>.functions.supabase.co/strava-auth?action=callback
STRAVA_WEBHOOK_VERIFY_TOKEN=some-random-token
```

Edge Functions added:
- `strava-auth` (actions: `start`, `callback`)
- `strava-webhook` (GET verify, POST events)
