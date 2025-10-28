-- Check if admin user exists and is properly configured
-- This will help us understand why the profile fetch is failing

-- Check auth.users table
SELECT 
  'Auth users count: ' || COUNT(*) as auth_users_count
FROM auth.users;

-- Check public.users table  
SELECT 
  'Public users count: ' || COUNT(*) as public_users_count
FROM public.users;

-- Check for admin user specifically
SELECT 
  'Admin user in auth.users: ' || 
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@sleepwalker.com') THEN 'YES'
    ELSE 'NO'
  END as admin_in_auth;

SELECT 
  'Admin user in public.users: ' || 
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.users WHERE auth_id IN (SELECT id FROM auth.users WHERE email = 'admin@sleepwalker.com')) THEN 'YES'
    ELSE 'NO'
  END as admin_in_public;

-- Check user_roles for admin
SELECT 
  'Admin role exists: ' || 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN auth.users au ON ur.user_id = au.id
      WHERE au.email = 'admin@sleepwalker.com' AND ur.role = 'admin'
    ) THEN 'YES'
    ELSE 'NO'
  END as admin_role_exists;

-- Show current user info if any
SELECT 
  'Current auth.uid(): ' || COALESCE(auth.uid()::text, 'NULL') as current_auth_uid;
