-- Create storage bucket for food photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'food-photos',
  'food-photos',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Create RLS policy for food photos upload
CREATE POLICY "Users can upload their own food photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'food-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create RLS policy for food photos view
CREATE POLICY "Users can view their own food photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'food-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create RLS policy for food photos delete
CREATE POLICY "Users can delete their own food photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'food-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
