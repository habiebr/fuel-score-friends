-- Add unique constraint to ensure only one active token per user
ALTER TABLE public.google_tokens
  ADD CONSTRAINT google_tokens_user_id_active_unique 
  UNIQUE (user_id) 
  WHERE is_active = true;