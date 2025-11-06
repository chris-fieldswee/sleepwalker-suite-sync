-- Check Admin User Status
-- Run this in Supabase SQL Editor to verify the admin user exists and is set up correctly

-- 1. Check if user exists in auth.users
SELECT 
  'Auth Users Check' as check_type,
  id as auth_id,
  email,
  email_confirmed_at,
  created_at,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✓ Email confirmed'
    ELSE '✗ Email NOT confirmed'
  END as email_status
FROM auth.users
WHERE email = 'admin@sleepwalker.com';

-- 2. Check if user exists in public.users
SELECT 
  'Public Users Check' as check_type,
  id as user_id,
  auth_id,
  name,
  role,
  active,
  CASE 
    WHEN active = true THEN '✓ Active'
    ELSE '✗ Inactive'
  END as active_status
FROM public.users
WHERE auth_id IN (
  SELECT id FROM auth.users WHERE email = 'admin@sleepwalker.com'
);

-- 3. Check user_roles table
SELECT 
  'User Roles Check' as check_type,
  user_id,
  role,
  '✓ Role assigned' as status
FROM public.user_roles
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'admin@sleepwalker.com'
);

-- 4. Check for duplicate roles (this will show multiple rows if user has multiple roles)
SELECT 
  'Full User Status' as check_type,
  au.id AS auth_id,
  au.email,
  au.email_confirmed_at IS NOT NULL as email_confirmed,
  pu.id AS user_id,
  pu.name,
  pu.role as role_in_users_table,
  pu.active,
  ur.role AS role_in_user_roles_table,
  CASE 
    WHEN au.id IS NULL THEN '✗ User does NOT exist in auth.users'
    WHEN pu.id IS NULL THEN '✗ User exists in auth but NOT in public.users'
    WHEN ur.user_id IS NULL THEN '✗ User exists but has NO role in user_roles table'
    WHEN pu.active = false THEN '✗ User is INACTIVE'
    WHEN au.email_confirmed_at IS NULL THEN '✗ Email NOT confirmed'
    WHEN pu.role != 'admin' THEN '✗ User role is NOT admin'
    WHEN COUNT(*) OVER (PARTITION BY au.id) > 1 THEN '⚠ User has MULTIPLE roles in user_roles table (should only have admin)'
    WHEN ur.role != 'admin' THEN '⚠ User has wrong role in user_roles table'
    ELSE '✓ User is properly configured'
  END as overall_status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.auth_id
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
WHERE au.email = 'admin@sleepwalker.com';

-- 5. Count roles per user (should be 1 for admin user)
SELECT 
  'Role Count Check' as check_type,
  user_id,
  COUNT(*) as role_count,
  STRING_AGG(role::text, ', ') as roles,
  CASE 
    WHEN COUNT(*) > 1 THEN '⚠ User has MULTIPLE roles - should only have admin'
    WHEN COUNT(*) = 0 THEN '✗ User has NO roles'
    WHEN COUNT(*) = 1 AND MAX(role::text) = 'admin' THEN '✓ User has correct single admin role'
    ELSE '⚠ User has wrong role'
  END as status
FROM public.user_roles
WHERE user_id = '600675ad-af15-4c72-b6d0-59d1b8e572a4'
GROUP BY user_id;

