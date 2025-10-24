-- Fix 1: Create app_role enum type (check if exists first via DO block)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'reception', 'housekeeping');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Fix 2: Create user_roles table to break recursive RLS
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Only admins can manage roles"
ON public.user_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Fix 3: Create security definer function to check roles (breaks recursion)
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

-- Fix 4: Migrate existing user roles to new table (match by text value)
INSERT INTO public.user_roles (user_id, role)
SELECT auth_id, 
  CASE role::text
    WHEN 'admin' THEN 'admin'::app_role
    WHEN 'reception' THEN 'reception'::app_role
    WHEN 'housekeeping' THEN 'housekeeping'::app_role
  END
FROM public.users
WHERE auth_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Fix 5: Update handle_new_user to always default to housekeeping (prevent privilege escalation)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'housekeeping'::user_role  -- ALWAYS default to least privilege
  );
  
  -- Insert role into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'housekeeping'::app_role);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix 6: Update all RLS policies to use has_role function instead of recursive queries

-- Drop existing policies
DROP POLICY IF EXISTS "Only admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Only admins can update users" ON public.users;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Everyone can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Only reception and admin can manage rooms" ON public.rooms;
DROP POLICY IF EXISTS "Everyone can view limits" ON public.limits;
DROP POLICY IF EXISTS "Only admins can manage limits" ON public.limits;
DROP POLICY IF EXISTS "Housekeeping can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Housekeeping can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Only admin and reception can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Reception and admin can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Reception and admin can manage work logs" ON public.work_logs;
DROP POLICY IF EXISTS "Users can view their own work logs" ON public.work_logs;

-- Create new secure policies using has_role function

-- Users table policies (require authentication - fixes PUBLIC_DATA_EXPOSURE)
CREATE POLICY "Authenticated users can view profiles"
ON public.users FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert users"
ON public.users FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update users"
ON public.users FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Rooms table policies (require authentication - fixes PUBLIC_DATA_EXPOSURE)
CREATE POLICY "Authenticated users can view rooms"
ON public.rooms FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Reception and admin can manage rooms"
ON public.rooms FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'reception')
);

-- Limits table policies (require authentication - fixes PUBLIC_DATA_EXPOSURE)
CREATE POLICY "Authenticated users can view limits"
ON public.limits FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage limits"
ON public.limits FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Tasks table policies
CREATE POLICY "Users can view relevant tasks"
ON public.tasks FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'reception') OR
  (public.has_role(auth.uid(), 'housekeeping') AND user_id IN (
    SELECT id FROM public.users WHERE auth_id = auth.uid()
  ))
);

CREATE POLICY "Users can update relevant tasks"
ON public.tasks FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'reception') OR
  (public.has_role(auth.uid(), 'housekeeping') AND user_id IN (
    SELECT id FROM public.users WHERE auth_id = auth.uid()
  ))
);

CREATE POLICY "Admin and reception can insert tasks"
ON public.tasks FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'reception')
);

CREATE POLICY "Admin and reception can delete tasks"
ON public.tasks FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'reception')
);

-- Work logs table policies
CREATE POLICY "Users can view relevant work logs"
ON public.work_logs FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'reception') OR
  (public.has_role(auth.uid(), 'housekeeping') AND user_id IN (
    SELECT id FROM public.users WHERE auth_id = auth.uid()
  ))
);

CREATE POLICY "Reception and admin can manage work logs"
ON public.work_logs FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'reception')
);