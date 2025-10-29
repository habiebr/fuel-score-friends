# 🎬 Quick Start: Create Demo Account

## Fastest Way (2 minutes)

### Option 1: Automated Script

```bash
# 1. Create auth user and get ID
node create-demo-account.mjs create-auth demo@nutrisync.id Demo2025!

# 2. Populate data (replace with actual user ID from step 1)
node create-demo-account.mjs populate <user-id-here>
```

### Option 2: Manual Creation

1. **Create user in Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard/project/eecdbddpzwedficnpenm/auth/users
   - Click "Add user"
   - Email: `demo@nutrisync.id`
   - Password: `Demo2025!`
   - ✅ Auto Confirm User
   - Copy the User ID

2. **Populate data:**
   ```bash
   node create-demo-account.mjs populate <paste-user-id>
   ```

## What You Get

✅ **32yo Male Marathon Runner Profile**
- Height: 175cm, Weight: 68kg
- Goal: Sub 3:30 marathon
- 16-week training plan

✅ **7 Days of Complete Data:**
- Training activities (runs, tempo, intervals, long run)
- Food logs (~50 meals with Indonesian food)
- Nutrition scores (72-88% range)
- Wearable data (steps, calories, heart rate)

✅ **Today's AI Meal Plan:**
- Breakfast: Nasi goreng telur + Pisang
- Lunch: Ayam bakar + Gado-gado
- Dinner: Ikan bakar + Tumis kangkung

✅ **Marathon Event:**
- Jakarta Marathon 2025
- Target: 3:25:00

## Login After Setup

**URL:** https://app.nutrisync.id  
**Email:** demo@nutrisync.id  
**Password:** Demo2025!

## Features to Demo

- 📊 Dashboard with unified scoring
- 🏃 Training calendar with activities
- 🍽️ Food logging and tracking
- 📈 Weekly progress charts
- 🎯 Race goal countdown
- 🤖 AI meal recommendations

## Full Documentation

See `DEMO_ACCOUNT_GUIDE.md` for detailed instructions and troubleshooting.

---

**Need help?** Check the logs or SQL queries in the full guide!
