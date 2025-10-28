-- Temporarily disable RLS on users table to test authentication
-- This will allow the profile fetch to work while we debug the RLS policies

-- Disable RLS temporarily
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Test query to see if we can now access user profiles
SELECT 
  'RLS disabled - users table accessible: ' || 
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.users LIMIT 1) THEN 'YES'
    ELSE 'NO'
  END as test_result;
