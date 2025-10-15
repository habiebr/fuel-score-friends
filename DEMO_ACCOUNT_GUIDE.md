# Demo Account Creation Guide

**Date:** October 14, 2025  
**Purpose:** Create a realistic demo account for showcasing NutriSync features

---

## Overview

This guide helps you create a comprehensive demo account with realistic data including:

- ✅ User profile (32yo male marathon runner)
- ✅ 7 days of training activities (runs, rest days, intervals)
- ✅ 7 days of food logs (~50 meals with Indonesian/international food)
- ✅ 7 days of nutrition scores (72-88% range)
- ✅ Daily meal plans (today & tomorrow)
- ✅ 7 days of wearable data (steps, calories, heart rate)
- ✅ Marathon event registration (Jakarta Marathon 2025)

---

## Method 1: Automated Script (Recommended)

### Prerequisites

```bash
# Install dependencies (if not already installed)
npm install @supabase/supabase-js dotenv
```

### Environment Setup

Ensure your `.env` file has:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**⚠️ Important:** Use the **SERVICE_ROLE_KEY** (not anon key) to create auth users programmatically.

### Steps

#### Step 1: Create Auth User

```bash
node create-demo-account.mjs create-auth demo@nutrisync.id Demo2025!
```

**Output:**
```
🔐 Creating auth user...
✅ Auth user created: abc123-def456-ghi789

Now run: node create-demo-account.mjs populate abc123-def456-ghi789
```

**Copy the user ID** from the output.

#### Step 2: Populate Demo Data

```bash
node create-demo-account.mjs populate abc123-def456-ghi789
```

Replace `abc123-def456-ghi789` with the actual user ID from Step 1.

**Output:**
```
🚀 Creating demo account data...

User ID: abc123-def456-ghi789

👤 Creating user profile...
✅ Profile created
🏃 Creating training activities...
✅ Training activities created
🍽️ Creating food logs...
✅ Food logs created (50 meals)
📊 Creating nutrition scores...
✅ Nutrition scores created
🍴 Creating daily meal plans...
✅ Daily meal plans created
⌚ Creating wearable data...
✅ Wearable data created
🏅 Creating marathon event...
✅ Marathon event created

✅ Demo account setup complete!

Demo Account Credentials:
Email: demo@nutrisync.id
Password: Demo2025!

Features populated:
- User profile (32yo male marathon runner)
- 7 days of training activities
- 7 days of food logs (~50 meals)
- 7 days of nutrition scores
- Today & tomorrow meal plans
- 7 days of wearable data
- Marathon event registration
```

---

## Method 2: Manual via Supabase Dashboard

### Step 1: Create Auth User

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Click **"Add user"**
3. Fill in:
   - **Email:** `demo@nutrisync.id`
   - **Password:** `Demo2025!`
   - **Auto Confirm User:** ✅ Check this box
4. Click **"Create user"**
5. **Copy the User ID** (UUID format)

### Step 2: Run Populate Script

```bash
node create-demo-account.mjs populate <paste-user-id-here>
```

---

## Method 3: SQL Script (Database Direct)

### Step 1: Create Auth User

Create user via Supabase Dashboard as described in Method 2.

### Step 2: Update SQL Script

1. Open `create-demo-account.sql`
2. Find line: `demo_user_id UUID := 'REPLACE_WITH_ACTUAL_USER_ID';`
3. Replace with your actual user ID
4. Save the file

### Step 3: Execute SQL

**Via Supabase Dashboard:**
1. Go to **SQL Editor**
2. Click **"New query"**
3. Copy entire content from `create-demo-account.sql`
4. Click **"Run"**

**Via Command Line:**
```bash
psql "postgresql://postgres:[password]@[host]:5432/postgres" \
  -f create-demo-account.sql
```

---

## Demo Account Details

### User Profile

| Field | Value |
|-------|-------|
| Display Name | Demo Runner |
| Age | 32 years |
| Sex | Male |
| Height | 175 cm |
| Weight | 68 kg |
| Fitness Level | Intermediate |
| Goals | Marathon Sub-3:30, Improve Endurance, Lose Weight |

### Training Schedule

