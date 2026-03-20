-- Create storage bucket for listing images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-images',
  'listing-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- RLS: anyone can view images (bucket is public)
CREATE POLICY "Public read listing images"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-images');

-- RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload listing images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'listing-images');

-- RLS: owners can delete their own images (folder = userId)
CREATE POLICY "Owners can delete own listing images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add image columns to listings
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS image_url  TEXT,
  ADD COLUMN IF NOT EXISTS image_path TEXT;
