-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  height INTEGER, -- in cm
  weight INTEGER, -- in kg
  age INTEGER,
  activity_level TEXT DEFAULT 'moderate',
  fitness_goals TEXT[] DEFAULT ARRAY['maintain_weight'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create nutrition_scores table
CREATE TABLE public.nutrition_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_score INTEGER NOT NULL DEFAULT 0,
  calories_consumed INTEGER DEFAULT 0,
  protein_grams INTEGER DEFAULT 0,
  carbs_grams INTEGER DEFAULT 0,
  fat_grams INTEGER DEFAULT 0,
  meals_logged INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create food_logs table
CREATE TABLE public.food_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  meal_type TEXT NOT NULL, -- breakfast, lunch, dinner, snack
  calories INTEGER NOT NULL,
  protein_grams INTEGER DEFAULT 0,
  carbs_grams INTEGER DEFAULT 0,
  fat_grams INTEGER DEFAULT 0,
  serving_size TEXT,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wearable_data table (simulated for now)
CREATE TABLE public.wearable_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  steps INTEGER DEFAULT 0,
  calories_burned INTEGER DEFAULT 0,
  active_minutes INTEGER DEFAULT 0,
  heart_rate_avg INTEGER DEFAULT 0,
  sleep_hours DECIMAL(3,1) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create friends table for community features
CREATE TABLE public.friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, blocked
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for nutrition_scores
CREATE POLICY "Users can view their own nutrition scores" 
ON public.nutrition_scores FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view friends' nutrition scores" 
ON public.nutrition_scores FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.friends 
    WHERE friends.user_id = auth.uid() 
    AND friends.friend_id = nutrition_scores.user_id 
    AND friends.status = 'accepted'
  )
);

CREATE POLICY "Users can insert their own nutrition scores" 
ON public.nutrition_scores FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own nutrition scores" 
ON public.nutrition_scores FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS Policies for food_logs
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

-- RLS Policies for wearable_data
CREATE POLICY "Users can view their own wearable data" 
ON public.wearable_data FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wearable data" 
ON public.wearable_data FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wearable data" 
ON public.wearable_data FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS Policies for friends
CREATE POLICY "Users can view their own friend connections" 
ON public.friends FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert their own friend requests" 
ON public.friends FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friend requests they're involved in" 
ON public.friends FOR UPDATE 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Create function to automatically create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_nutrition_scores_updated_at
  BEFORE UPDATE ON public.nutrition_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();