| Day | Activity | Duration | Distance | Intensity |
|-----|----------|----------|----------|-----------|
| Monday | Easy Run | 45 min | 8.5 km | Low |
| Tuesday | Tempo Run | 60 min | 12 km | High |
| Wednesday | Rest | 0 min | 0 km | - |
| Thursday | Intervals | 50 min | 10 km | High |
| Friday | Easy Run | 40 min | 7 km | Low |
| Saturday | Long Run | 120 min | 22 km | Moderate |
| Sunday | Recovery Run | 30 min | 5 km | Low |

### Recent Activities (Last 7 Days)

- **Day -6:** Easy Run - 8.5km, "Morning easy run, felt great!"
- **Day -5:** Tempo Run - 12km, "Maintained 4:50/km pace"
- **Day -4:** Rest Day - "Active recovery stretching"
- **Day -3:** Intervals - 10km, "8x800m intervals - strong finish"
- **Day -2:** Easy Run - 7km, "Recovery pace, legs feeling good"
- **Day -1:** Long Run - 22km, "22km at marathon pace" (1450 calories)
- **Today:** Recovery Run - 5km, "Easy recovery jog"

### Nutrition Scores (Last 7 Days)

| Day | Score | Rating | Calories | Protein | Carbs | Fat |
|-----|-------|--------|----------|---------|-------|-----|
| Today | 88% | Excellent | 2200 | 125g | 280g | 71g |
| Yesterday | 82% | Excellent | 2600 | 145g | 320g | 71g |
| Day -2 | 75% | Good | 2200 | 125g | 280g | 71g |
| Day -3 | 79% | Good | 2200 | 125g | 280g | 71g |
| Day -4 | 85% | Excellent | 2200 | 125g | 280g | 71g |
| Day -5 | 72% | Good | 2200 | 125g | 280g | 71g |
| Day -6 | 80% | Good | 2200 | 125g | 280g | 71g |

### Sample Daily Meals

**Breakfast:**
- Oatmeal with banana and almonds (420 cal)
- Greek yogurt with berries (180 cal)

**Lunch:**
- Grilled chicken breast with brown rice (520 cal)
- Mixed vegetable salad (120 cal)

**Snack:**
- Protein shake with banana (280 cal)

**Dinner:**
- Salmon fillet with sweet potato (580 cal)
- Steamed broccoli and carrots (90 cal)

**Evening Snack (alternate days):**
- Apple with peanut butter (220 cal)

### Today's Meal Plan (AI-Generated)

**Breakfast:** 650 kcal
- Nasi goreng telur (Fried rice with egg) - 520 kcal
- Pisang (Banana) - 105 kcal

**Lunch:** 750 kcal
- Ayam bakar dengan nasi merah (Grilled chicken with brown rice) - 580 kcal
- Gado-gado (Indonesian salad) - 180 kcal

**Dinner:** 720 kcal
- Ikan bakar dengan kentang rebus (Grilled fish with boiled potato) - 520 kcal
- Tumis kangkung (Stir-fried water spinach) - 95 kcal

### Marathon Event

**Event:** Jakarta Marathon 2025  
**Date:** ~90 days from now  
**Location:** Jakarta, Indonesia  
**Target Time:** 3:25:00 (Sub 3:30 goal)  
**Distance:** 42.195 km  
**Training Plan:** 16 weeks

---

## Features Showcased

### Dashboard
- ✅ Today's unified score with breakdown
- ✅ Nutrition score with colorful progress bar
- ✅ Training load classification
- ✅ Weekly scores trend
- ✅ Race goal widget with countdown

### Goals Page
- ✅ Training calendar with color-coded activities
- ✅ Activity editing and management
- ✅ Intensity-based classification
- ✅ Long run designation

### Nutrition Page
- ✅ Food log entries (7 days of data)
- ✅ Meal-by-meal breakdown
- ✅ Macro tracking (protein, carbs, fat)
- ✅ Daily nutrition scores

### Meal Plan Page
- ✅ AI-generated meal suggestions
- ✅ Indonesian food recommendations
- ✅ Calorie and macro targets
- ✅ Today & tomorrow plans

### Profile Page
- ✅ Complete user information
- ✅ Training schedule
- ✅ Fitness goals
- ✅ Target race information

---

## Verification Queries

### Check Profile
```sql
SELECT * FROM profiles WHERE display_name = 'Demo Runner';
```

