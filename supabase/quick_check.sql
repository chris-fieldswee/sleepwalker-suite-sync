-- Quick Verification Check
-- Run this first to see if everything is set up correctly
-- All results should show ✓ (checkmarks)

SELECT 
  'Functions exist' as check_item,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_proc 
          WHERE proname IN ('update_room_with_configurations', 'insert_room_with_configurations') 
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) = 2
    THEN '✓ YES (both functions found)'
    ELSE '✗ NO (functions missing)'
  END as result;

SELECT 
  'Column exists' as check_item,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'rooms' 
      AND column_name = 'capacity_configurations'
      AND data_type = 'jsonb'
    )
    THEN '✓ YES'
    ELSE '✗ NO'
  END as result;

SELECT 
  'Permissions OK' as check_item,
  CASE 
    WHEN has_function_privilege('authenticated', 'public.update_room_with_configurations(uuid,text,room_group,jsonb,integer,text)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.insert_room_with_configurations(text,room_group,jsonb,integer,text)', 'EXECUTE')
    THEN '✓ YES (authenticated users can execute)'
    ELSE '✗ NO (permissions missing)'
  END as result;

-- If any show ✗, run the apply_rpc_functions.sql script

