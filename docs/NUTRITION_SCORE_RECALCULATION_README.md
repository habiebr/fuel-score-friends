# 🔄 Nutrition Score Recalculation Scripts

This directory contains scripts to recalculate nutrition scores for existing food logs. This is useful for one-time data migrations or corrections.

## 📋 Available Scripts

### 1. **Edge Function Approach** (Recommended)
- **File**: `supabase/functions/recalculate-nutrition-scores/index.ts`
- **Trigger**: `trigger-recalculate-scores.js`
- **Best for**: Production environments, server-side execution

### 2. **Direct Database Approach**
- **File**: `recalculate-nutrition-scores-simple.js`
- **Best for**: Local development, direct database access

### 3. **ES Module Approach**
- **File**: `recalculate-nutrition-scores.js`
- **Best for**: Modern Node.js environments with ES modules

## 🚀 Quick Start (Edge Function - Recommended)

1. **Deploy the Edge Function**:
   ```bash
   # The Edge Function is already created at:
   # supabase/functions/recalculate-nutrition-scores/index.ts
   ```

2. **Run the trigger script**:
   ```bash
   node trigger-recalculate-scores.js
   ```

## 🛠️ Alternative: Direct Database Script

If you prefer to run the script directly against the database:

1. **Install dependencies**:
   ```bash
   npm install @supabase/supabase-js dotenv
   ```

2. **Set up environment variables**:
   ```bash
   # Create .env file with:
   VITE_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. **Run the script**:
   ```bash
   node recalculate-nutrition-scores-simple.js
   ```

## 📊 What the Scripts Do

### **Data Processing**:
1. **Fetch all food logs** from the database
2. **Group by user and date** to get unique combinations
3. **Calculate nutrition scores** based on:
   - Planned calories vs actual calories
   - Planned macros vs actual macros
   - Weighted scoring (calories 40%, macros 60%)

### **Score Calculation**:
- **Daily Score**: Overall nutrition score for the day
- **Meal Scores**: Individual scores for breakfast, lunch, dinner
- **Macro Scores**: Protein, carbs, fat individual scores

### **Database Updates**:
- **nutrition_scores table**: Updates daily scores
- **daily_meal_plans table**: Updates meal-level scores

## 🎯 Expected Output

```
🚀 Starting nutrition score recalculation...

📊 Found 150 user-date combinations to process

✅ Updated nutrition score for user123 on 2024-01-15: 85
✅ Updated nutrition score for user456 on 2024-01-15: 92
📈 Progress: 10/150 processed
...

🎯 Recalculation complete!
✅ Successfully processed: 150 combinations
❌ Errors encountered: 0 combinations
🎉 All nutrition scores have been successfully recalculated!
```

## ⚠️ Important Notes

### **Before Running**:
- **Backup your database** (recommended)
- **Test on a small dataset** first
- **Ensure you have proper permissions** (service role key)

### **Performance**:
- **Batch processing**: Processes 10 records at a time
- **Rate limiting**: 50ms delay between operations
- **Progress tracking**: Shows progress every 10 records

### **Error Handling**:
- **Continues on errors**: Individual failures don't stop the process
- **Detailed logging**: Shows which records failed and why
- **Summary report**: Final count of successes and failures

## 🔧 Troubleshooting

### **Common Issues**:

1. **Missing Environment Variables**:
   ```
   ❌ Missing required environment variables:
      VITE_SUPABASE_URL
      SUPABASE_SERVICE_ROLE_KEY
   ```
   **Solution**: Create `.env` file with proper values

2. **Permission Errors**:
   ```
   ❌ Error updating nutrition score: permission denied
   ```
   **Solution**: Use service role key, not anon key

3. **No Food Logs Found**:
   ```
   ℹ️  No food logs found. Nothing to recalculate.
   ```
   **Solution**: This is normal if you have no food logs in the database

### **Database Schema Requirements**:
- `food_logs` table with columns: user_id, calories, protein_grams, carbs_grams, fat_grams, logged_at
- `daily_meal_plans` table with columns: user_id, date, meal_type, recommended_*
- `nutrition_scores` table with columns: user_id, date, daily_score, etc.

## 📈 Monitoring

The scripts provide detailed logging:
- **Progress indicators**: Shows current progress
- **Success/failure counts**: Final summary
- **Error details**: Specific error messages for debugging
- **Performance metrics**: Processing time and throughput

## 🎉 Success Criteria

A successful run should show:
- ✅ All user-date combinations processed
- ❌ 0 errors encountered
- 🎉 All nutrition scores successfully recalculated

---

**Note**: These scripts are designed for one-time use. After running successfully, you can delete them or keep them for future data migrations.
