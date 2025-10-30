-- Ensure all users have roles in user_roles table
-- This fixes the case where users exist in public.users but not in user_roles

INSERT INTO public.user_roles (user_id, role)
SELECT auth_id, 
  CASE role::text
    WHEN 'admin' THEN 'admin'::app_role
    WHEN 'reception' THEN 'reception'::app_role
    WHEN 'housekeeping' THEN 'housekeeping'::app_role
  END
FROM public.users
WHERE auth_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = public.users.auth_id
  )
ON CONFLICT (user_id, role) DO NOTHING;

