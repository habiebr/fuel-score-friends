# Demo Account - READY TO USE! 🎉

**Date:** October 14, 2025  
**Status:** ✅ FULLY CREATED AND READY

---

## 🔐 Login Credentials

**URL:** https://app.nutrisync.id  
**Email:** demo@nutrisync.id  
**Password:** Demo2025!  
**User ID:** cac8468f-6d30-4d6e-8dcc-382253748c55

---

## ✅ What's Included

### User Profile
- **Name:** Demo Runner
- **Age:** 32 years old
- **Sex:** Male
- **Height:** 175 cm
- **Weight:** 68 kg
- **Fitness Level:** Intermediate
- **Goal:** Full Marathon (Jakarta Marathon 2025)
- **Weekly Target:** 40 miles
- **Timezone:** Asia/Jakarta

### Training Schedule
```json
{
  "monday": "Easy Run (45 min)",
  "tuesday": "Tempo Run (60 min)",
  "wednesday": "Rest",
  "thursday": "Intervals (50 min)",
  "friday": "Easy Run (40 min)",
  "saturday": "Long Run (120 min)",
  "sunday": "Recovery Run (30 min)"
}
```

### 7 Days of Training Activities
✅ **Day -6:** Easy Run - 8.5km in 45min (520 calories)
✅ **Day -5:** Tempo Run - 12km in 60min (780 calories)
✅ **Day -4:** Rest Day - Active recovery
✅ **Day -3:** Intervals - 10km in 50min (680 calories)
✅ **Day -2:** Easy Run - 7km in 40min (450 calories)
✅ **Day -1:** Long Run - 22km in 120min (1450 calories!)
✅ **Today:** Recovery Run - 5km in 30min (320 calories)

### 7 Days of Food Logs
✅ **~53 meals logged** across 7 days

**Daily meals include:**
- Breakfast: Oatmeal with banana and almonds + Greek yogurt with berries
- Lunch: Grilled chicken breast with brown rice + Mixed vegetable salad
- Snack: Protein shake with banana
- Dinner: Salmon fillet with sweet potato + Steamed broccoli and carrots
- Evening Snack (alternate days): Apple with peanut butter

**Macros:** Balanced for marathon training
- ~2,200-2,600 calories per day
- ~125-145g protein
- ~280-320g carbs
- ~71g fat

### 7 Days of Nutrition Scores
✅ **Score range:** 72-88% (Good to Excellent)

| Day | Score | Rating |
|-----|-------|--------|
| Today | 88% | Excellent |
| Yesterday | 82% | Excellent |
| Day -2 | 75% | Good |
| Day -3 | 79% | Good |
| Day -4 | 85% | Excellent |
| Day -5 | 72% | Good |
| Day -6 | 80% | Good |

### Daily Meal Plans (AI-Generated)
✅ **Today's recommendations:**
- **Breakfast (650 kcal):**
  - Nasi goreng telur (Fried rice with egg) - 520 kcal
  - Pisang (Banana) - 105 kcal

- **Lunch (750 kcal):**
  - Ayam bakar dengan nasi merah (Grilled chicken with brown rice) - 580 kcal
  - Gado-gado (Indonesian salad) - 180 kcal

- **Dinner (720 kcal):**
  - Ikan bakar dengan kentang rebus (Grilled fish with boiled potato) - 520 kcal
  - Tumis kangkung (Stir-fried water spinach) - 95 kcal

### 7 Days of Wearable Data
✅ **Steps:** 3,200 - 28,500 daily
✅ **Calories burned:** 520 - 1,450
✅ **Heart rate:** 65-155 bpm
✅ **Active minutes:** 0-120 min
✅ **Distance:** 0-22km

---

## 🎯 Features You Can Demo

### ✅ Dashboard Page
- Today's unified score with breakdown
- Training load classification (easy/moderate/quality)
- Weekly scores trend chart
- Race goal countdown
- Colorful meal score progress bar
- Collapsible pre-training fueling reminder

### ✅ Goals Page
- 7-day training calendar
- Color-coded activities
- Edit and manage activities
- Automatic intensity classification
- Long run designation

### ✅ Nutrition Page
- Food log entries (53 meals over 7 days)
- Meal-by-meal breakdown
- Macro tracking (protein/carbs/fat)
- Daily nutrition scores

### ✅ Meal Plan Page
- AI-generated Indonesian food suggestions
- Calorie and macro targets
- Today & tomorrow meal plans
- Refresh and regenerate options

### ✅ Profile Page
- Complete runner profile
- Training schedule
- Fitness goals
- Marathon event info

---

## 📊 Data Summary

| Data Type | Count | Status |
|-----------|-------|--------|
| User Profile | 1 | ✅ Created |
| Training Activities | 7 | ✅ Created |
| Food Logs | 53 | ✅ Created |
| Nutrition Scores | 7 | ✅ Created |
| Daily Meal Plans | 3 | ✅ Created |
| Wearable Data | 7 | ✅ Created |

**Total:** ~78 database records with realistic, interconnected data

---

## 🚀 Quick Test Checklist

