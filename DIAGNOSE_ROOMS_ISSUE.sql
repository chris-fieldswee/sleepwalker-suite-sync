-- Diagnostic queries to troubleshoot the 403 error on rooms table

-- 1. Check if user_roles table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'user_roles'
) as "user_roles table exists";

-- 2. Check if has_role function exists
SELECT EXISTS (
  SELECT 1 FROM pg_proc 
  WHERE proname = 'has_role' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
) as "has_role function exists";

-- 3. Check current user's roles in user_roles table
SELECT * FROM public.user_roles WHERE user_id = auth.uid();

-- 4. Check current user's role in users table
SELECT id, auth_id, name, role, active FROM public.users WHERE auth_id = auth.uid();

-- 5. Test has_role function directly
SELECT public.has_role(auth.uid(), 'admin'::app_role) as "is_admin",
       public.has_role(auth.uid(), 'reception'::app_role) as "is_reception";

-- 6. Check rooms table RLS policies
SELECT policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'rooms'
ORDER BY policyname;

-- 7. Check if RLS is enabled on rooms
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'rooms';

-- 8. Try to manually test the policy condition
SELECT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
) OR EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role = 'reception'
) as "policy_check_result";

