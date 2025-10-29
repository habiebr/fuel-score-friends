# Runner Nutrition App Features

## Overview
A comprehensive nutrition tracking system designed specifically for runners, inspired by modern nutrition apps. This implementation integrates seamlessly with your existing fuel-score-friends app.

## 🎯 Features Implemented

### 1. **CalorieRing Component** (`src/components/CalorieRing.tsx`)
- **Visual Donut Chart**: SVG-based calorie ring showing consumed vs. goal
- **Exercise Integration**: Displays exercise calories earned from wearable data
- **Smart Status Indicators**: On track / Under goal / Over goal badges
- **Responsive Formula**: Shows the calculation: Goal - Food + Exercise = Remaining
- **Gradient Design**: Modern orange-to-white gradient background

### 2. **MacroProgressBars Component** (`src/components/MacroProgressBars.tsx`)
- **Three Macro Tracking**: Protein (red), Carbs (amber), Fat (blue)
- **Animated Progress Bars**: Smooth transitions with percentage indicators
- **Icon-based Design**: Beef, Wheat, and Droplet icons for each macro
- **Goal Completion**: Shows remaining grams or "Goal met!" message
- **Calorie Summary**: Calculates total calories from macros (4-4-9 formula)

### 3. **NutritionInsights Component** (`src/components/NutritionInsights.tsx`)
- **Runner-Specific Advice**: Tailored insights based on training intensity and running goals
- **Smart Analysis**:
  - Calorie intake vs. training level
  - Protein adequacy for endurance athletes (1.2-1.6g/kg recommendation)
  - Carb fueling for glycogen stores (5-7g/kg for marathon training)
  - Hydration recommendations based on activity
- **Timing Tips**: Pre-run fueling and post-run recovery window reminders
- **Color-Coded Cards**: Success (green), Warning (orange), Info (blue) badges

### 4. **HydrationTracker Component** (`src/components/HydrationTracker.tsx`)
- **Water Level Visualization**: Animated tank showing hydration progress
- **Quick-Add Buttons**: Small (250ml), Medium (500ml), Large (750ml) portions
- **Smart Goal Calculation**: 2L base + 3ml per calorie burned
- **Database Integration**: Saves to `hydration_logs` table
- **Status Messages**: Encouragement when goal is reached, warnings when low

### 5. **WeeklyNutritionTrends Component** (`src/components/WeeklyNutritionTrends.tsx`)
- **7-Day Bar Chart**: Visual trends for calories, protein, carbs, and fat
- **Metric Switcher**: Toggle between different nutrients
- **Trend Indicators**: Shows percentage increase/decrease from first to second half of week
- **Statistics Summary**: Average, Highest, and Lowest values for the week
- **Today Highlight**: Orange dot marks today's data

### 6. **MealTimeline Component** (`src/components/MealTimeline.tsx`)
- **Six Meal Periods**:
  - Breakfast (6-10 AM)
  - Mid-Morning (10-12 PM)
  - Lunch (12-2 PM)
  - Afternoon (2-5 PM)
  - Dinner (6-8 PM)
  - Evening (8-10 PM)
- **Timeline Visualization**: Shows completed meals with checkmarks
- **Runner Tips**: Pre-run fuel and post-run recovery suggestions for each period
- **Real-Time Indicator**: "Now" badge for current meal period
- **Logged Meals**: Shows all meals logged in each time slot

### 7. **QuickMealLog Component** (`src/components/QuickMealLog.tsx`)
- **Floating Action Button**: Always-accessible meal logging (bottom-right)
- **Quick-Add Templates**: 6 common meals (Banana, Energy Bar, Greek Yogurt, etc.)
- **Meal Type Selector**: Categorize meals by time of day
- **Macro Input**: Optional protein, carbs, fat tracking
- **Auto-Refresh**: Updates all nutrition widgets after logging

### 8. **RunnerNutritionDashboard Component** (`src/components/RunnerNutritionDashboard.tsx`)
- **Unified Interface**: Brings all components together
- **Three Tabs**:
  - **Today**: Calorie ring, macro bars, hydration, insights
  - **Timeline**: Meal-by-meal breakdown
  - **Trends**: Weekly nutrition analytics
