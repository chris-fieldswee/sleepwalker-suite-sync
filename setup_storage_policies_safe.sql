-- Safe storage policies setup - only creates if they don't exist
-- Run this in Supabase SQL Editor

-- Drop existing policies first (safe to run multiple times)
DROP POLICY IF EXISTS "Authenticated users can upload task photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view task photos" ON storage.objects;
DROP POLICY IF EXISTS "Reception and admin can delete task photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload issue photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view issue photos" ON storage.objects;
DROP POLICY IF EXISTS "Reception and admin can delete issue photos" ON storage.objects;

-- Create storage policies for task-photos
CREATE POLICY "Authenticated users can upload task photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'task-photos' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can view task photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'task-photos' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Reception and admin can delete task photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'task-photos' AND 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_id = auth.uid() AND role IN ('admin', 'reception')
  )
);

-- Create storage policies for issue-photos
CREATE POLICY "Authenticated users can upload issue photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'issue-photos' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can view issue photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'issue-photos' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Reception and admin can delete issue photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'issue-photos' AND 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_id = auth.uid() AND role IN ('admin', 'reception')
  )
);
