-- Check current rooms RLS policies and user roles

-- 1. Check if RLS is enabled on rooms table
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'rooms';

-- 2. Check all RLS policies on rooms table
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'rooms';

-- 3. Check if has_role function exists
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND proname = 'has_role';

-- 4. Check user_roles for the current authenticated user
-- Note: Replace 'YOUR_AUTH_UID' with your actual auth.uid() when testing
SELECT 
  ur.user_id,
  ur.role,
  u.auth_id,
  u.name,
  u.role as user_role
FROM public.user_roles ur
LEFT JOIN public.users u ON u.auth_id = ur.user_id
ORDER BY u.name;

-- 5. Test has_role function for admin (replace YOUR_AUTH_UID)
-- SELECT public.has_role('YOUR_AUTH_UID', 'admin'::app_role);
-- SELECT public.has_role('YOUR_AUTH_UID', 'reception'::app_role);

