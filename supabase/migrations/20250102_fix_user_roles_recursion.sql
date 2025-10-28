-- Fix infinite recursion in user_roles RLS policies
-- The current policies cause infinite recursion because they query user_roles
-- to check permissions, but querying user_roles triggers the same policy check

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;

-- Create new policies that don't cause recursion
-- Allow users to view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Allow admins to manage all roles (using the users table instead of user_roles)
CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'admin'
  )
);

-- Also allow service role to manage roles (for system operations)
CREATE POLICY "Service role can manage roles"
ON public.user_roles FOR ALL
USING (auth.role() = 'service_role');

-- Create a function to fix admin role that bypasses RLS
CREATE OR REPLACE FUNCTION public.fix_admin_role(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert admin role, ignoring conflicts
  INSERT INTO public.user_roles (user_id, role)
  VALUES (user_id, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;
