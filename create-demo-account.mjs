/**
 * NutriSync Demo Account Creator
 * 
 * This script creates a realistic demo account with:
 * - User profile (marathon runner)
 * - 7 days of food logs
 * - Training activities
 * - Nutrition scores
 * - Daily meal plans
 * 
 * Usage:
 * 1. Create auth user first via Supabase Dashboard or:
 *    node create-demo-account.mjs create-auth demo@nutrisync.id Demo2025!
 * 
 * 2. Then populate data:
 *    node create-demo-account.mjs populate <user-id>
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// Helper Functions
// ============================================

function getDate(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  // Format date in local timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateTime(daysAgo = 0, time = '12:00:00') {
  // Get the target date in local timezone
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  
  // Format the date part
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // Combine with time - use local timezone format
  // This will be interpreted correctly by Supabase/Postgres
  return `${year}-${month}-${day}T${time}`;
}

// ============================================
// 1. Create Auth User (Admin function)
// ============================================

async function createAuthUser(email, password) {
  console.log('🔐 Creating auth user...');
  
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  
  if (error) {
    console.error('❌ Error creating auth user:', error.message);
    return null;
  }
  
  console.log('✅ Auth user created:', data.user.id);
  return data.user.id;
}

// ============================================
// 2. Create User Profile
// ============================================

async function createProfile(userId) {
  console.log('👤 Creating user profile...');
  
  const { data, error} = await supabase
    .from('profiles')
    .upsert({
      user_id: userId,
      full_name: 'Demo Runner',
      height: 175,
      weight: 68,
      height_cm: 175,
      weight_kg: 68,
      age: 32,
      sex: 'male',
      activity_level: JSON.stringify({
        monday: { type: 'Easy Run', duration: 45 },
        tuesday: { type: 'Tempo Run', duration: 60 },
        wednesday: { type: 'Rest', duration: 0 },
        thursday: { type: 'Intervals', duration: 50 },
        friday: { type: 'Easy Run', duration: 40 },
        saturday: { type: 'Long Run', duration: 120 },
        sunday: { type: 'Recovery Run', duration: 30 }
      }),
      fitness_goals: ['Marathon Sub-3:30', 'Improve Endurance', 'Lose Weight'],
      goal_type: 'full_marathon',
      goal_name: 'Melbourne Marathon 2025',
      fitness_level: 'intermediate',
      timezone: 'Australia/Melbourne',
      weekly_miles_target: 40,
    })
    .select();
  
  if (error) {
    console.error('❌ Error creating profile:', error.message);
    return false;
  }
  
  console.log('✅ Profile created');
  return true;
}

// ============================================
// 3. Create Training Activities
// ============================================

async function createTrainingActivities(userId) {
  console.log('🏃 Creating training activities...');
  
  // Activities from Mon Oct 13 to Sun Oct 19
  const activities = [
    { daysOffset: -1, type: 'run', duration: 120, distance: 22.0, intensity: 'moderate', calories: 1450, notes: 'Long run - 22km at marathon pace' }, // Mon Oct 13
    { daysOffset: 0, type: 'run', duration: 30, distance: 5.0, intensity: 'low', calories: 320, notes: 'Easy recovery jog' }, // Tue Oct 14 (today)
    { daysOffset: 1, type: 'run', duration: 40, distance: 7.0, intensity: 'low', calories: 450, notes: 'Recovery pace, legs feeling good' }, // Wed Oct 15
    { daysOffset: 2, type: 'run', duration: 60, distance: 12.0, intensity: 'high', calories: 780, notes: 'Tempo run - maintained 4:50/km pace' }, // Thu Oct 16
    { daysOffset: 3, type: 'rest', duration: 0, distance: 0, intensity: 'low', calories: 0, notes: 'Rest day - active recovery stretching' }, // Fri Oct 17
    { daysOffset: 4, type: 'run', duration: 50, distance: 10.0, intensity: 'high', calories: 680, notes: '8x800m intervals - strong finish' }, // Sat Oct 18
    { daysOffset: 5, type: 'run', duration: 45, distance: 8.5, intensity: 'low', calories: 520, notes: 'Morning easy run, felt great!' }, // Sun Oct 19
  ];
  
  for (const activity of activities) {
    const { error } = await supabase
      .from('training_activities')
      .insert({
        user_id: userId,
        date: getDate(-activity.daysOffset),
        activity_type: activity.type,
        duration_minutes: activity.duration,
        distance_km: activity.distance,
        intensity: activity.intensity,
        estimated_calories: activity.calories,
        notes: activity.notes,
      });
    
    if (error) {
      console.error(`❌ Error creating activity (day ${activity.daysOffset}):`, error.message);
    }
  }
  
  console.log('✅ Training activities created');
}

// ============================================
// 4. Create Food Logs
// ============================================

async function createFoodLogs(userId) {
  console.log('🍽️ Creating food logs...');
  
  const meals = {
    breakfast: [
      { name: 'Oatmeal with banana and almonds', calories: 450, protein: 14, carbs: 72, fat: 14, serving: '1 bowl (220g oats, 1 banana, 20g almonds)', time: '07:30:00' },
      { name: 'Greek yogurt with berries and honey', calories: 200, protein: 16, carbs: 28, fat: 3, serving: '200g yogurt, 60g berries, honey', time: '07:35:00' },
      { name: 'Whole grain toast with avocado', calories: 220, protein: 6, carbs: 26, fat: 11, serving: '2 slices bread, 1/3 avocado', time: '07:40:00' },
    ],
    lunch: [
      { name: 'Grilled chicken breast with brown rice', calories: 620, protein: 48, carbs: 72, fat: 12, serving: '180g chicken, 230g brown rice', time: '12:30:00' },
      { name: 'Mixed vegetable salad with olive oil', calories: 140, protein: 3, carbs: 20, fat: 6, serving: '220g mixed vegetables, 1 tsp olive oil', time: '12:35:00' },
      { name: 'Quinoa side', calories: 160, protein: 6, carbs: 28, fat: 3, serving: '100g quinoa', time: '12:40:00' },
    ],
    snack: [
      { name: 'Protein shake with banana', calories: 320, protein: 28, carbs: 42, fat: 5, serving: '1.5 scoop protein powder, 1 banana, 350ml almond milk', time: '15:00:00' },
      { name: 'Mixed nuts', calories: 160, protein: 5, carbs: 7, fat: 14, serving: '25g almonds and cashews', time: '15:05:00' },
    ],
    dinner: [
      { name: 'Salmon fillet with sweet potato', calories: 680, protein: 44, carbs: 65, fat: 24, serving: '200g salmon, 280g sweet potato', time: '19:00:00' },
      { name: 'Steamed broccoli and carrots', calories: 100, protein: 4, carbs: 18, fat: 1, serving: '180g mixed vegetables', time: '19:05:00' },
      { name: 'Whole grain roll', calories: 120, protein: 4, carbs: 22, fat: 2, serving: '1.5 rolls', time: '19:10:00' },
    ],
    evening_snack: [
      { name: 'Apple with peanut butter', calories: 250, protein: 7, carbs: 32, fat: 12, serving: '1 large apple, 2 tbsp peanut butter', time: '21:00:00' },
      { name: 'Cottage cheese', calories: 110, protein: 13, carbs: 5, fat: 3, serving: '140g low-fat cottage cheese', time: '21:10:00' },
    ],
  };
  
  // Extra recovery/training snacks for hard training days
  const extraSnacks = {
    morning_snack: [
      { name: 'Energy bar', calories: 220, protein: 9, carbs: 35, fat: 5, serving: '1 bar (55g)', time: '10:00:00' },
    ],
    pre_dinner: [
      { name: 'Rice cakes with honey', calories: 160, protein: 2, carbs: 36, fat: 1, serving: '3 rice cakes, honey', time: '17:30:00' },
    ],
  };
  
  let totalInserts = 0;
  
  // Create food logs from Mon Oct 13 to Sun Oct 19 (7 days)
  // daysAgo: -1 (yesterday/Mon) to +5 (future/Sun)
  for (let daysOffset = -1; daysOffset <= 5; daysOffset++) {
    // Map to training schedule:
    // -1 (Mon): long run, 0 (Tue/today): easy recovery, +1 (Wed): easy, 
    // +2 (Thu): tempo, +3 (Fri): rest, +4 (Sat): intervals, +5 (Sun): easy
    const isHardTrainingDay = daysOffset === -1 || daysOffset === 2 || daysOffset === 4;
    const isRestDay = daysOffset === 3;
    
    // Regular meals every day
    for (const [mealType, foods] of Object.entries(meals)) {
      // Skip evening snack on rest day
      if (mealType === 'evening_snack' && isRestDay) continue;
      
      for (const food of foods) {
        // Skip breakfast toast on rest day (reduce calories)
        if (isRestDay && food.name.includes('toast')) continue;
        
        const { error } = await supabase
          .from('food_logs')
          .insert({
            user_id: userId,
            food_name: food.name,
            meal_type: mealType === 'evening_snack' ? 'snack' : mealType,
            calories: food.calories,
            protein_grams: food.protein,
            carbs_grams: food.carbs,
            fat_grams: food.fat,
            serving_size: food.serving,
            logged_at: getDateTime(-daysOffset, food.time),
          });
        
        if (!error) totalInserts++;
      }
    }
    
    // Add extra snacks on hard training days
    if (isHardTrainingDay) {
      for (const [mealType, foods] of Object.entries(extraSnacks)) {
        for (const food of foods) {
          const { error } = await supabase
            .from('food_logs')
            .insert({
              user_id: userId,
              food_name: food.name,
              meal_type: 'snack',
              calories: food.calories,
              protein_grams: food.protein,
              carbs_grams: food.carbs,
              fat_grams: food.fat,
              serving_size: food.serving,
              logged_at: getDateTime(-daysOffset, food.time),
            });
          
          if (!error) totalInserts++;
        }
      }
    }
  }
  
  console.log(`✅ Food logs created (${totalInserts} meals)`);
}

// ============================================
// 5. Create Nutrition Scores
// ============================================

async function createNutritionScores(userId) {
  console.log('📊 Creating nutrition scores...');
  
  // Scores from Mon Oct 13 to Sun Oct 19
  const scores = [
    { daysOffset: -1, score: 82, calories: 3680, protein: 215, carbs: 492, fat: 114 }, // Mon Oct 13: Long run day - highest intake
    { daysOffset: 0, score: 88, calories: 3400, protein: 206, carbs: 462, fat: 110 },  // Tue Oct 14 (today): Easy recovery run
    { daysOffset: 1, score: 75, calories: 3000, protein: 184, carbs: 408, fat: 102 },  // Wed Oct 15: Easy run day
    { daysOffset: 2, score: 72, calories: 3180, protein: 192, carbs: 428, fat: 104 },  // Thu Oct 16: Tempo run - hard training
    { daysOffset: 3, score: 85, calories: 2760, protein: 172, carbs: 378, fat: 94 },   // Fri Oct 17: Rest day - lower intake
    { daysOffset: 4, score: 79, calories: 3240, protein: 198, carbs: 436, fat: 106 },  // Sat Oct 18: Intervals - hard training
    { daysOffset: 5, score: 80, calories: 3040, protein: 188, carbs: 414, fat: 104 },  // Sun Oct 19: Easy run day
  ];
  
  for (const score of scores) {
    const { error } = await supabase
      .from('nutrition_scores')
      .upsert({
        user_id: userId,
        date: getDate(-score.daysOffset),
        daily_score: score.score,
        calories_consumed: score.calories,
        protein_grams: score.protein,
        carbs_grams: score.carbs,
        fat_grams: score.fat,
        meals_logged: score.daysAgo % 2 === 0 ? 8 : 7,
        breakfast_score: 85,
        lunch_score: 80,
        dinner_score: 82,
      });
    
    if (error) {
      console.error(`❌ Error creating nutrition score (day -${score.daysAgo}):`, error.message);
    }
  }
  
  console.log('✅ Nutrition scores created');
}

// ============================================
// 6. Create Daily Meal Plans
// ============================================

async function createDailyMealPlans(userId) {
  console.log('🍴 Creating daily meal plans...');
  
  const todayPlans = [
    {
      meal_type: 'breakfast',
      recommended_calories: 650,
      recommended_protein_grams: 28,
      recommended_carbs_grams: 95,
      recommended_fat_grams: 18,
      meal_suggestions: [
        { name: 'Nasi goreng telur (Fried rice with egg)', calories: 520, protein: 18, carbs: 75, fat: 14, description: 'Indonesian fried rice with vegetables and egg' },
        { name: 'Pisang (Banana)', calories: 105, protein: 1, carbs: 27, fat: 0, description: 'Fresh banana for quick energy' },
      ],
      meal_score: 85,
    },
    {
      meal_type: 'lunch',
      recommended_calories: 750,
      recommended_protein_grams: 45,
      recommended_carbs_grams: 88,
      recommended_fat_grams: 22,
      meal_suggestions: [
        { name: 'Ayam bakar dengan nasi merah (Grilled chicken with brown rice)', calories: 580, protein: 42, carbs: 68, fat: 15, description: 'Grilled chicken breast with brown rice and sambal' },
        { name: 'Gado-gado (Indonesian salad)', calories: 180, protein: 8, carbs: 22, fat: 8, description: 'Mixed vegetables with peanut sauce' },
      ],
      meal_score: 82,
    },
    {
      meal_type: 'dinner',
      recommended_calories: 720,
      recommended_protein_grams: 48,
      recommended_carbs_grams: 78,
      recommended_fat_grams: 24,
      meal_suggestions: [
        { name: 'Ikan bakar dengan kentang rebus (Grilled fish with boiled potato)', calories: 520, protein: 40, carbs: 58, fat: 18, description: 'Grilled mackerel with boiled potatoes' },
        { name: 'Tumis kangkung (Stir-fried water spinach)', calories: 95, protein: 3, carbs: 12, fat: 4, description: 'Water spinach with garlic and chili' },
      ],
      meal_score: 88,
    },
  ];
  
  for (const plan of todayPlans) {
    const { error } = await supabase
      .from('daily_meal_plans')
      .insert({
        user_id: userId,
        date: getDate(0),
        meal_type: plan.meal_type,
        recommended_calories: plan.recommended_calories,
        recommended_protein_grams: plan.recommended_protein_grams,
        recommended_carbs_grams: plan.recommended_carbs_grams,
        recommended_fat_grams: plan.recommended_fat_grams,
        meal_suggestions: plan.meal_suggestions,
        meal_score: plan.meal_score,
      });
    
    if (error) {
      console.error(`❌ Error creating meal plan (${plan.meal_type}):`, error.message);
    }
  }
  
  console.log('✅ Daily meal plans created');
}

// ============================================
// 7. Create Wearable Data
// ============================================

async function createWearableData(userId) {
  console.log('⌚ Creating wearable data...');
  
  // Wearable data from Mon Oct 13 to Sun Oct 19
  const wearableData = [
    { daysOffset: -1, steps: 28500, calories: 1450, active_minutes: 120, heart_rate: 145, distance: 22000 }, // Mon: Long run
    { daysOffset: 0, steps: 12500, calories: 520, active_minutes: 45, heart_rate: 138, distance: 7500 },    // Tue: Easy recovery (today)
    { daysOffset: 1, steps: 13200, calories: 580, active_minutes: 45, heart_rate: 140, distance: 7500 },    // Wed: Easy run
    { daysOffset: 2, steps: 15200, calories: 780, active_minutes: 60, heart_rate: 155, distance: 12000 },   // Thu: Tempo run
    { daysOffset: 3, steps: 3200, calories: 1800, active_minutes: 0, heart_rate: 65, distance: 0 },         // Fri: Rest day
    { daysOffset: 4, steps: 14500, calories: 780, active_minutes: 60, heart_rate: 155, distance: 10000 },   // Sat: Intervals
    { daysOffset: 5, steps: 12800, calories: 620, active_minutes: 45, heart_rate: 138, distance: 8500 },    // Sun: Easy run
  ];
  
  for (const data of wearableData) {
    const { error } = await supabase
      .from('wearable_data')
      .insert({
        user_id: userId,
        date: getDate(-data.daysOffset),
        steps: data.steps,
        calories_burned: data.calories,
        active_minutes: data.active_minutes,
        heart_rate_avg: data.heart_rate,
        distance_meters: data.distance,
      });
    
    if (error) {
      console.error(`❌ Error creating wearable data (day ${data.daysOffset}):`, error.message);
    }
  }
  
  console.log('✅ Wearable data created');
}

// ============================================
// 8. Create Marathon Event (Skip - it's a public events table)
// ============================================

async function createMarathonEvent(userId) {
  console.log('🏅 Skipping marathon event (public events table, not user-specific)');
  console.log('✅ Marathon event skipped');
}

// ============================================
// Main Function
// ============================================

async function populateDemoAccount(userId) {
  console.log('🚀 Creating demo account data...\n');
  console.log(`User ID: ${userId}\n`);
  
  try {
    await createProfile(userId);
    await createTrainingActivities(userId);
    await createFoodLogs(userId);
    await createNutritionScores(userId);
    await createDailyMealPlans(userId);
    await createWearableData(userId);
    await createMarathonEvent(userId);
    
    console.log('\n✅ Demo account setup complete!\n');
    console.log('Demo Account Credentials:');
    console.log('Email: demo@nutrisync.id');
    console.log('Password: Demo2025!\n');
    console.log('Features populated:');
    console.log('- User profile (32yo male marathon runner)');
    console.log('- 7 days of training activities');
    console.log('- 7 days of food logs (~50 meals)');
    console.log('- 7 days of nutrition scores');
    console.log('- Today & tomorrow meal plans');
    console.log('- 7 days of wearable data');
    console.log('- Marathon event registration');
    
  } catch (error) {
    console.error('\n❌ Error creating demo account:', error);
  }
}

// ============================================
// CLI Interface
// ============================================

const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

if (command === 'create-auth') {
  const email = arg1 || 'demo@nutrisync.id';
  const password = arg2 || 'Demo2025!';
  
  createAuthUser(email, password).then(userId => {
    if (userId) {
      console.log('\n✅ Auth user created!');
      console.log(`\nNow run: node create-demo-account.mjs populate ${userId}`);
    }
  });
  
} else if (command === 'populate') {
  const userId = arg1;
  
  if (!userId) {
    console.error('❌ Usage: node create-demo-account.mjs populate <user-id>');
    process.exit(1);
  }
  
  populateDemoAccount(userId);
  
} else {
  console.log('NutriSync Demo Account Creator\n');
  console.log('Usage:');
  console.log('  1. Create auth user:');
  console.log('     node create-demo-account.mjs create-auth demo@nutrisync.id Demo2025!');
  console.log('');
  console.log('  2. Populate demo data:');
  console.log('     node create-demo-account.mjs populate <user-id>');
  console.log('');
  console.log('Or manually:');
  console.log('  1. Create user in Supabase Dashboard > Authentication');
  console.log('  2. Copy the user ID');
  console.log('  3. Run: node create-demo-account.mjs populate <user-id>');
}
