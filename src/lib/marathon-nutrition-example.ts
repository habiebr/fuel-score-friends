/**
 * Marathon Nutrition MVP - Usage Examples
 * Demonstrates how to use the targetsMVP function and supporting utilities
 */

import {
  targetsMVP,
  classifyLoad,
  reconcileDay,
  inferLoadFromWearable,
  type UserProfile,
  type TrainingLoad,
} from './marathon-nutrition';

// ============================================================================
// EXAMPLE 1: Basic Usage - Calculate nutrition targets for a moderate run day
// ============================================================================

export function exampleBasicUsage() {
  const athlete: UserProfile = {
    weightKg: 70,
    heightCm: 175,
    age: 30,
    sex: 'male',
  };

  const result = targetsMVP(athlete, 'moderate', '2025-10-06');

  console.log('=== Moderate Run Day ===');
  console.log(`Date: ${result.date}`);
  console.log(`Training Load: ${result.load}`);
  console.log(`Total Calories: ${result.kcal} kcal`);
  console.log('\nMacros:');
  console.log(`  Carbs: ${result.grams.cho}g`);
  console.log(`  Protein: ${result.grams.protein}g`);
  console.log(`  Fat: ${result.grams.fat}g`);
  
  console.log('\nFueling Windows:');
  if (result.fueling.pre) {
    console.log(`  Pre-run (${result.fueling.pre.hoursBefore}h before): ${result.fueling.pre.cho_g}g carbs`);
  }
  if (result.fueling.duringCHOgPerHour) {
    console.log(`  During run: ${result.fueling.duringCHOgPerHour}g carbs/hour`);
  }
  if (result.fueling.post) {
    console.log(`  Post-run (within ${result.fueling.post.minutesAfter}min): ${result.fueling.post.cho_g}g carbs + ${result.fueling.post.protein_g}g protein`);
  }
  
  console.log('\nMeal Distribution:');
  result.meals.forEach(meal => {
    console.log(`  ${meal.meal}: ${meal.kcal} kcal (CHO: ${meal.cho_g}g, PRO: ${meal.protein_g}g, FAT: ${meal.fat_g}g)`);
  });

  return result;
}

// ============================================================================
// EXAMPLE 2: Compare Different Training Loads
// ============================================================================

export function exampleCompareLoads() {
  const athlete: UserProfile = {
    weightKg: 65,
    heightCm: 168,
    age: 28,
    sex: 'female',
  };

  const loads: TrainingLoad[] = ['rest', 'easy', 'moderate', 'long', 'quality'];
  
  console.log('\n=== Nutrition Targets Across Training Loads ===');
  console.log('Athlete: 65kg, 168cm, 28yo female\n');
  
  const results = loads.map(load => {
    const target = targetsMVP(athlete, load, '2025-10-06');
    return {
      load,
      kcal: target.kcal,
      cho: target.grams.cho,
      protein: target.grams.protein,
      fat: target.grams.fat,
    };
  });

  console.table(results);
  
  return results;
}

// ============================================================================
// EXAMPLE 3: Weekly Training Plan
// ============================================================================

export function exampleWeeklyPlan() {
  const athlete: UserProfile = {
    weightKg: 72,
    heightCm: 180,
    age: 35,
    sex: 'male',
  };

  const weeklyPlan = [
    { date: '2025-10-06', load: 'easy' as TrainingLoad },
    { date: '2025-10-07', load: 'moderate' as TrainingLoad },
    { date: '2025-10-08', load: 'rest' as TrainingLoad },
    { date: '2025-10-09', load: 'quality' as TrainingLoad },
    { date: '2025-10-10', load: 'easy' as TrainingLoad },
    { date: '2025-10-11', load: 'rest' as TrainingLoad },
    { date: '2025-10-12', load: 'long' as TrainingLoad },
  ];

  console.log('\n=== Weekly Marathon Training Plan ===');
  console.log('Athlete: 72kg, 180cm, 35yo male\n');

  const weeklyTargets = weeklyPlan.map(day => {
    const target = targetsMVP(athlete, day.load, day.date);
    return {
      date: day.date,
      day: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
      load: target.load,
      kcal: target.kcal,
      cho: target.grams.cho,
      protein: target.grams.protein,
    };
  });

  console.table(weeklyTargets);

  const totalKcal = weeklyTargets.reduce((sum, day) => sum + day.kcal, 0);
  const avgKcal = Math.round(totalKcal / 7);
  
  console.log(`\nWeekly Total: ${totalKcal} kcal`);
  console.log(`Daily Average: ${avgKcal} kcal`);

  return weeklyTargets;
}

// ============================================================================
// EXAMPLE 4: Auto-classify Training Load from Session
// ============================================================================

export function exampleClassifyLoad() {
  console.log('\n=== Auto-classify Training Load ===\n');

  const sessions = [
    { durationMinutes: 30, intensity: 'low' as const, description: '30min easy recovery jog' },
    { durationMinutes: 60, intensity: 'medium' as const, description: '60min tempo run' },
    { durationMinutes: 120, intensity: 'medium' as const, description: '2hr long run' },
    { durationMinutes: 45, intensity: 'high' as const, description: '45min intervals' },
    { durationMinutes: 0, intensity: 'low' as const, description: 'Rest day' },
  ];

  sessions.forEach(session => {
    const load = classifyLoad(session);
    console.log(`${session.description} → ${load}`);
  });

  return sessions.map(s => classifyLoad(s));
}

