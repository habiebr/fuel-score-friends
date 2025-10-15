# Demo Account Setup - Complete Package

**Date:** October 14, 2025  
**Status:** ✅ READY TO USE

---

## 📦 What's Included

I've created a complete demo account setup system with **3 files**:

### 1. `create-demo-account.mjs` - Automated JavaScript/Node.js Script
**Best for:** Quick, automated setup with minimal effort

**Features:**
- Creates auth user programmatically
- Populates all demo data automatically
- Progress indicators and error handling
- Customizable parameters

**Usage:**
```bash
# Step 1: Create auth user
node create-demo-account.mjs create-auth demo@nutrisync.id Demo2025!

# Step 2: Populate data (use user ID from step 1)
node create-demo-account.mjs populate <user-id>
```

### 2. `create-demo-account.sql` - SQL Script
**Best for:** Direct database execution, SQL-savvy users

**Features:**
- Single SQL transaction
- Complete data setup in one go
- Can run via Supabase Dashboard SQL Editor
- Easy to customize values

**Usage:**
1. Create auth user via Supabase Dashboard
2. Update `demo_user_id` in SQL file
3. Run in SQL Editor or via psql

### 3. `DEMO_ACCOUNT_GUIDE.md` - Complete Documentation
**Best for:** Understanding the full process, troubleshooting

**Includes:**
- Three different methods (script, manual, SQL)
- Detailed account specifications
- Verification queries
- Troubleshooting guide
- Security notes
- Customization options

---

## 🎯 Demo Account Specifications

### User Profile
```
Name: Demo Runner
Age: 32 years old
Sex: Male
Height: 175 cm
Weight: 68 kg
Level: Intermediate Runner
Goal: Marathon Sub-3:30 (Jakarta Marathon 2025)
```

### Training Data (7 Days)
```
✅ Monday: Easy Run (8.5km, 45min)
✅ Tuesday: Tempo Run (12km, 60min, 780 cal)
✅ Wednesday: Rest Day
✅ Thursday: Intervals (10km, 50min)
✅ Friday: Easy Run (7km, 40min)
✅ Saturday: Long Run (22km, 120min, 1450 cal)
✅ Sunday: Recovery Run (5km, 30min)
```

### Nutrition Data (7 Days)
```
✅ ~50 food log entries
✅ Breakfast: Oatmeal, yogurt, fruits
✅ Lunch: Grilled chicken, rice, salad
✅ Dinner: Salmon, sweet potato, vegetables
✅ Snacks: Protein shakes, fruits, nuts
✅ Daily scores: 72-88% (Good to Excellent range)
```

### AI Meal Plans (Today + Tomorrow)
```
✅ Indonesian food suggestions
   - Nasi goreng telur (Fried rice)
   - Ayam bakar (Grilled chicken)
   - Ikan bakar (Grilled fish)
   - Gado-gado (Salad with peanut sauce)
   - Tumis kangkung (Stir-fried vegetables)

✅ Balanced macros
   - Breakfast: 650 kcal
   - Lunch: 750 kcal
   - Dinner: 720 kcal
```

### Wearable Data (7 Days)
```
✅ Steps: 3,200 - 28,500 daily
✅ Calories burned: 520 - 1,450
✅ Heart rate: 65-155 bpm
✅ Active minutes: 0-120 min
✅ Distance: 0-22km
```

---

## 🚀 Quick Start (Choose One Method)

### Method A: Fully Automated (Fastest - 2 minutes)

```bash
# Requires: SERVICE_ROLE_KEY in .env

node create-demo-account.mjs create-auth demo@nutrisync.id Demo2025!
node create-demo-account.mjs populate <user-id-from-above>
```

### Method B: Semi-Automated (Recommended - 3 minutes)

```bash
# 1. Create user manually in Supabase Dashboard
#    Email: demo@nutrisync.id, Password: Demo2025!
#    Copy the User ID

# 2. Run populate script
node create-demo-account.mjs populate <user-id>
```

### Method C: SQL Direct (Alternative - 3 minutes)

```bash
# 1. Create user manually in Supabase Dashboard
# 2. Update demo_user_id in create-demo-account.sql
# 3. Run SQL in Supabase Dashboard > SQL Editor
```

---

## 📊 What Gets Created

| Data Type | Count | Description |
|-----------|-------|-------------|
| **User Profile** | 1 | Complete runner profile with goals |
| **Training Activities** | 7 | Last 7 days of workouts |
| **Food Logs** | ~50 | Breakfast, lunch, dinner, snacks |
| **Nutrition Scores** | 7 | Daily nutrition ratings |
| **Meal Plans** | 6 | Today (3) + Tomorrow (3) |
| **Wearable Data** | 7 | Steps, calories, heart rate |
| **Marathon Event** | 1 | Race registration |

**Total:** ~80 database records with realistic, interconnected data

---

## ✅ Features You Can Demo

### Dashboard Page
- 📊 Today's unified score with breakdown
- 🏃 Training load classification (easy/moderate/quality)
- 📈 Weekly scores trend
- 🎯 Race goal countdown widget
- 🍽️ Meal score with colorful progress bar
- ⏰ Pre-training fueling reminder (collapsible)

