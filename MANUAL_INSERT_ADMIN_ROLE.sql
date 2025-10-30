-- Manual fix: Insert admin roles for all admin users
-- Run this after the main migration

-- First, check which users are admins
SELECT id, auth_id, name, role 
FROM public.users 
WHERE role = 'admin';

-- Then insert their roles into user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT auth_id, 'admin'::app_role
FROM public.users
WHERE auth_id IS NOT NULL AND role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify it worked
SELECT 
  u.name, 
  u.role as user_role,
  ur.role as user_roles_role,
  public.has_role(u.auth_id, 'admin'::app_role) as has_admin_role
FROM public.users u
LEFT JOIN public.user_roles ur ON u.auth_id = ur.user_id AND ur.role = 'admin'
WHERE u.role = 'admin';

