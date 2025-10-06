-- Create storage bucket for fitness screenshots (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fitness-screenshots',
  'fitness-screenshots',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for fitness screenshots (if not exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' 
                 AND policyname = 'Users can upload their own fitness screenshots') THEN
    CREATE POLICY "Users can upload their own fitness screenshots"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'fitness-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' 
                 AND policyname = 'Users can view their own fitness screenshots') THEN
    CREATE POLICY "Users can view their own fitness screenshots"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'fitness-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' 
                 AND policyname = 'Users can delete their own fitness screenshots') THEN
    CREATE POLICY "Users can delete their own fitness screenshots"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'fitness-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
