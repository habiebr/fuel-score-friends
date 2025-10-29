-- ============================================
-- NutriSync Demo Account Setup
-- ============================================
-- This script creates a realistic demo account with:
-- - Complete user profile
-- - 7 days of food logs
-- - Training activities
-- - Nutrition scores
-- - Daily meal plans
-- ============================================

-- Step 1: Create demo user in auth.users (manual step required)
-- You need to create this user via Supabase Dashboard Auth section:
-- Email: demo@nutrisync.id
-- Password: Demo2025!
-- Then get the user_id and replace 'DEMO_USER_ID' below

-- For this script, let's use a placeholder UUID
-- Replace this with the actual UUID after creating the auth user
DO $$
DECLARE
  demo_user_id UUID := 'REPLACE_WITH_ACTUAL_USER_ID'; -- ⚠️ UPDATE THIS
  today_date DATE := CURRENT_DATE;
  day_offset INTEGER;
BEGIN

-- ============================================
-- 1. USER PROFILE - Marathon Runner
-- ============================================
INSERT INTO public.profiles (
  id,
  user_id,
  display_name,
  height_cm,
  weight_kg,
  age,
  sex,
  activity_level,
  fitness_goals,
  target_date,
  fitness_level,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  demo_user_id,
  'Demo Runner',
  175, -- 175cm height
  68,  -- 68kg weight
  32,  -- 32 years old
  'male',
  jsonb_build_object(
    'monday', jsonb_build_object('type', 'Easy Run', 'duration', 45),
    'tuesday', jsonb_build_object('type', 'Tempo Run', 'duration', 60),
    'wednesday', jsonb_build_object('type', 'Rest', 'duration', 0),
    'thursday', jsonb_build_object('type', 'Intervals', 'duration', 50),
    'friday', jsonb_build_object('type', 'Easy Run', 'duration', 40),
    'saturday', jsonb_build_object('type', 'Long Run', 'duration', 120),
    'sunday', jsonb_build_object('type', 'Recovery Run', 'duration', 30)
  ),
  ARRAY['Marathon Sub-3:30', 'Improve Endurance', 'Lose Weight'],
  CURRENT_DATE + INTERVAL '90 days', -- Race in 3 months
  'intermediate',
  NOW(),
  NOW()
) ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  height_cm = EXCLUDED.height_cm,
  weight_kg = EXCLUDED.weight_kg,
  updated_at = NOW();

-- ============================================
-- 2. TRAINING ACTIVITIES - Last 7 Days
-- ============================================

-- Day -6: Easy Run
INSERT INTO public.training_activities (
  id, user_id, date, activity_type, duration_minutes, 
  distance_km, intensity, estimated_calories, notes, created_at
) VALUES (
  gen_random_uuid(), demo_user_id, today_date - 6,
  'run', 45, 8.5, 'low', 520,
  'Morning easy run, felt great!', NOW()
);

-- Day -5: Tempo Run
INSERT INTO public.training_activities (
  id, user_id, date, activity_type, duration_minutes,
  distance_km, intensity, estimated_calories, notes, created_at
) VALUES (
  gen_random_uuid(), demo_user_id, today_date - 5,
  'run', 60, 12.0, 'high', 780,
  'Tempo run - maintained 4:50/km pace', NOW()
);

-- Day -4: Rest Day
INSERT INTO public.training_activities (
  id, user_id, date, activity_type, duration_minutes,
  distance_km, intensity, estimated_calories, notes, created_at
) VALUES (
  gen_random_uuid(), demo_user_id, today_date - 4,
  'rest', 0, 0, 'low', 0,
  'Rest day - active recovery stretching', NOW()
);

-- Day -3: Intervals
INSERT INTO public.training_activities (
  id, user_id, date, activity_type, duration_minutes,
  distance_km, intensity, estimated_calories, notes, created_at
) VALUES (
  gen_random_uuid(), demo_user_id, today_date - 3,
  'run', 50, 10.0, 'high', 680,
  '8x800m intervals - strong finish', NOW()
);