// ============================================================================
// EXAMPLE 5: Reconcile Planned vs Actual Workout
// ============================================================================

export function exampleReconcileDay() {
  const athlete: UserProfile = {
    weightKg: 68,
    heightCm: 172,
    age: 32,
    sex: 'female',
  };

  // Planned: moderate 60min run
  const plans = [
    { id: 'morning-run', plannedLoad: 'moderate' as TrainingLoad, plannedDuration: 60 },
  ];

  // Actual: Felt great, extended to long run
  const actuals = [
    { id: 'morning-run', actualLoad: 'long' as TrainingLoad, actualDuration: 90, caloriesBurned: 650 },
  ];

  const reconciliation = reconcileDay(athlete, '2025-10-06', plans, actuals);

  console.log('\n=== Day Reconciliation: Planned vs Actual ===');
  console.log(`Date: ${reconciliation.date}`);
  console.log(`Planned Load: ${reconciliation.plannedLoad}`);
  console.log(`Actual Load: ${reconciliation.actualLoad}`);
  console.log(`Calorie Variance: ${reconciliation.variance}%`);
  console.log('\nAdjusted Nutrition Target:');
  console.log(`  Calories: ${reconciliation.adjustedTarget.kcal} kcal`);
  console.log(`  Carbs: ${reconciliation.adjustedTarget.grams.cho}g`);
  console.log(`  Protein: ${reconciliation.adjustedTarget.grams.protein}g`);

  return reconciliation;
}

// ============================================================================
// EXAMPLE 6: Infer Load from Wearable Data (Google Fit / Apple Health)
// ============================================================================

export function exampleWearableIntegration() {
  console.log('\n=== Infer Training Load from Wearable ===\n');

  const wearableActivities = [
    {
      activityType: 'running',
      durationMinutes: 35,
      caloriesBurned: 280,
      averageHeartRate: 135,
      maxHeartRate: 190,
      description: 'Morning easy run',
    },
    {
      activityType: 'running',
      durationMinutes: 50,
      caloriesBurned: 520,
      averageHeartRate: 165,
      maxHeartRate: 190,
      description: 'Tempo run',
    },
    {
      activityType: 'running',
      durationMinutes: 120,
      caloriesBurned: 850,
      averageHeartRate: 145,
      maxHeartRate: 190,
      description: 'Sunday long run',
    },
  ];

  wearableActivities.forEach(activity => {
    const load = inferLoadFromWearable(activity);
    const hrPercent = Math.round((activity.averageHeartRate / activity.maxHeartRate) * 100);
    console.log(`${activity.description}:`);
    console.log(`  Duration: ${activity.durationMinutes}min, HR: ${activity.averageHeartRate}bpm (${hrPercent}% max)`);
    console.log(`  Calories: ${activity.caloriesBurned} kcal`);
    console.log(`  Classified as: ${load}\n`);
  });

  return wearableActivities.map(a => inferLoadFromWearable(a));
}

// ============================================================================
// EXAMPLE 7: Integration with Existing App (Meal Plans)
// ============================================================================

export function exampleIntegrationWithApp() {
  const athlete: UserProfile = {
    weightKg: 70,
    heightCm: 175,
    age: 30,
    sex: 'male',
  };

  // Get target for today's long run
  const target = targetsMVP(athlete, 'long', '2025-10-12');

  console.log('\n=== Integration Example: Generate Daily Meal Plan ===');
  console.log('Long Run Sunday - Marathon Training Week 8\n');

  // Convert to format compatible with your existing meal plan system
  const mealPlan = {
    date: target.date,
    training_load: target.load,
    daily_calories: target.kcal,
    daily_macros: {
      carbohydrates_g: target.grams.cho,
      protein_g: target.grams.protein,
      fat_g: target.grams.fat,
    },
    fueling_protocol: {
      pre_run: target.fueling.pre
        ? `${target.fueling.pre.cho_g}g carbs, ${target.fueling.pre.hoursBefore}h before`
        : null,
      during_run: target.fueling.duringCHOgPerHour
        ? `${target.fueling.duringCHOgPerHour}g carbs per hour`
        : null,
      post_run: target.fueling.post
        ? `${target.fueling.post.cho_g}g carbs + ${target.fueling.post.protein_g}g protein within ${target.fueling.post.minutesAfter}min`
        : null,
    },
    meals: target.meals.map(meal => ({
      meal_type: meal.meal,
      target_calories: meal.kcal,
      target_macros: {
        carbohydrates_g: meal.cho_g,
        protein_g: meal.protein_g,
        fat_g: meal.fat_g,
      },
    })),
  };

  console.log(JSON.stringify(mealPlan, null, 2));

  return mealPlan;
}

// ============================================================================
// Run all examples (uncomment to execute)
// ============================================================================

// Uncomment the examples you want to run:

// exampleBasicUsage();
// exampleCompareLoads();
// exampleWeeklyPlan();
// exampleClassifyLoad();
// exampleReconcileDay();
// exampleWearableIntegration();
// exampleIntegrationWithApp();

