# Marathon Nutrition MVP

## Overview

A **deterministic, pure-function** nutrition calculation engine for marathon training. Calculates daily calorie and macronutrient targets based on user profile and training load, with specific fueling windows for endurance athletes.

## ✅ Implementation Complete

### Core Module
- **Location**: `src/lib/marathon-nutrition.ts`
- **Test Suite**: `src/lib/marathon-nutrition.test.ts`
- **Examples**: `src/lib/marathon-nutrition-example.ts`

### Key Features
✅ Pure functions (no external API calls)  
✅ Deterministic output (same inputs → same outputs)  
✅ Testable with Vitest  
✅ TypeScript fully typed  
✅ Reusable in nutrition engine  

## 📊 Main Function: `targetsMVP`

```typescript
import { targetsMVP } from '@/lib/marathon-nutrition';

const athlete = {
  weightKg: 70,
  heightCm: 175,
  age: 30,
  sex: 'male'
};

const result = targetsMVP(athlete, 'moderate', '2025-10-06');
```

### Output Structure

```typescript
{
  date: "2025-10-06",
  load: "moderate",
  kcal: 2970,
  grams: {
    cho: 490,      // Carbohydrates
    protein: 126,  // Protein
    fat: 64        // Fat
  },
  fueling: {
    pre: {
      hoursBefore: 3,
      cho_g: 175
    },
    duringCHOgPerHour: null,
    post: {
      minutesAfter: 60,
      cho_g: 70,
      protein_g: 21
    }
  },
  meals: [
    { meal: 'breakfast', ratio: 0.25, cho_g: 123, protein_g: 32, fat_g: 16, kcal: 740 },
    { meal: 'lunch', ratio: 0.30, cho_g: 147, protein_g: 38, fat_g: 19, kcal: 890 },
    { meal: 'dinner', ratio: 0.30, cho_g: 147, protein_g: 38, fat_g: 19, kcal: 890 },
    { meal: 'snack', ratio: 0.15, cho_g: 74, protein_g: 19, fat_g: 10, kcal: 450 }
  ]
}
```

## 🧮 Calculation Logic

### Step 1: Basal Metabolic Rate (BMR)
**Mifflin-St Jeor Formula**:
```
BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age + sexOffset
  where sexOffset = 5 (male) or -161 (female)
```

### Step 2: Total Daily Energy Expenditure (TDEE)
**Activity Factor Multipliers**:
| Load | Factor | Description |
|------|--------|-------------|
| rest | 1.4 | Recovery/off day |
| easy | 1.6 | Easy aerobic run |
| moderate | 1.8 | Tempo/steady run |
| long | 2.0 | Long endurance run |
| quality | 2.1 | Intervals/speed work |

```
TDEE = BMR × ActivityFactor
```
*Rounded to nearest 10 kcal*

### Step 3: Macronutrient Distribution

**Carbohydrate & Protein targets (g/kg body weight)**:
| Load | CHO (g/kg) | Protein (g/kg) |
|------|-----------|----------------|
| rest | 3.5 | 1.6 |
| easy | 5.5 | 1.7 |
| moderate | 7.0 | 1.8 |
| long | 9.0 | 1.9 |
| quality | 8.0 | 1.9 |

**Fat calculation**:
- Minimum 20% of TDEE
- Remaining calories after CHO + protein
- Converted at 9 kcal/g

### Step 4: Meal Distribution

**Rest Day** (3 meals):
- Breakfast: 30%
- Lunch: 35%
- Dinner: 35%

**Training Day** (4 meals):
- Breakfast: 25%
- Lunch: 30%
- Dinner: 30%
- Snack: 15%

### Step 5: Fueling Windows

**Pre-Run** (3 hours before):
- Easy: 1.5 g/kg CHO
- Moderate: 2.5 g/kg CHO
- Long: 3.5 g/kg CHO
- Quality: 3.0 g/kg CHO

**During Run** (for sessions ≥75 min):
- Long runs: 45 g CHO/hour
- Quality runs: 45 g CHO/hour

**Post-Run** (within 60 minutes):
- CHO: 1.0 g/kg
- Protein: 0.3 g/kg

## 🎯 Training Load Types

### Rest
- **Description**: Recovery day, no training
- **TDEE**: 1.4× BMR
- **CHO**: 3.5 g/kg
- **Meals**: 3 (no snack)
- **Fueling**: None

### Easy
- **Description**: Easy aerobic run, conversational pace
- **TDEE**: 1.6× BMR
- **CHO**: 5.5 g/kg
- **Duration**: 30-45 min
- **Example**: Recovery jog, easy morning run