### Test Login
```
1. Go to https://app.nutrisync.id
2. Click "Sign In"
3. Email: demo@nutrisync.id
4. Password: Demo2025!
5. ✅ Should log in successfully
```

### Test Dashboard
```
✅ See today's unified score
✅ See meal score with colorful progress bar
✅ See training load for this week
✅ See race goal countdown
✅ See pre-training fueling reminder (if applicable)
```

### Test Goals Page
```
✅ See 7-day training calendar
✅ See color-coded activities
✅ See activity details (distance, duration, calories)
✅ Try editing an activity
```

### Test Nutrition Page
```
✅ See food log entries from last 7 days
✅ See daily totals and macros
✅ Try adding a new food item
✅ See nutrition scores
```

### Test Meal Plan Page
```
✅ See today's AI-generated meal suggestions
✅ See Indonesian food recommendations
✅ See calorie and macro targets
✅ Try refreshing meal plan
```

### Test Profile Page
```
✅ See complete profile information
✅ See training schedule
✅ See fitness goals
✅ See marathon event details
```

---

## 🔍 Verification Queries

### Check Profile
```sql
SELECT * FROM profiles 
WHERE user_id = 'cac8468f-6d30-4d6e-8dcc-382253748c55';
```

### Check Food Logs
```sql
SELECT date::date, COUNT(*) as meals, SUM(calories) as total_calories
FROM food_logs 
WHERE user_id = 'cac8468f-6d30-4d6e-8dcc-382253748c55'
GROUP BY date::date
ORDER BY date DESC;
```

### Check Training Activities
```sql
SELECT date, activity_type, distance_km, duration_minutes, notes
FROM training_activities
WHERE user_id = 'cac8468f-6d30-4d6e-8dcc-382253748c55'
ORDER BY date DESC;
```

### Check Nutrition Scores
```sql
SELECT date, daily_score, calories_consumed, protein_grams
FROM nutrition_scores
WHERE user_id = 'cac8468f-6d30-4d6e-8dcc-382253748c55'
ORDER BY date DESC;
```

---

## 🎨 Demo Scenarios

### Scenario 1: Marathon Runner Tracking
**Show:** How a marathon runner tracks training and nutrition

1. Open Dashboard → See unified score with training load
2. Go to Goals → Show weekly training calendar with long run
3. Go to Nutrition → Show food logs with high-carb meals
4. Go to Meal Plan → Show AI recommendations for recovery

### Scenario 2: Nutrition Optimization
**Show:** How the app helps optimize nutrition for training

1. Dashboard → Point out meal score (88% Excellent)
2. Nutrition → Show macro breakdown (protein/carbs/fat)
3. Meal Plan → Show Indonesian food suggestions
4. Goals → Show correlation between training and nutrition needs

### Scenario 3: Training Load Management
**Show:** How the app classifies and tracks training intensity

1. Goals → Show color-coded activities (green/yellow/red)
2. Dashboard → Show training load classification
3. Goals → Show long run marked specially
4. Dashboard → Show pre-training fueling reminder

### Scenario 4: AI-Powered Features
**Show:** AI capabilities in action

1. Meal Plan → Show AI-generated Indonesian meal suggestions
2. Nutrition → Show automatic nutrition scoring
3. Dashboard → Show unified scoring system
4. Goals → Show automatic intensity classification

---

## 📱 Perfect For

- 🎥 **Product demonstrations**
- 👥 **User testing and feedback**
- 📱 **App store screenshots**
- 🎓 **Training and onboarding**
- 🐛 **Bug reproduction**
- 🚀 **Investor presentations**
- 📊 **Feature showcases**

---

## 🛠️ Maintenance

### Update Profile
```bash
node update-demo-profile.mjs
```

### Add More Data
```bash
# Edit create-demo-account.mjs and re-run
node create-demo-account.mjs populate cac8468f-6d30-4d6e-8dcc-382253748c55
```

### Reset Demo Account
```sql
-- Delete all data (keep auth user)
DELETE FROM profiles WHERE user_id = 'cac8468f-6d30-4d6e-8dcc-382253748c55';
DELETE FROM food_logs WHERE user_id = 'cac8468f-6d30-4d6e-8dcc-382253748c55';
DELETE FROM training_activities WHERE user_id = 'cac8468f-6d30-4d6e-8dcc-382253748c55';
DELETE FROM nutrition_scores WHERE user_id = 'cac8468f-6d30-4d6e-8dcc-382253748c55';
DELETE FROM daily_meal_plans WHERE user_id = 'cac8468f-6d30-4d6e-8dcc-382253748c55';
DELETE FROM wearable_data WHERE user_id = 'cac8468f-6d30-4d6e-8dcc-382253748c55';

-- Then re-populate
node create-demo-account.mjs populate cac8468f-6d30-4d6e-8dcc-382253748c55
```

---

## 🎉 You're All Set!

The demo account is **fully ready** with realistic data spanning 7 days of training, nutrition, and activity tracking.

**Login now:** https://app.nutrisync.id

**Email:** demo@nutrisync.id  
**Password:** Demo2025!

---

**Created:** October 14, 2025  
**Setup Time:** ~3 minutes  
**Status:** ✅ READY FOR DEMOS!
