-- Fix/Create Admin User
-- Run this if the admin user doesn't exist or needs to be fixed

-- Step 1: Check if user exists in auth.users
DO $$
DECLARE
  v_auth_id UUID;
  v_user_exists BOOLEAN;
BEGIN
  -- Check if user exists
  SELECT id INTO v_auth_id
  FROM auth.users
  WHERE email = 'admin@sleepwalker.com';
  
  v_user_exists := v_auth_id IS NOT NULL;
  
  IF NOT v_user_exists THEN
    RAISE NOTICE 'User admin@sleepwalker.com does NOT exist in auth.users';
    RAISE NOTICE 'Please create the user manually in Supabase Dashboard:';
    RAISE NOTICE '1. Go to Authentication → Users → Add user';
    RAISE NOTICE '2. Email: admin@sleepwalker.com';
    RAISE NOTICE '3. Password: admin1234';
    RAISE NOTICE '4. Check "Auto Confirm User"';
    RAISE NOTICE '5. Click "Create user"';
    RAISE NOTICE '6. Then run the SQL below to set the admin role';
    RETURN;
  END IF;
  
  RAISE NOTICE 'User exists in auth.users with ID: %', v_auth_id;
  
  -- Step 2: Ensure user exists in public.users
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE auth_id = v_auth_id) THEN
    INSERT INTO public.users (auth_id, name, role, active)
    VALUES (v_auth_id, 'Admin User', 'admin', true)
    ON CONFLICT (auth_id) DO UPDATE
    SET role = 'admin', active = true;
    RAISE NOTICE 'Created/updated user in public.users';
  ELSE
    UPDATE public.users
    SET role = 'admin', active = true
    WHERE auth_id = v_auth_id;
    RAISE NOTICE 'Updated user in public.users to admin role';
  END IF;
  
  -- Step 3: Ensure role in user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_auth_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RAISE NOTICE 'Ensured admin role in user_roles table';
  
  -- Step 4: Confirm email if not confirmed
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = v_auth_id AND email_confirmed_at IS NULL;
  
  IF (SELECT email_confirmed_at FROM auth.users WHERE id = v_auth_id) IS NOT NULL THEN
    RAISE NOTICE 'Email confirmed';
  END IF;
  
  RAISE NOTICE '✓ Admin user setup complete!';
  RAISE NOTICE 'You can now log in with:';
  RAISE NOTICE '  Email: admin@sleepwalker.com';
  RAISE NOTICE '  Password: admin1234 (or the password you set)';
  
END $$;

-- After running the above, verify the user:
SELECT 
  'Verification' as check_type,
  au.email,
  au.email_confirmed_at IS NOT NULL as email_confirmed,
  pu.role,
  pu.active,
  ur.role as role_in_user_roles
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.auth_id
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
WHERE au.email = 'admin@sleepwalker.com';





