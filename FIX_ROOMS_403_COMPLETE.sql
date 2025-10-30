-- Complete fix for rooms 403 error
-- This ensures all necessary components are in place

-- Step 1: Ensure app_role enum exists
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'reception', 'housekeeping');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Ensure user_roles table exists
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Step 3: Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop and recreate user_roles SELECT policy (allow users to see their own roles)
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Step 5: Create or recreate has_role function as SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT exists(
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 6: Ensure current admin user has role in user_roles table
-- This will insert admin role for the currently authenticated admin user
DO $$
DECLARE
  current_admin_id uuid;
BEGIN
  -- Get the current admin's auth_id
  SELECT auth_id INTO current_admin_id 
  FROM public.users 
  WHERE auth_id = auth.uid() AND role = 'admin'
  LIMIT 1;
  
  -- Insert admin role if we found an admin and they don't have a role yet
  IF current_admin_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (current_admin_id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- Step 7: Ensure RLS is enabled on rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Step 8: Drop and recreate rooms manage policy
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'Reception and admin can manage rooms'
  ) THEN
    DROP POLICY "Reception and admin can manage rooms" ON public.rooms;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'Authenticated users can view rooms'
  ) THEN
    DROP POLICY "Authenticated users can view rooms" ON public.rooms;
  END IF;
END $$;

CREATE POLICY "Authenticated users can view rooms"
ON public.rooms FOR SELECT
USING (auth.uid() IS NOT NULL);

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

-- Step 9: Verify the fix
DO $$
DECLARE
  policy_exists boolean;
  has_admin_role boolean;
BEGIN
  -- Check if policy was created
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'rooms' 
      AND policyname = 'Reception and admin can manage rooms'
  ) INTO policy_exists;
  
  -- Check if current user has admin role
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO has_admin_role;
  
  -- Output results
  RAISE NOTICE 'Policy exists: %', policy_exists;
  RAISE NOTICE 'Current user has admin role: %', has_admin_role;
END $$;

