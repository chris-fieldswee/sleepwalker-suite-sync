-- Debug script to check user profiles and authentication
-- Run this in Supabase SQL Editor to see what users exist

-- Check all users in the users table
SELECT 
  id,
  auth_id,
  name,
  first_name,
  last_name,
  role,
  active,
  created_at
FROM public.users
ORDER BY created_at DESC;

-- Check user_roles table
SELECT 
  ur.id,
  ur.user_id,
  ur.role,
  u.name as user_name,
  u.role as user_table_role
FROM public.user_roles ur
LEFT JOIN public.users u ON ur.user_id = u.auth_id
ORDER BY ur.created_at DESC;

-- Check auth.users table (this might not be accessible depending on permissions)
-- SELECT id, email, email_confirmed_at, created_at FROM auth.users ORDER BY created_at DESC;