- **Auto-Refresh**: Reloads data when meals or hydration are logged
- **Profile Integration**: Uses fitness goals and training intensity from user profile

## 🗄️ Database Changes

### New Table: `hydration_logs`
```sql
CREATE TABLE hydration_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  amount_ml INTEGER NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Row Level Security enabled
- Indexed for fast queries by user and date

## 🎨 Design Highlights

### Color Scheme
- **Calories**: Orange gradient (#FF6B35 to #FFA500)
- **Protein**: Red (#EF4444)
- **Carbs**: Amber (#F59E0B)
- **Fat**: Blue (#3B82F6)
- **Hydration**: Blue-Cyan gradient (#3B82F6 to #06B6D4)
- **Success**: Green (#10B981)
- **Warning**: Orange (#F59E0B)

### UX Features
- Smooth animations (700ms transitions)
- Dark mode support throughout
- Mobile-responsive layouts
- Accessibility-friendly icons and labels
- Loading states with spinners
- Toast notifications for actions

## 🔗 Integration Points

### Existing Components Used
- `@/components/ui/*`: Shadcn UI components (Card, Button, Progress, etc.)
- `@/hooks/useAuth`: User authentication
- `@/hooks/use-toast`: Toast notifications
- `@/integrations/supabase/client`: Database queries
- `@/lib/nutrition`: Nutrition calculation utilities

### Data Sources
1. **User Profile** (`profiles` table):
   - `fitness_goals`: Marathon, 5K, 10K, general
   - `training_intensity`: Low, moderate, high
   - `activity_level`: For BMR calculations

2. **Food Logs** (`food_logs` table):
   - Consumed calories and macros

3. **Meal Plans** (`daily_meal_plans` table):
   - Target calories and macros

4. **Wearable Data** (`wearable_data` table):
   - Calories burned from exercise

5. **Hydration Logs** (`hydration_logs` table):
   - Water intake tracking

## 🚀 Usage

### In Dashboard
The `RunnerNutritionDashboard` is integrated into the main Dashboard:

```tsx
import { RunnerNutritionDashboard } from '@/components/RunnerNutritionDashboard';

// In your Dashboard component:
<RunnerNutritionDashboard />
```

### As Standalone
Each component can also be used independently:

```tsx
import { CalorieRing } from '@/components/CalorieRing';
import { MacroProgressBars } from '@/components/MacroProgressBars';
import { HydrationTracker } from '@/components/HydrationTracker';

// Use individually with props
<CalorieRing 
  baseGoal={2000}
  consumed={1500}
  exercise={300}
  remaining={800}
/>
```

## 📊 Nutrition Calculation Logic

### Calorie Adjustment
```
Adjusted Goal = Base Goal + Exercise Calories
Remaining = Adjusted Goal - Consumed
```

### Macro Derivation
When meal plans don't specify macros:
- **Protein**: 30% of calories ÷ 4 cal/g
- **Carbs**: 40% of calories ÷ 4 cal/g
- **Fat**: 30% of calories ÷ 9 cal/g

### Hydration Goal
```
Daily Goal (ml) = 2000 + (Exercise Calories × 3)
```

## 🏃 Runner-Specific Features

1. **Pre-Run Fueling Tips**: Suggests carb-rich meals 2-3 hours before runs
2. **Post-Run Recovery Window**: Reminds users to consume protein + carbs within 30-60 min
3. **Training Intensity Adjustments**: Higher protein recommendations for intense training
4. **Marathon-Specific Advice**: Emphasizes carb loading (5-7g/kg body weight)
5. **Hydration for Runners**: Increases water goal based on calories burned

## 🔮 Future Enhancements

Potential additions:
- Integration with race calendar for taper nutrition
- Electrolyte tracking (sodium, potassium)
- Caffeine intake monitoring
- Supplement tracking
- Meal photo upload with AI recognition
- Custom meal templates
- Nutrition export to CSV/PDF
- Goal-based meal recommendations

## 📝 Notes

- All components follow the existing app's design system
- Compatible with existing nutrition calculation functions in `@/lib/nutrition`
- Fully typed with TypeScript interfaces
- Optimized database queries with proper indexes
- Real-time updates via Supabase subscriptions (can be added)

---

**Created**: October 6, 2025
**Status**: ✅ Production Ready
**Tested**: Cursor Branch