### Goals Page
- 📅 7-day training calendar
- 🎨 Color-coded activities (rest/easy/moderate/quality)
- ✏️ Edit and manage activities
- 🏃 Automatic intensity classification
- 📍 Long run designation

### Nutrition Page
- 🍽️ Food log entries with search
- 📊 Meal-by-meal breakdown
- 📈 Macro tracking (protein/carbs/fat)
- 🎯 Daily nutrition scores
- 📸 Photo upload capability

### Meal Plan Page
- 🤖 AI-generated meal suggestions
- 🇮🇩 Indonesian food recommendations
- 📊 Calorie and macro targets
- 📅 Today & tomorrow plans
- 🔄 Refresh and regenerate options

### Profile Page
- 👤 Complete user information
- 🏃 Training schedule
- 🎯 Fitness goals
- 🏅 Target race information
- ⚙️ Settings and preferences

---

## 🔐 Login Credentials

After setup, demo account can log in:

**URL:** https://app.nutrisync.id  
**Email:** demo@nutrisync.id  
**Password:** Demo2025!

---

## 🛠️ Customization

### Change User Details

Edit `create-demo-account.mjs` around line 50:

```javascript
display_name: 'Your Custom Name',
height_cm: 180,
weight_kg: 75,
age: 28,
sex: 'female', // or 'male'
fitness_goals: ['Your Custom Goals'],
```

### Add More Days

Edit loop ranges in the script:

```javascript
// Change from 7 days to 14 days
for (let daysAgo = 0; daysAgo <= 14; daysAgo++) {
  // ...
}
```

### Custom Meals

Edit the meals object:

```javascript
const meals = {
  breakfast: [
    { name: 'Your Custom Meal', calories: 500, ... },
  ],
  // ...
};
```

---

## 🔍 Verification

### Check Data Was Created

```bash
# Run verification queries in Supabase SQL Editor
```

**Profile:**
```sql
SELECT * FROM profiles WHERE display_name = 'Demo Runner';
```

**Food Logs:**
```sql
SELECT date::date, COUNT(*) as meals, SUM(calories) as total_calories
FROM food_logs 
WHERE user_id = '<user-id>'
GROUP BY date::date
ORDER BY date DESC;
```

**Training:**
```sql
SELECT date, activity_type, distance_km, notes
FROM training_activities
WHERE user_id = '<user-id>'
ORDER BY date DESC;
```

**Scores:**
```sql
SELECT date, daily_score, calories_consumed
FROM nutrition_scores
WHERE user_id = '<user-id>'
ORDER BY date DESC;
```

---

## ⚠️ Troubleshooting

### Issue: "Missing SERVICE_ROLE_KEY"

**Solution:**
1. Get key from: Supabase Dashboard → Settings → API
2. Copy **service_role** key (not anon key)
3. Add to `.env`: `SUPABASE_SERVICE_ROLE_KEY=your-key`

### Issue: "User already exists"

**Solution A (Reuse):**
```bash
node create-demo-account.mjs populate <existing-user-id>
```

**Solution B (Delete old):**
```sql
-- Run in SQL Editor
DELETE FROM profiles WHERE user_id = '<user-id>';
DELETE FROM food_logs WHERE user_id = '<user-id>';
DELETE FROM training_activities WHERE user_id = '<user-id>';
DELETE FROM nutrition_scores WHERE user_id = '<user-id>';
DELETE FROM daily_meal_plans WHERE user_id = '<user-id>';
DELETE FROM wearable_data WHERE user_id = '<user-id>';
DELETE FROM marathon_events WHERE user_id = '<user-id>';
```

### Issue: "Cannot find module"

**Solution:**
```bash
npm install @supabase/supabase-js dotenv
```

---

## 🎓 Learning Resources

### Files Overview

1. **`DEMO_ACCOUNT_README.md`** - Quick start guide (this file)
2. **`DEMO_ACCOUNT_GUIDE.md`** - Full documentation
3. **`create-demo-account.mjs`** - Automated script
4. **`create-demo-account.sql`** - SQL script

### Next Steps

1. ✅ Create demo account using one of the methods
2. ✅ Login at https://app.nutrisync.id
3. ✅ Explore all features with realistic data
4. ✅ Use for presentations, testing, or demos
5. ✅ Customize as needed for your use case

---

## 📝 Summary

**Setup Time:** 2-3 minutes  
**Data Created:** ~80 records  
**Features Ready:** All major features populated  
**Maintenance:** Delete and recreate anytime  

**Perfect for:**
- 🎥 Product demonstrations
- 👥 User testing
- 📱 App store screenshots
- 🎓 Training and onboarding
- 🐛 Bug reproduction
- 🚀 Investor presentations

---

## 🎉 You're Ready!

Everything is set up and ready to use. Just choose your preferred method and create the demo account in minutes!

**Questions?** Check `DEMO_ACCOUNT_GUIDE.md` for detailed troubleshooting.

**Need help?** The scripts have detailed error messages and logging.

---

**Last Updated:** October 14, 2025  
**Version:** 1.0  
**Status:** ✅ Production Ready
