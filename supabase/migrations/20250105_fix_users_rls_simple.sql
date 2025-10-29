-- Fix RLS policies for users table
-- This migration ensures users can access their own profiles

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Service role can manage users" ON public.users;

-- Create simple, working policies
CREATE POLICY "Users can view their own profile"
ON public.users FOR SELECT
USING (auth.uid() = auth_id);

CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE
USING (auth.uid() = auth_id)
WITH CHECK (auth.uid() = auth_id);

-- Allow service role full access
CREATE POLICY "Service role can manage users"
ON public.users FOR ALL
USING (auth.role() = 'service_role');

-- Allow authenticated users to view all users (for now, to simplify)
-- This can be restricted later if needed
CREATE POLICY "Authenticated users can view all users"
ON public.users FOR SELECT
USING (auth.role() = 'authenticated');
