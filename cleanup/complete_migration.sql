-- Complete Migration for NutriSync Project
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. CREATE CORE TABLES
-- =============================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  height INTEGER, -- in cm
  weight INTEGER, -- in kg
  age INTEGER,
  activity_level TEXT DEFAULT 'moderate',
  fitness_goals TEXT[] DEFAULT ARRAY['maintain_weight'],
  target_date DATE,
  fitness_level TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create nutrition_scores table
CREATE TABLE IF NOT EXISTS public.nutrition_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_score INTEGER NOT NULL DEFAULT 0,
  calories_consumed INTEGER DEFAULT 0,
  protein_grams NUMERIC(6,2) DEFAULT 0,
  carbs_grams NUMERIC(6,2) DEFAULT 0,
  fat_grams NUMERIC(6,2) DEFAULT 0,
  meals_logged INTEGER DEFAULT 0,
  breakfast_score INTEGER,
  lunch_score INTEGER,
  dinner_score INTEGER,
  planned_calories INTEGER DEFAULT 0,
  planned_protein_grams INTEGER DEFAULT 0,
  planned_carbs_grams INTEGER DEFAULT 0,
  planned_fat_grams INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create food_logs table
CREATE TABLE IF NOT EXISTS public.food_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  meal_type TEXT NOT NULL, -- breakfast, lunch, dinner, snack
  calories NUMERIC(7,2) NOT NULL,
  protein_grams NUMERIC(6,2) DEFAULT 0,
  carbs_grams NUMERIC(6,2) DEFAULT 0,
  fat_grams NUMERIC(6,2) DEFAULT 0,
  serving_size TEXT,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create daily_meal_plans table
CREATE TABLE IF NOT EXISTS public.daily_meal_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  recommended_calories INTEGER NOT NULL,
  recommended_protein_grams INTEGER NOT NULL,
  recommended_carbs_grams INTEGER NOT NULL,
  recommended_fat_grams INTEGER NOT NULL,
  meal_suggestions JSONB DEFAULT '[]'::jsonb,
  meal_score INTEGER DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, meal_type)
);

-- Create wearable_data table
CREATE TABLE IF NOT EXISTS public.wearable_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  steps INTEGER DEFAULT 0,
  calories_burned INTEGER DEFAULT 0,
  active_minutes INTEGER DEFAULT 0,
  heart_rate_avg INTEGER DEFAULT 0,
  sleep_hours DECIMAL(3,1) DEFAULT 0,
  distance_meters NUMERIC DEFAULT 0,
  elevation_gain NUMERIC DEFAULT 0,
  max_heart_rate INTEGER DEFAULT 0,
  heart_rate_zones JSONB DEFAULT '{}',
  avg_cadence INTEGER DEFAULT 0,
  avg_power INTEGER DEFAULT 0,
  max_speed NUMERIC DEFAULT 0,
  activity_type TEXT,
  gps_data JSONB DEFAULT '[]',
  detailed_metrics JSONB DEFAULT '{}',
  avg_temperature INTEGER,
  training_effect NUMERIC(3,1),
  recovery_time INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create wearable_laps table
CREATE TABLE IF NOT EXISTS public.wearable_laps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  wearable_data_id UUID REFERENCES public.wearable_data(id) ON DELETE CASCADE,
  lap_index INTEGER NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  total_time NUMERIC,
  total_distance NUMERIC,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  avg_speed NUMERIC,
  calories INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(wearable_data_id, lap_index)
);

-- Create marathon_events table
CREATE TABLE IF NOT EXISTS public.marathon_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  location TEXT NOT NULL,
  country TEXT NOT NULL,
  distance TEXT NOT NULL,
  event_url TEXT,
  description TEXT,
  registration_deadline DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create friends table
CREATE TABLE IF NOT EXISTS public.friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, blocked
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- =============================================
-- 2. ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_laps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marathon_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. CREATE RLS POLICIES
-- =============================================

-- Profiles policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Nutrition scores policies
CREATE POLICY "Users can view their own nutrition scores" 
ON public.nutrition_scores FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view friends' nutrition scores" 
ON public.nutrition_scores FOR SELECT 
USING (
  auth.uid() = user_id OR 
  auth.uid() IN (
    SELECT friend_id FROM public.friends 
    WHERE user_id = auth.uid() AND status = 'accepted'
  )
);

CREATE POLICY "Users can insert their own nutrition scores" 
ON public.nutrition_scores FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own nutrition scores" 
ON public.nutrition_scores FOR UPDATE 
USING (auth.uid() = user_id);

