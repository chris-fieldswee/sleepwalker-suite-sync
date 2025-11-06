-- Fix Duplicate Roles for Admin User
-- This ensures admin@sleepwalker.com ONLY has the admin role

-- Step 1: Check current roles BEFORE fix
SELECT 
  'BEFORE FIX - Current Roles' as check_type,
  user_id,
  role,
  'This role is currently assigned' as status
FROM public.user_roles
WHERE user_id = '600675ad-af15-4c72-b6d0-59d1b8e572a4'
ORDER BY role;

-- Step 2: Remove ALL roles except admin
-- First, delete all roles for this user
DELETE FROM public.user_roles
WHERE user_id = '600675ad-af15-4c72-b6d0-59d1b8e572a4';

-- Step 3: Insert ONLY the admin role
INSERT INTO public.user_roles (user_id, role)
VALUES ('600675ad-af15-4c72-b6d0-59d1b8e572a4', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 4: Ensure role in public.users is also admin
UPDATE public.users
SET role = 'admin', active = true
WHERE auth_id = '600675ad-af15-4c72-b6d0-59d1b8e572a4';

-- Step 5: Verify only admin role remains
SELECT 
  'AFTER FIX - Roles in user_roles table' as check_type,
  user_id,
  role,
  'Should show ONLY admin' as status
FROM public.user_roles
WHERE user_id = '600675ad-af15-4c72-b6d0-59d1b8e572a4';

-- Step 6: Final verification - should show only 1 row now
SELECT 
  'FINAL VERIFICATION' as check_type,
  au.id AS auth_id,
  au.email,
  pu.role as role_in_users_table,
  ur.role AS role_in_user_roles_table,
  pu.active,
  CASE 
    WHEN pu.role = 'admin' AND ur.role = 'admin' AND pu.active = true THEN '✓ User is properly configured as ADMIN ONLY'
    ELSE '✗ Configuration issue'
  END as status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.auth_id
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
WHERE au.email = 'admin@sleepwalker.com';

-- Step 7: Count roles (should be exactly 1)
SELECT 
  'ROLE COUNT CHECK' as check_type,
  user_id,
  COUNT(*) as role_count,
  STRING_AGG(role::text, ', ') as roles,
  CASE 
    WHEN COUNT(*) = 1 AND MAX(role::text) = 'admin' THEN '✓ User has exactly ONE admin role'
    WHEN COUNT(*) > 1 THEN '✗ User still has MULTIPLE roles'
    WHEN COUNT(*) = 0 THEN '✗ User has NO roles'
    ELSE '✗ User has wrong role'
  END as status
FROM public.user_roles
WHERE user_id = '600675ad-af15-4c72-b6d0-59d1b8e572a4'
GROUP BY user_id;