-- Day -2: Easy Run
INSERT INTO public.training_activities (
  id, user_id, date, activity_type, duration_minutes,
  distance_km, intensity, estimated_calories, notes, created_at
) VALUES (
  gen_random_uuid(), demo_user_id, today_date - 2,
  'run', 40, 7.0, 'low', 450,
  'Recovery pace, legs feeling good', NOW()
);

-- Day -1: Long Run
INSERT INTO public.training_activities (
  id, user_id, date, activity_type, duration_minutes,
  distance_km, intensity, estimated_calories, notes, created_at
) VALUES (
  gen_random_uuid(), demo_user_id, today_date - 1,
  'run', 120, 22.0, 'moderate', 1450,
  'Long run - 22km at marathon pace', NOW()
);

-- Today: Recovery Run
INSERT INTO public.training_activities (
  id, user_id, date, activity_type, duration_minutes,
  distance_km, intensity, estimated_calories, notes, created_at
) VALUES (
  gen_random_uuid(), demo_user_id, today_date,
  'run', 30, 5.0, 'low', 320,
  'Easy recovery jog', NOW()
);

-- ============================================
-- 3. FOOD LOGS - Last 7 Days
-- ============================================

-- Loop through last 7 days
FOR day_offset IN 0..6 LOOP
  
  -- BREAKFAST (healthy, consistent)
  INSERT INTO public.food_logs (
    id, user_id, food_name, meal_type,
    calories, protein_grams, carbs_grams, fat_grams,
    serving_size, logged_at
  ) VALUES (
    gen_random_uuid(), demo_user_id,
    'Oatmeal with banana and almonds', 'breakfast',
    420, 12, 68, 14,
    '1 bowl (200g oats, 1 banana, 20g almonds)',
    (today_date - day_offset) + TIME '07:30:00'
  );
  
  INSERT INTO public.food_logs (
    id, user_id, food_name, meal_type,
    calories, protein_grams, carbs_grams, fat_grams,
    serving_size, logged_at
  ) VALUES (
    gen_random_uuid(), demo_user_id,
    'Greek yogurt with berries', 'breakfast',
    180, 15, 22, 3,
    '200g yogurt, 50g mixed berries',
    (today_date - day_offset) + TIME '07:35:00'
  );

  -- LUNCH (balanced)
  INSERT INTO public.food_logs (
    id, user_id, food_name, meal_type,
    calories, protein_grams, carbs_grams, fat_grams,
    serving_size, logged_at
  ) VALUES (
    gen_random_uuid(), demo_user_id,
    'Grilled chicken breast with brown rice', 'lunch',
    520, 42, 58, 12,
    '150g chicken, 200g brown rice',
    (today_date - day_offset) + TIME '12:30:00'
  );
  
  INSERT INTO public.food_logs (
    id, user_id, food_name, meal_type,
    calories, protein_grams, carbs_grams, fat_grams,
    serving_size, logged_at
  ) VALUES (
    gen_random_uuid(), demo_user_id,
    'Mixed vegetable salad', 'lunch',
    120, 3, 18, 5,
    '200g mixed vegetables, olive oil dressing',
    (today_date - day_offset) + TIME '12:35:00'
  );

  -- SNACK (post-workout or afternoon)
  INSERT INTO public.food_logs (
    id, user_id, food_name, meal_type,
    calories, protein_grams, carbs_grams, fat_grams,
    serving_size, logged_at
  ) VALUES (
    gen_random_uuid(), demo_user_id,
    'Protein shake with banana', 'snack',
    280, 25, 35, 4,
    '1 scoop protein powder, 1 banana, 300ml water',
    (today_date - day_offset) + TIME '15:00:00'
  );

  -- DINNER (hearty, carb-focused for runners)
  INSERT INTO public.food_logs (
    id, user_id, food_name, meal_type,
    calories, protein_grams, carbs_grams, fat_grams,
    serving_size, logged_at
  ) VALUES (
    gen_random_uuid(), demo_user_id,
    'Salmon fillet with sweet potato', 'dinner',
    580, 38, 52, 22,
    '180g salmon, 250g sweet potato',
    (today_date - day_offset) + TIME '19:00:00'
  );
  
  INSERT INTO public.food_logs (
    id, user_id, food_name, meal_type,
    calories, protein_grams, carbs_grams, fat_grams,
    serving_size, logged_at
  ) VALUES (
    gen_random_uuid(), demo_user_id,
    'Steamed broccoli and carrots', 'dinner',
    90, 4, 16, 1,
    '150g mixed vegetables',
    (today_date - day_offset) + TIME '19:05:00'
  );

  -- EVENING SNACK (light)
  IF day_offset % 2 = 0 THEN -- Every other day
    INSERT INTO public.food_logs (
      id, user_id, food_name, meal_type,
      calories, protein_grams, carbs_grams, fat_grams,
      serving_size, logged_at
    ) VALUES (
      gen_random_uuid(), demo_user_id,
      'Apple with peanut butter', 'snack',
      220, 6, 28, 10,
      '1 medium apple, 2 tbsp peanut butter',
      (today_date - day_offset) + TIME '21:00:00'
    );
  END IF;

