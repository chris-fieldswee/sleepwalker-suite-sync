-- Fix RLS policies for public.users table to allow profile fetching
-- This script fixes the issue where users can't fetch their own profiles

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Service role can manage users" ON public.users;

-- Create new policies that work correctly
-- Allow users to view their own profile
CREATE POLICY "Users can view their own profile"
ON public.users FOR SELECT
USING (auth.uid() = auth_id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE
USING (auth.uid() = auth_id)
WITH CHECK (auth.uid() = auth_id);

-- Allow admins to view all users (using a simpler approach)
CREATE POLICY "Admins can view all users"
ON public.users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow admins to manage all users
CREATE POLICY "Admins can manage all users"
ON public.users FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow service role to manage users
CREATE POLICY "Service role can manage users"
ON public.users FOR ALL
USING (auth.role() = 'service_role');

-- Test the policies by checking if the current user can access their profile
SELECT 
  'Current user can access profile: ' || 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.users 
      WHERE auth_id = auth.uid()
    ) THEN 'YES'
    ELSE 'NO'
  END as test_result;
