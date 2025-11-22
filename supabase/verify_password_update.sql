-- Verify Admin User After Password Update
-- Run this after updating the password to verify the user is still properly configured

-- 1. Check user exists in auth.users
SELECT 
  'Auth User Check' as check_type,
  id as auth_id,
  email,
  email_confirmed_at IS NOT NULL as email_confirmed,
  created_at,
  last_sign_in_at,
  'User exists in auth.users' as status
FROM auth.users
WHERE email = 'admin@sleepwalker.com';

-- 2. Check user in public.users
SELECT 
  'Public User Check' as check_type,
  id as user_id,
  auth_id,
  name,
  role,
  active,
  'User exists in public.users' as status
FROM public.users
WHERE auth_id = '600675ad-af15-4c72-b6d0-59d1b8e572a4';

-- 3. Check user roles
SELECT 
  'User Roles Check' as check_type,
  user_id,
  role,
  'Role assigned' as status
FROM public.user_roles
WHERE user_id = '600675ad-af15-4c72-b6d0-59d1b8e572a4';

-- 4. Complete status check
SELECT 
  'Complete Status' as check_type,
  au.email,
  au.email_confirmed_at IS NOT NULL as email_confirmed,
  pu.role as role_in_users_table,
  ur.role as role_in_user_roles_table,
  pu.active,
  CASE 
    WHEN au.id IS NULL THEN '✗ User missing in auth.users'
    WHEN pu.id IS NULL THEN '✗ User missing in public.users'
    WHEN ur.user_id IS NULL THEN '✗ User missing in user_roles'
    WHEN pu.role != 'admin' THEN '✗ Wrong role in users table'
    WHEN ur.role != 'admin' THEN '✗ Wrong role in user_roles table'
    WHEN pu.active = false THEN '✗ User is inactive'
    WHEN au.email_confirmed_at IS NULL THEN '✗ Email not confirmed'
    ELSE '✓ User is properly configured - ready to log in'
  END as status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.auth_id
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
WHERE au.email = 'admin@sleepwalker.com';