END LOOP;

-- ============================================
-- 4. NUTRITION SCORES - Last 7 Days
-- ============================================

FOR day_offset IN 0..6 LOOP
  
  INSERT INTO public.nutrition_scores (
    id, user_id, date,
    daily_score,
    calories_consumed,
    protein_grams,
    carbs_grams,
    fat_grams,
    meals_logged,
    breakfast_score,
    lunch_score,
    dinner_score,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    demo_user_id,
    today_date - day_offset,
    CASE 
      WHEN day_offset = 0 THEN 88  -- Today: Excellent
      WHEN day_offset = 1 THEN 82  -- Yesterday: Excellent
      WHEN day_offset = 2 THEN 75  -- Good
      WHEN day_offset = 3 THEN 79  -- Good
      WHEN day_offset = 4 THEN 85  -- Excellent
      WHEN day_offset = 5 THEN 72  -- Good
      ELSE 80  -- Good
    END,
    CASE 
      WHEN day_offset = 1 THEN 2600  -- Long run day - more calories
      ELSE 2200  -- Regular training day
    END,
    CASE 
      WHEN day_offset = 1 THEN 145  -- Long run day - more protein
      ELSE 125  -- Regular day
    END,
    CASE 
      WHEN day_offset = 1 THEN 320  -- Long run day - more carbs
      ELSE 280  -- Regular day
    END,
    71,  -- Fat grams
    CASE WHEN day_offset % 2 = 0 THEN 8 ELSE 7 END,  -- Meals logged
    85,  -- Breakfast score
    80,  -- Lunch score
    82,  -- Dinner score
    NOW(),
    NOW()
  ) ON CONFLICT (user_id, date) DO UPDATE SET
    daily_score = EXCLUDED.daily_score,
    calories_consumed = EXCLUDED.calories_consumed,
    updated_at = NOW();

END LOOP;

-- ============================================
-- 5. DAILY MEAL PLANS - Today & Tomorrow
-- ============================================

