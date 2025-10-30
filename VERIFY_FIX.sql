-- Run this to verify the fix worked

-- Check if current user has admin role
SELECT public.has_role(auth.uid(), 'admin'::app_role) as "Admin role check";

-- Check if policies exist
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'rooms'
ORDER BY policyname;

-- Check if user_roles table has your admin entry
SELECT * FROM public.user_roles WHERE user_id = auth.uid();

