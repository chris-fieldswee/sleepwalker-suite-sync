-- Reset Admin User Password
-- Note: This script cannot directly reset the password in auth.users
-- You need to use the Supabase Dashboard or Admin API

-- Option 1: Use Supabase Dashboard (Recommended)
-- 1. Go to Authentication → Users
-- 2. Find admin@sleepwalker.com
-- 3. Click on the user
-- 4. Click "Reset password" or "Update user"
-- 5. Set new password to: admin1234
-- 6. Save

-- Option 2: Use Admin API (if you have service role key)
-- You can use the Supabase Admin API to reset the password programmatically

-- Verify the user exists and is active
SELECT 
  'User Status' as check_type,
  id as auth_id,
  email,
  email_confirmed_at IS NOT NULL as email_confirmed,
  created_at,
  'User exists and is ready for password reset' as status
FROM auth.users
WHERE email = 'admin@sleepwalker.com';

-- Check public.users status
SELECT 
  'Public User Status' as check_type,
  auth_id,
  name,
  role,
  active,
  'User is active and has admin role' as status
FROM public.users
WHERE auth_id = '600675ad-af15-4c72-b6d0-59d1b8e572a4';