-- Today's meal plans
INSERT INTO public.daily_meal_plans (
  id, user_id, date, meal_type,
  recommended_calories,
  recommended_protein_grams,
  recommended_carbs_grams,
  recommended_fat_grams,
  meal_suggestions,
  meal_score,
  created_at,
  updated_at
) VALUES
  -- Breakfast
  (gen_random_uuid(), demo_user_id, today_date, 'breakfast',
   650, 28, 95, 18,
   jsonb_build_array(
     jsonb_build_object(
       'name', 'Nasi goreng telur (Fried rice with egg)',
       'calories', 520,
       'protein', 18,
       'carbs', 75,
       'fat', 14,
       'description', 'Indonesian fried rice with vegetables and egg'
     ),
     jsonb_build_object(
       'name', 'Pisang (Banana)',
       'calories', 105,
       'protein', 1,
       'carbs', 27,
       'fat', 0,
       'description', 'Fresh banana for quick energy'
     )
   ),
   85, NOW(), NOW()
  ),
  -- Lunch
  (gen_random_uuid(), demo_user_id, today_date, 'lunch',
   750, 45, 88, 22,
   jsonb_build_array(
     jsonb_build_object(
       'name', 'Ayam bakar dengan nasi merah (Grilled chicken with brown rice)',
       'calories', 580,
       'protein', 42,
       'carbs', 68,
       'fat', 15,
       'description', 'Grilled chicken breast with brown rice and sambal'
     ),
     jsonb_build_object(
       'name', 'Gado-gado (Indonesian salad)',
       'calories', 180,
       'protein', 8,
       'carbs', 22,
       'fat', 8,
       'description', 'Mixed vegetables with peanut sauce'
     )
   ),
   82, NOW(), NOW()
  ),
  -- Dinner
  (gen_random_uuid(), demo_user_id, today_date, 'dinner',
   720, 48, 78, 24,
   jsonb_build_array(
     jsonb_build_object(
       'name', 'Ikan bakar dengan kentang rebus (Grilled fish with boiled potato)',
       'calories', 520,
       'protein', 40,
       'carbs', 58,
       'fat', 18,
       'description', 'Grilled mackerel with boiled potatoes'
     ),
     jsonb_build_object(
       'name', 'Tumis kangkung (Stir-fried water spinach)',
       'calories', 95,
       'protein', 3,
       'carbs', 12,
       'fat', 4,
       'description', 'Water spinach with garlic and chili'
     )
   ),
   88, NOW(), NOW()
  );

-- Tomorrow's meal plans
INSERT INTO public.daily_meal_plans (
  id, user_id, date, meal_type,
  recommended_calories,
  recommended_protein_grams,
  recommended_carbs_grams,
  recommended_fat_grams,
  meal_suggestions,
  created_at,
  updated_at
) VALUES
  -- Breakfast
  (gen_random_uuid(), demo_user_id, today_date + 1, 'breakfast',
   620, 26, 90, 16,
   jsonb_build_array(
     jsonb_build_object(
       'name', 'Bubur ayam (Chicken porridge)',
       'calories', 420,
       'protein', 22,
       'carbs', 65,
       'fat', 8,
       'description', 'Rice porridge with shredded chicken and condiments'
     ),
     jsonb_build_object(
       'name', 'Telur rebus (Boiled eggs)',
       'calories', 140,
       'protein', 12,
       'carbs', 2,
       'fat', 10,
       'description', '2 boiled eggs for protein'
     )
   ),
   NOW(), NOW()
  ),
  -- Lunch
  (gen_random_uuid(), demo_user_id, today_date + 1, 'lunch',
   780, 48, 92, 24,
   jsonb_build_array(
     jsonb_build_object(
       'name', 'Soto ayam dengan nasi (Chicken soup with rice)',
       'calories', 520,
       'protein', 35,
       'carbs', 68,
       'fat', 12,
       'description', 'Yellow chicken soup with rice and vegetables'
     ),
     jsonb_build_object(
       'name', 'Tempe goreng (Fried tempeh)',
       'calories', 180,
       'protein', 15,
       'carbs', 12,
       'fat', 10,
       'description', 'Crispy fried tempeh for extra protein'
     )
   ),
   NOW(), NOW()
  ),
  -- Dinner
  (gen_random_uuid(), demo_user_id, today_date + 1, 'dinner',
   700, 45, 75, 22,
   jsonb_build_array(
     jsonb_build_object(
       'name', 'Rendang daging dengan nasi (Beef rendang with rice)',
       'calories', 580,
       'protein', 38,
       'carbs', 62,
       'fat', 20,
       'description', 'Slow-cooked beef in coconut curry with rice'
     ),
     jsonb_build_object(
       'name', 'Sayur asem (Sour vegetable soup)',
       'calories', 85,
       'protein', 3,
       'carbs', 15,
       'fat', 2,
       'description', 'Tamarind vegetable soup'
     )
   ),
   NOW(), NOW()
  );

