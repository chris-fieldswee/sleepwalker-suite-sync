-- Create Admin User - Step by Step Instructions
-- Follow these steps in order

-- ============================================
-- STEP 1: Create User in Supabase Dashboard
-- ============================================
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add user" → "Create new user"
-- 3. Fill in:
--    - Email: admin@sleepwalker.com
--    - Password: admin1234
--    - ✅ Check "Auto Confirm User"
-- 4. Click "Create user"
-- 5. Copy the User UUID (auth_id) from the user details page
--    It will look like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

-- ============================================
-- STEP 2: Run the SQL below (AFTER creating user in dashboard)
-- ============================================
-- Replace 'YOUR_AUTH_ID_HERE' with the UUID you copied in Step 1

DO $$
DECLARE
  v_auth_id UUID := 'YOUR_AUTH_ID_HERE'; -- ⚠️ REPLACE THIS with the actual UUID from Step 1
  v_user_exists BOOLEAN;
  v_user_id UUID;
BEGIN
  -- Check if auth user exists
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = v_auth_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'Auth user with ID % does not exist. Please create the user in Supabase Dashboard first (Step 1)', v_auth_id;
  END IF;
  
  RAISE NOTICE '✓ Auth user exists: %', v_auth_id;
  
  -- Create/Update user in public.users
  INSERT INTO public.users (auth_id, name, role, active)
  VALUES (v_auth_id, 'Admin User', 'admin', true)
  ON CONFLICT (auth_id) DO UPDATE
  SET role = 'admin', active = true, name = 'Admin User'
  RETURNING id INTO v_user_id;
  
  RAISE NOTICE '✓ User created/updated in public.users with ID: %', v_user_id;
  
  -- Ensure admin role in user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_auth_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RAISE NOTICE '✓ Admin role assigned in user_roles table';
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Admin user setup complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Email: admin@sleepwalker.com';
  RAISE NOTICE 'Password: admin1234';
  RAISE NOTICE 'Auth ID: %', v_auth_id;
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE '';
  RAISE NOTICE 'You can now log in with these credentials.';
  
END $$;

-- ============================================
-- STEP 3: Verify the user was created correctly
-- ============================================
-- Run this after Step 2 to verify everything is set up correctly

SELECT 
  'Verification' as check_type,
  au.id AS auth_id,
  au.email,
  au.email_confirmed_at IS NOT NULL as email_confirmed,
  pu.id AS user_id,
  pu.name,
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
    ELSE '✓ User is properly configured - ready to log in!'
  END as status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.auth_id
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
WHERE au.email = 'admin@sleepwalker.com';

