-- Create daily_meal_plans table to store AI-generated meal recommendations
CREATE TABLE public.daily_meal_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  
  -- Recommended macros for this meal
  recommended_calories INTEGER NOT NULL,
  recommended_protein_grams INTEGER NOT NULL,
  recommended_carbs_grams INTEGER NOT NULL,
  recommended_fat_grams INTEGER NOT NULL,
  
  -- AI suggestions for this meal
  meal_suggestions JSONB DEFAULT '[]'::jsonb,
  
  -- Individual meal score (0-100)
  meal_score INTEGER DEFAULT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, date, meal_type)
);

-- Enable RLS on daily_meal_plans
ALTER TABLE public.daily_meal_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_meal_plans
CREATE POLICY "Users can view their own meal plans"
ON public.daily_meal_plans
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own meal plans"
ON public.daily_meal_plans
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meal plans"
ON public.daily_meal_plans
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meal plans"
ON public.daily_meal_plans
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_daily_meal_plans_updated_at
BEFORE UPDATE ON public.daily_meal_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update nutrition_scores table to track planned vs actual
ALTER TABLE public.nutrition_scores
ADD COLUMN IF NOT EXISTS planned_calories INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS planned_protein_grams INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS planned_carbs_grams INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS planned_fat_grams INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS breakfast_score INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lunch_score INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS dinner_score INTEGER DEFAULT NULL;