-- ============================================
-- 6. WEARABLE DATA - Last 7 Days
-- ============================================

FOR day_offset IN 0..6 LOOP
  
  INSERT INTO public.wearable_data (
    id, user_id, date,
    steps, calories_burned, active_minutes,
    heart_rate_avg, distance_meters,
    created_at
  ) VALUES (
    gen_random_uuid(),
    demo_user_id,
    today_date - day_offset,
    CASE 
      WHEN day_offset = 1 THEN 28500  -- Long run day
      WHEN day_offset = 4 THEN 3200   -- Rest day
      ELSE 12000 + (RANDOM() * 3000)::INTEGER  -- Regular training days
    END,
    CASE 
      WHEN day_offset = 1 THEN 1450  -- Long run
      WHEN day_offset = 4 THEN 1800  -- Rest day (BMR only)
      WHEN day_offset IN (3, 5) THEN 780  -- High intensity days
      ELSE 520 + (RANDOM() * 150)::INTEGER  -- Easy days
    END,
    CASE 
      WHEN day_offset = 1 THEN 120  -- Long run
      WHEN day_offset = 4 THEN 0    -- Rest day
      WHEN day_offset IN (3, 5) THEN 60  -- Tempo/intervals
      ELSE 45  -- Easy runs
    END,
    CASE 
      WHEN day_offset IN (3, 5) THEN 155  -- High intensity
      WHEN day_offset = 4 THEN 65  -- Rest day
      ELSE 138  -- Easy pace
    END,
    CASE 
      WHEN day_offset = 1 THEN 22000  -- 22km long run
      WHEN day_offset = 4 THEN 0  -- Rest
      WHEN day_offset = 5 THEN 12000  -- 12km tempo
      WHEN day_offset = 3 THEN 10000  -- 10km intervals
      ELSE 7500  -- Easy 7-8km
    END,
    NOW()
  );

END LOOP;

-- ============================================
-- 7. MARATHON EVENT (Optional)
-- ============================================

INSERT INTO public.marathon_events (
  id, user_id, event_name, event_date,
  location, target_time, distance,
  notes, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  demo_user_id,
  'Jakarta Marathon 2025',
  CURRENT_DATE + INTERVAL '90 days',
  'Jakarta, Indonesia',
  '03:25:00'::INTERVAL,  -- Target: 3 hours 25 minutes
  42.195,
  'Goal: Sub 3:30 finish time. Training plan: 16 weeks.',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check profile
-- SELECT * FROM profiles WHERE display_name = 'Demo Runner';

-- Check food logs count
-- SELECT date, COUNT(*) as meals
-- FROM food_logs 
-- WHERE user_id = 'DEMO_USER_ID'
-- GROUP BY date 
-- ORDER BY date DESC;

-- Check nutrition scores
-- SELECT date, daily_score, calories_consumed
-- FROM nutrition_scores
-- WHERE user_id = 'DEMO_USER_ID'
-- ORDER BY date DESC;

-- Check training activities
-- SELECT date, activity_type, duration_minutes, distance_km, intensity
-- FROM training_activities
-- WHERE user_id = 'DEMO_USER_ID'
-- ORDER BY date DESC;

RAISE NOTICE '✅ Demo account setup complete! Update DEMO_USER_ID with actual UUID from auth.users';
