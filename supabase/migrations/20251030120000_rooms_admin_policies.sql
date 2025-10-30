-- Ensure rooms policies allow admins to manage rooms without service role
-- This migration is idempotent and safe to run multiple times

-- Ensure RLS is enabled
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Drop and recreate the policy to ensure it's correct
DROP POLICY IF EXISTS "Reception and admin can manage rooms" ON public.rooms;

-- Create rooms manage policy using has_role function (breaks recursion)
CREATE POLICY "Reception and admin can manage rooms"
ON public.rooms FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'reception')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'reception')
);