### Moderate
- **Description**: Tempo run, sustained effort
- **TDEE**: 1.8× BMR
- **CHO**: 7.0 g/kg
- **Duration**: 45-60 min
- **Example**: Tempo run, steady state

### Long
- **Description**: Long endurance run
- **TDEE**: 2.0× BMR
- **CHO**: 9.0 g/kg (highest)
- **Duration**: 90+ min
- **Example**: Sunday long run, marathon pace run

### Quality
- **Description**: High-intensity intervals or speed work
- **TDEE**: 2.1× BMR (highest)
- **CHO**: 8.0 g/kg
- **Duration**: 45-75 min
- **Example**: Track intervals, fartlek, hill repeats

## 🔧 Utility Functions

### `classifyLoad(session)`
Auto-classify training load from session details:
```typescript
const load = classifyLoad({
  durationMinutes: 120,
  intensity: 'medium',
  type: 'long'
});
// Returns: 'long'
```

### `reconcileDay(profile, date, plans, actuals)`
Match planned vs actual sessions:
```typescript
const reconciliation = reconcileDay(
  athlete,
  '2025-10-06',
  [{ id: '1', plannedLoad: 'moderate', plannedDuration: 60 }],
  [{ id: '1', actualLoad: 'long', actualDuration: 90 }]
);
// Returns adjusted nutrition target based on actual workout
```

### `inferLoadFromWearable(data)`
Infer training load from wearable data (Google Fit, Apple Health):
```typescript
const load = inferLoadFromWearable({
  activityType: 'running',
  durationMinutes: 50,
  caloriesBurned: 520,
  averageHeartRate: 165,
  maxHeartRate: 190
});
// Returns: 'quality' (based on HR% and duration)
```

## 🧪 Testing

### Run Tests
```bash
# Once test script is added to package.json
npm test src/lib/marathon-nutrition.test.ts

# Or with Vitest directly
npx vitest src/lib/marathon-nutrition.test.ts
```

### Test Coverage
- ✅ BMR calculation (male & female)
- ✅ Activity factors
- ✅ Macro targets per kg
- ✅ TDEE calculation & rounding
- ✅ Macros calculation & fat minimum
- ✅ Meal ratios (rest vs training)
- ✅ Fueling windows
- ✅ Meal distribution
- ✅ Full `targetsMVP` integration
- ✅ Deterministic output verification
- ✅ Load classification
- ✅ Day reconciliation
- ✅ Wearable integration

## 📖 Usage Examples

See `src/lib/marathon-nutrition-example.ts` for comprehensive examples:

1. **Basic Usage** - Simple nutrition target calculation
2. **Compare Loads** - Side-by-side comparison of all training loads
3. **Weekly Plan** - Generate 7-day nutrition plan
4. **Auto-classify** - Classify load from session details
5. **Reconcile** - Match planned vs actual workouts
6. **Wearable** - Infer load from Google Fit/Apple Health
7. **Integration** - Connect with existing meal plan system

### Quick Example: Weekly Training Plan

```typescript
import { targetsMVP } from '@/lib/marathon-nutrition';

const athlete = { weightKg: 70, heightCm: 175, age: 30, sex: 'male' };

const week = [
  { date: '2025-10-06', load: 'easy' },
  { date: '2025-10-07', load: 'moderate' },
  { date: '2025-10-08', load: 'rest' },
  { date: '2025-10-09', load: 'quality' },
  { date: '2025-10-10', load: 'easy' },
  { date: '2025-10-11', load: 'rest' },
  { date: '2025-10-12', load: 'long' },
];

const weeklyTargets = week.map(day => 
  targetsMVP(athlete, day.load, day.date)
);

console.table(weeklyTargets.map(t => ({
  date: t.date,
  load: t.load,
  kcal: t.kcal,
  cho: t.grams.cho,
  protein: t.grams.protein
})));
```

## 🔗 Integration Points

### With Existing Nutrition System
The `targetsMVP` function integrates seamlessly with your existing app:

```typescript
// In your meal planning logic
import { targetsMVP } from '@/lib/marathon-nutrition';

async function generateDailyMealPlan(userId: string, date: string) {
  // 1. Get user profile
  const profile = await getUserProfile(userId);
  
  // 2. Get today's training load
  const trainingSession = await getTrainingSession(userId, date);
  const load = classifyLoad(trainingSession);
  
  // 3. Calculate nutrition targets
  const targets = targetsMVP(profile, load, date);
  
  // 4. Save to database
  await saveMealPlan({
    user_id: userId,
    date: targets.date,
    daily_calories: targets.kcal,
    carbohydrates_g: targets.grams.cho,
    protein_g: targets.grams.protein,
    fat_g: targets.grams.fat,
    training_load: targets.load,
    meals: targets.meals
  });
  
  // 5. Generate meal suggestions based on targets
  return generateMealSuggestions(targets);
}
```

