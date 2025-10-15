-- Check food-photos bucket
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'food-photos';

-- Check food-photos storage policies
SELECT schemaname, tablename, policyname, roles, cmd 
FROM pg_policies 
WHERE tablename = 'objects' 
  AND policyname ILIKE '%food%' 
ORDER BY policyname;
