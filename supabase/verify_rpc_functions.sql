-- Verification Script for RPC Functions
-- Run this in your Supabase SQL Editor to check if everything is set up correctly

-- 1. Check if the functions exist
SELECT 
  'Function Existence Check' as check_type,
  proname as function_name,
  pg_get_function_identity_arguments(oid) as function_signature
FROM pg_proc
WHERE proname IN ('update_room_with_configurations', 'insert_room_with_configurations')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- 2. Check function details (return type, language, security)
SELECT 
  'Function Details' as check_type,
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  l.lanname as language,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END as security_type,
  pg_get_function_arguments(p.oid) as parameters
FROM pg_proc p
JOIN pg_language l ON p.prolang = l.oid
WHERE p.proname IN ('update_room_with_configurations', 'insert_room_with_configurations')
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY p.proname;

-- 3. Check permissions (GRANT statements)
SELECT 
  'Permissions Check' as check_type,
  p.proname as function_name,
  r.rolname as granted_to_role,
  CASE WHEN has_function_privilege(r.oid, p.oid, 'EXECUTE') THEN 'YES' ELSE 'NO' END as has_execute_permission
FROM pg_proc p
CROSS JOIN pg_roles r
WHERE p.proname IN ('update_room_with_configurations', 'insert_room_with_configurations')
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND r.rolname IN ('authenticated', 'anon', 'public')
ORDER BY p.proname, r.rolname;

-- 4. Verify the capacity_configurations column exists in rooms table
SELECT 
  'Column Check' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'rooms'
  AND column_name = 'capacity_configurations';

-- 5. Test the functions with sample data (if you have test rooms)
-- Uncomment these if you want to test with actual data

/*
-- Test insert_room_with_configurations
DO $$
DECLARE
  test_room_id UUID;
BEGIN
  -- This will create a test room (you may want to delete it after)
  SELECT public.insert_room_with_configurations(
    'TEST_ROOM_' || extract(epoch from now())::text,
    'P2'::room_group,
    '[
      {
        "capacity": 2,
        "capacity_label": "2",
        "cleaning_types": [
          {"type": "W", "time_limit": 40},
          {"type": "P", "time_limit": 30}
        ]
      }
    ]'::jsonb,
    2,
    '2'
  ) INTO test_room_id;
  
  RAISE NOTICE 'Test insert successful! Room ID: %', test_room_id;
  
  -- Clean up test room
  DELETE FROM public.rooms WHERE id = test_room_id;
  RAISE NOTICE 'Test room cleaned up';
END $$;
*/

-- 6. Summary check - all should return rows
SELECT 
  'SUMMARY' as check_type,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_proc WHERE proname IN ('update_room_with_configurations', 'insert_room_with_configurations') AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) = 2
    THEN '✓ Both functions exist'
    ELSE '✗ Missing functions'
  END as functions_exist,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'rooms' 
      AND column_name = 'capacity_configurations'
    )
    THEN '✓ Column exists'
    ELSE '✗ Column missing'
  END as column_exists,
  CASE 
    WHEN has_function_privilege('authenticated', 'public.update_room_with_configurations(uuid,text,room_group,jsonb,integer,text)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.insert_room_with_configurations(text,room_group,jsonb,integer,text)', 'EXECUTE')
    THEN '✓ Permissions granted'
    ELSE '✗ Permissions missing'
  END as permissions_set;