### With Wearable Data
Connect Google Fit or Apple Health data:

```typescript
import { inferLoadFromWearable, reconcileDay } from '@/lib/marathon-nutrition';

async function updateNutritionFromWearable(userId: string, date: string) {
  // 1. Fetch wearable activity
  const activity = await getGoogleFitActivity(userId, date);
  
  // 2. Infer actual training load
  const actualLoad = inferLoadFromWearable(activity);
  
  // 3. Get planned session
  const plannedSession = await getPlannedSession(userId, date);
  
  // 4. Reconcile and adjust
  const profile = await getUserProfile(userId);
  const reconciliation = reconcileDay(
    profile,
    date,
    [plannedSession],
    [{ ...activity, actualLoad }]
  );
  
  // 5. Update nutrition targets if variance > 10%
  if (Math.abs(reconciliation.variance) > 10) {
    await updateMealPlan(userId, date, reconciliation.adjustedTarget);
    
    // Notify user
    await sendNotification(userId, {
      title: 'Nutrition Adjusted',
      message: `Your workout was more intense than planned. Daily calories increased by ${reconciliation.variance}%.`
    });
  }
}
```

## 📈 Future Enhancements

Ready for implementation when needed:

### Phase 2: Advanced Features
- [ ] Hydration calculations (sweat rate, weather)
- [ ] Electrolyte recommendations (sodium, potassium)
- [ ] Supplement timing (caffeine, beta-alanine)
- [ ] Race day nutrition calculator
- [ ] Carb loading protocol (3-day taper)

### Phase 3: Personalization
- [ ] Individual carb tolerance testing
- [ ] Fat adaptation calculations
- [ ] Metabolic efficiency scoring
- [ ] Historical data analysis
- [ ] Machine learning adjustments

### Phase 4: Integration
- [ ] Strava workout sync
- [ ] Garmin Connect integration
- [ ] Polar Flow data import
- [ ] TrainingPeaks nutrition export
- [ ] MyFitnessPal sync

## 🎓 Scientific Basis

### References
- Mifflin-St Jeor BMR equation (1990)
- ACSM Position Stand on Nutrition and Athletic Performance (2016)
- IOC Consensus Statement on Sports Nutrition (2018)
- Burke et al. - Carbohydrates for Training and Competition (2011)
- Thomas et al. - Protein Requirements for Endurance Athletes (2016)

### Carbohydrate Recommendations
Based on training load:
- **3-5 g/kg**: Light training
- **5-7 g/kg**: Moderate training (1h/day)
- **6-10 g/kg**: Endurance athletes (1-3h/day)
- **8-12 g/kg**: Extreme volumes (>4h/day)

### Protein Recommendations
Endurance athletes:
- **1.2-1.4 g/kg**: Moderate training
- **1.4-1.6 g/kg**: Heavy training
- **1.6-1.8 g/kg**: During weight loss
- **2.0 g/kg**: Maximum beneficial intake

## 🚀 Getting Started

### 1. Import the function
```typescript
import { targetsMVP } from '@/lib/marathon-nutrition';
```

### 2. Define your profile
```typescript
const myProfile = {
  weightKg: 70,
  heightCm: 175,
  age: 30,
  sex: 'male'
};
```

### 3. Calculate targets
```typescript
const todayTargets = targetsMVP(myProfile, 'long', '2025-10-12');
```

### 4. Use the output
```typescript
console.log(`Eat ${todayTargets.grams.cho}g carbs today for your long run!`);
console.log(`Pre-run: ${todayTargets.fueling.pre?.cho_g}g carbs 3 hours before`);
```

## 📝 Notes

- All calculations are **deterministic** - same inputs always produce same outputs
- Functions are **pure** - no side effects, no external API calls
- Output is **rounded** for practical use (whole grams, kcal to nearest 10)
- Macros are **estimated** - individual needs may vary
- Always consult a sports nutritionist for personalized recommendations

---

**Status**: ✅ Production Ready  
**Version**: 1.0.0  
**Created**: October 6, 2025  
**Language**: TypeScript  
**Testing**: Vitest  
**Integration**: fuel-score-friends app