-- Food logs policies
CREATE POLICY "Users can view their own food logs" 
ON public.food_logs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own food logs" 
ON public.food_logs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own food logs" 
ON public.food_logs FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own food logs" 
ON public.food_logs FOR DELETE 
USING (auth.uid() = user_id);

-- Daily meal plans policies
CREATE POLICY "Users can view their own meal plans"
ON public.daily_meal_plans FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own meal plans"
ON public.daily_meal_plans FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meal plans"
ON public.daily_meal_plans FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meal plans"
ON public.daily_meal_plans FOR DELETE
USING (auth.uid() = user_id);

-- Wearable data policies
CREATE POLICY "Users can view their own wearable data" 
ON public.wearable_data FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wearable data" 
ON public.wearable_data FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wearable data" 
ON public.wearable_data FOR UPDATE 
USING (auth.uid() = user_id);

-- Wearable laps policies
CREATE POLICY "Users can view their own laps"
ON public.wearable_laps FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own laps"
ON public.wearable_laps FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own laps"
ON public.wearable_laps FOR UPDATE
USING (auth.uid() = user_id);

-- Marathon events policies (public read)
CREATE POLICY "Marathon events are viewable by everyone"
ON public.marathon_events FOR SELECT
USING (true);

-- Friends policies
CREATE POLICY "Users can view their own friends" 
ON public.friends FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert friend requests" 
ON public.friends FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own friend requests" 
ON public.friends FOR UPDATE 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- =============================================
-- 4. CREATE FUNCTIONS AND TRIGGERS
-- =============================================

-- Create handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$function$;

-- Create update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Create triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_nutrition_scores_updated_at
  BEFORE UPDATE ON public.nutrition_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_meal_plans_updated_at
  BEFORE UPDATE ON public.daily_meal_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 5. CREATE INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_marathon_events_date ON public.marathon_events(event_date);
CREATE INDEX IF NOT EXISTS idx_marathon_events_country ON public.marathon_events(country);
CREATE INDEX IF NOT EXISTS idx_wearable_laps_user_id ON public.wearable_laps(user_id);
CREATE INDEX IF NOT EXISTS idx_wearable_laps_data_id ON public.wearable_laps(wearable_data_id);

-- =============================================
-- 6. INSERT SAMPLE DATA
-- =============================================

-- Insert sample marathon events
INSERT INTO public.marathon_events (event_name, event_date, location, country, distance, event_url, description, registration_deadline) VALUES
('Jakarta Marathon', '2025-10-26', 'Jakarta', 'Indonesia', 'Full Marathon, Half Marathon, 10K', 'https://jakartamarathon.com', 'The biggest marathon event in Jakarta with routes through the city''s iconic landmarks.', '2025-10-15'),
('Bali Marathon', '2025-08-17', 'Bali', 'Indonesia', 'Full Marathon, Half Marathon, 10K, 5K', 'https://balimarathon.com', 'Run through the beautiful landscapes of Bali with beach and temple views.', '2025-08-01'),
('Borobudur Marathon', '2025-11-23', 'Magelang', 'Indonesia', 'Full Marathon, Half Marathon, 10K, 5K', 'https://borobudurmarathon.com', 'Experience running around the magnificent Borobudur Temple.', '2025-11-10'),
('Surabaya Marathon', '2025-11-09', 'Surabaya', 'Indonesia', 'Full Marathon, Half Marathon, 10K', NULL, 'East Java''s premier running event through the city of heroes.', '2025-10-25'),
('Mandalika Lombok Marathon', '2025-09-14', 'Lombok', 'Indonesia', 'Full Marathon, Half Marathon, 10K', NULL, 'Run on the beautiful Mandalika circuit with stunning coastal views.', '2025-09-01'),
('Tokyo Marathon', '2025-03-02', 'Tokyo', 'Japan', '42.2K', 'https://tokyomarathon.com', 'One of the World Marathon Majors', '2025-02-01'),
('Boston Marathon', '2025-04-21', 'Boston', 'USA', '42.2K', 'https://bostonmarathon.com', 'Historic marathon in Boston', '2025-03-01'),
('London Marathon', '2025-04-27', 'London', 'UK', '42.2K', 'https://londonmarathon.com', 'Another World Marathon Major', '2025-03-01')
ON CONFLICT DO NOTHING;

-- =============================================
-- 7. VERIFY MIGRATION
-- =============================================

SELECT 'Migration completed successfully!' as status;

-- Show all tables
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
