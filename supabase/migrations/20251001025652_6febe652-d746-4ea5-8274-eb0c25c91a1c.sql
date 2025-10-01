-- Change nutrition columns from integer to numeric to support decimal values
ALTER TABLE public.food_logs 
  ALTER COLUMN protein_grams TYPE NUMERIC(6,2),
  ALTER COLUMN carbs_grams TYPE NUMERIC(6,2),
  ALTER COLUMN fat_grams TYPE NUMERIC(6,2),
  ALTER COLUMN calories TYPE NUMERIC(7,2);

-- Update default values to work with numeric type
ALTER TABLE public.food_logs 
  ALTER COLUMN protein_grams SET DEFAULT 0,
  ALTER COLUMN carbs_grams SET DEFAULT 0,
  ALTER COLUMN fat_grams SET DEFAULT 0;