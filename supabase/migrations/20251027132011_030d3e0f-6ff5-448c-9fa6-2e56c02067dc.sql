-- Create storage buckets for task and issue photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('task-photos', 'task-photos', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
  ('issue-photos', 'issue-photos', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

-- RLS policies for task-photos bucket
CREATE POLICY "Authenticated users can view task photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'task-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload task photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'task-photos' AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their uploaded task photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'task-photos' AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Reception and admin can delete task photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'task-photos' AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reception'::app_role))
);

-- RLS policies for issue-photos bucket
CREATE POLICY "Authenticated users can view issue photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'issue-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload issue photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'issue-photos' AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their uploaded issue photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'issue-photos' AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Reception and admin can delete issue photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'issue-photos' AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reception'::app_role))
);