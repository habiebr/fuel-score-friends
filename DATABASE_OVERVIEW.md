# 🗄️ Database Schema Overview

## 📊 **Complete Database Structure**

This project uses **Supabase (PostgreSQL)** with a comprehensive fitness and nutrition tracking schema.

---

## 🏗️ **Core Tables**

### 1. **`profiles`** - User Profile Data
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key → auth.users)
- display_name (TEXT)
- height (INTEGER) -- in cm
- weight (INTEGER) -- in kg  
- age (INTEGER)
- activity_level (TEXT) -- stores training plan as JSON
- fitness_goals (TEXT[]) -- array of goals
- target_date (DATE) -- race target date
- fitness_level (TEXT) -- beginner/intermediate/advanced
- created_at, updated_at (TIMESTAMPTZ)
```

### 2. **`nutrition_scores`** - Daily Nutrition Tracking
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key → auth.users)
- date (DATE)
- daily_score (INTEGER) -- 0-100 nutrition score
- calories_consumed (INTEGER)
- protein_grams (NUMERIC)
- carbs_grams (NUMERIC) 
- fat_grams (NUMERIC)
- meals_logged (INTEGER)
- breakfast_score, lunch_score, dinner_score (INTEGER)
- planned_calories, planned_protein_grams, planned_carbs_grams, planned_fat_grams (INTEGER)
- created_at, updated_at (TIMESTAMPTZ)
- UNIQUE(user_id, date)
```

### 3. **`food_logs`** - Individual Food Entries
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key → auth.users)
- food_name (TEXT)
- meal_type (TEXT) -- breakfast, lunch, dinner, snack
- calories (NUMERIC)
- protein_grams (NUMERIC)
- carbs_grams (NUMERIC)
- fat_grams (NUMERIC)
- serving_size (TEXT)
- logged_at (TIMESTAMPTZ)
```

### 4. **`daily_meal_plans`** - AI-Generated Meal Recommendations
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key → auth.users)
- date (DATE)
- meal_type (TEXT) -- breakfast, lunch, dinner
- recommended_calories (INTEGER)
- recommended_protein_grams (INTEGER)
- recommended_carbs_grams (INTEGER)
- recommended_fat_grams (INTEGER)
- meal_suggestions (JSONB) -- AI suggestions array
- meal_score (INTEGER) -- 0-100 individual meal score
- created_at, updated_at (TIMESTAMPTZ)
- UNIQUE(user_id, date, meal_type)
```

---

## 🏃‍♂️ **Fitness & Activity Tables**

### 5. **`wearable_data`** - Fitness Tracker Data
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key → auth.users)
- date (DATE)
- steps (INTEGER)
- calories_burned (INTEGER)
- active_minutes (INTEGER)
- heart_rate_avg (INTEGER)
- sleep_hours (DECIMAL)
- distance_meters (NUMERIC)
- elevation_gain (NUMERIC)
- max_heart_rate (INTEGER)
- heart_rate_zones (JSONB)
- avg_cadence (INTEGER)
- avg_power (INTEGER)
- max_speed (NUMERIC)
- activity_type (TEXT)
- gps_data (JSONB)
- detailed_metrics (JSONB)
- avg_temperature (INTEGER)
- training_effect (NUMERIC)
- recovery_time (INTEGER)
- created_at (TIMESTAMPTZ)
- UNIQUE(user_id, date)
```

### 6. **`wearable_laps`** - Lap-by-Lap Analysis
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key → auth.users)
- wearable_data_id (UUID, Foreign Key → wearable_data)
- lap_index (INTEGER)
- start_time (TIMESTAMPTZ)
- total_time (NUMERIC)
- total_distance (NUMERIC)
- avg_heart_rate (INTEGER)
- max_heart_rate (INTEGER)
- avg_speed (NUMERIC)
- calories (INTEGER)
- created_at (TIMESTAMPTZ)
- UNIQUE(wearable_data_id, lap_index)
```

