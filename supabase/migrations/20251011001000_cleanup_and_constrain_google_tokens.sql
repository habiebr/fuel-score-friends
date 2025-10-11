-- First, mark all tokens as inactive
UPDATE public.google_tokens
SET is_active = false;

-- Then, keep only the most recent token per user and mark it as active
WITH RankedTokens AS (
  SELECT 
    id,
    user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) as rn
  FROM public.google_tokens
)
UPDATE public.google_tokens
SET is_active = true
WHERE id IN (
  SELECT id 
  FROM RankedTokens 
  WHERE rn = 1
);

-- Delete all older tokens
DELETE FROM public.google_tokens
WHERE id IN (
  SELECT id 
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) as rn
    FROM public.google_tokens
  ) ranked
  WHERE rn > 1
);

-- Drop the existing index if it exists and recreate it
DROP INDEX IF EXISTS google_tokens_user_id_active_unique;

-- Add a unique partial index to enforce one active token per user
CREATE UNIQUE INDEX google_tokens_user_id_active_unique 
  ON public.google_tokens (user_id)
  WHERE is_active = true;