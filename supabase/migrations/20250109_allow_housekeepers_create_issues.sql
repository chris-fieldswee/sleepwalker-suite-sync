-- Allow housekeepers to create issues in the issues table
-- This migration adds an RLS policy to allow housekeeping staff to insert issues

-- Add policy for housekeepers to create issues
CREATE POLICY "Housekeepers can create issues"
  ON public.issues
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'housekeeping'::app_role)
  );