---

## 🏁 **Marathon & Events**

### 7. **`marathon_events`** - Marathon Event Database
```sql
- id (UUID, Primary Key)
- event_name (TEXT)
- event_date (DATE)
- location (TEXT)
- country (TEXT)
- distance (TEXT)
- event_url (TEXT)
- description (TEXT)
- registration_deadline (DATE)
- created_at (TIMESTAMPTZ)
```

---

## 👥 **Social Features**

### 8. **`friends`** - User Connections
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key → auth.users)
- friend_id (UUID, Foreign Key → auth.users)
- status (TEXT) -- pending, accepted, blocked
- created_at (TIMESTAMPTZ)
- UNIQUE(user_id, friend_id)
```

---

## 🔐 **Security & Permissions**

### **Row Level Security (RLS)**
- ✅ **Enabled on all tables**
- ✅ **User-specific data access** (users can only see their own data)
- ✅ **Friends can view each other's nutrition scores**
- ✅ **Marathon events are publicly readable**

### **Key Policies:**
- Users can only access their own profiles, nutrition data, food logs, meal plans, and wearable data
- Friends can view each other's nutrition scores for social features
- Marathon events are publicly accessible for browsing
- All inserts/updates require proper user authentication

---

## ⚙️ **Database Functions & Triggers**

### **Custom Functions:**
- `handle_new_user()` - Auto-creates profile when user signs up
- `update_updated_at_column()` - Auto-updates timestamps

### **Triggers:**
- `on_auth_user_created` - Creates profile on user registration
- `update_*_updated_at` - Updates timestamps on record changes

### **Scheduled Jobs:**
- **Daily nutrition generation** at 6 AM UTC via `pg_cron`
- Calls `generate-daily-nutrition` Supabase function

---

## 📈 **Data Types & Constraints**

### **Numeric Precision:**
- **Calories**: `NUMERIC(7,2)` (supports decimal values)
- **Macros**: `NUMERIC(6,2)` (protein, carbs, fat in grams)
- **Training Effect**: `NUMERIC(3,1)` (decimal precision)
- **Sleep**: `DECIMAL(3,1)` (hours with decimal)

### **JSONB Fields:**
- `meal_suggestions` - AI meal recommendations
- `heart_rate_zones` - Heart rate zone data
- `gps_data` - GPS tracking coordinates
- `detailed_metrics` - Additional fitness metrics

### **Unique Constraints:**
- `(user_id, date)` on nutrition_scores and wearable_data
- `(user_id, friend_id)` on friends table
- `(user_id, date, meal_type)` on daily_meal_plans
- `(wearable_data_id, lap_index)` on wearable_laps

---

## 🚀 **Migration History**

1. **2025-09-30**: Initial schema (profiles, nutrition_scores, food_logs, wearable_data, friends)
2. **2025-10-01**: Added daily_meal_plans, enhanced wearable_data metrics
3. **2025-10-01**: Added wearable_laps for detailed analysis
4. **2025-10-01**: Added marathon_events table
5. **2025-10-01**: Fixed data types (integer → numeric for precision)
6. **2025-10-01**: Added scheduled jobs and cron functionality

---

## 🔧 **Current Status**

- ✅ **All tables created and migrated**
- ✅ **RLS policies configured**
- ✅ **TypeScript types generated**
- ⚠️ **Missing columns**: `target_date` and `fitness_level` in profiles (needs migration)
- ✅ **Ready for production** (after missing columns migration)

---

## 📝 **Next Steps**

1. **Run the migration** to add missing `target_date` and `fitness_level` columns
2. **Test all CRUD operations** on each table
3. **Verify RLS policies** are working correctly
4. **Set up monitoring** for the scheduled nutrition generation job

This database schema supports a comprehensive fitness and nutrition tracking application with social features, AI-powered meal planning, and detailed activity analysis! 🎯
