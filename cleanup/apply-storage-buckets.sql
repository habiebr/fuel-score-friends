-- Apply storage bucket migrations to production
-- This creates the food-photos and fitness-screenshots buckets

-- Create food-photos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'food-photos',
  'food-photos',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

-- Create fitness-screenshots bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fitness-screenshots',
  'fitness-screenshots',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload their own food photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own food photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own food photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own fitness screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own fitness screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own fitness screenshots" ON storage.objects;

-- Create RLS policies for food-photos bucket
CREATE POLICY "Users can upload their own food photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'food-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own food photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'food-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own food photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'food-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create RLS policies for fitness-screenshots bucket
CREATE POLICY "Users can upload their own fitness screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fitness-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own fitness screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'fitness-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own fitness screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'fitness-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