### Check Food Logs
```sql
SELECT date::date, COUNT(*) as meals, SUM(calories) as total_calories
FROM food_logs 
WHERE user_id = '<user-id>'
GROUP BY date::date
ORDER BY date DESC
LIMIT 7;
```

### Check Nutrition Scores
```sql
SELECT date, daily_score, calories_consumed, protein_grams, carbs_grams
FROM nutrition_scores
WHERE user_id = '<user-id>'
ORDER BY date DESC
LIMIT 7;
```

### Check Training Activities
```sql
SELECT date, activity_type, duration_minutes, distance_km, intensity, notes
FROM training_activities
WHERE user_id = '<user-id>'
ORDER BY date DESC
LIMIT 7;
```

### Check Daily Meal Plans
```sql
SELECT date, meal_type, recommended_calories, meal_score
FROM daily_meal_plans
WHERE user_id = '<user-id>'
ORDER BY date DESC, meal_type;
```

### Check Wearable Data
```sql
SELECT date, steps, calories_burned, active_minutes, distance_meters
FROM wearable_data
WHERE user_id = '<user-id>'
ORDER BY date DESC
LIMIT 7;
```

---

## Troubleshooting

### Issue: "User already exists"
**Solution:** Use existing user or delete old demo user first.

```sql
-- Delete demo user data
DELETE FROM profiles WHERE user_id = '<user-id>';
DELETE FROM food_logs WHERE user_id = '<user-id>';
DELETE FROM training_activities WHERE user_id = '<user-id>';
DELETE FROM nutrition_scores WHERE user_id = '<user-id>';
DELETE FROM daily_meal_plans WHERE user_id = '<user-id>';
DELETE FROM wearable_data WHERE user_id = '<user-id>';
DELETE FROM marathon_events WHERE user_id = '<user-id>';
```

### Issue: "Missing SUPABASE_SERVICE_ROLE_KEY"
**Solution:** 
1. Go to Supabase Dashboard → Settings → API
2. Copy **service_role** key (not anon key)
3. Add to `.env`: `SUPABASE_SERVICE_ROLE_KEY=your-key-here`

### Issue: "No such file or directory: dotenv"
**Solution:** Install dependencies:
```bash
npm install @supabase/supabase-js dotenv
```

### Issue: SQL script shows errors
**Solution:** Make sure to replace `REPLACE_WITH_ACTUAL_USER_ID` with real UUID.

---

## Customization

### Change User Details

Edit `create-demo-account.mjs` line ~50:
```javascript
display_name: 'Your Name',
height_cm: 180,
weight_kg: 75,
age: 28,
sex: 'female', // or 'male'
```

### Add More Days of Data

Edit `create-demo-account.mjs` line ~200:
```javascript
for (let daysAgo = 0; daysAgo <= 14; daysAgo++) {  // Change to 14 days
  // ...
}
```

### Change Food Preferences

Edit `create-demo-account.mjs` line ~140:
```javascript
const meals = {
  breakfast: [
    { name: 'Your custom meal', calories: 500, ... },
  ],
  // ...
};
```

---

## Security Notes

⚠️ **Important Security Considerations:**

1. **Don't expose SERVICE_ROLE_KEY** in frontend code
2. **Use strong passwords** for demo accounts
3. **Delete demo data** when no longer needed
4. **Rotate keys** if exposed
5. **Use Row Level Security** in production

---

## Demo Account Login

After setup, users can log in with:

**Email:** `demo@nutrisync.id`  
**Password:** `Demo2025!`  

**URL:** https://app.nutrisync.id

---

## Support

If you encounter issues:

1. Check Supabase Dashboard logs
2. Verify user exists in Authentication tab
3. Run verification SQL queries
4. Check browser console for errors
5. Review script output for specific error messages

---

## Summary

**Automated Method:** ~2 minutes  
**Manual Method:** ~5 minutes  
**SQL Method:** ~3 minutes

**Data Created:**
- 1 user profile
- 7 training activities
- ~50 food log entries
- 7 nutrition scores
- 6 daily meal plans
- 7 wearable data entries
- 1 marathon event

**Ready to demo:** ✅ All features populated with realistic data!

---

**Last Updated:** October 14, 2025  
**Version:** 1.0
