-- Add SVG support to issue-photos storage bucket
-- Update the bucket to allow SVG files in addition to existing image types

-- Update the issue-photos bucket to include SVG in allowed MIME types
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']
WHERE id = 'issue-photos';

