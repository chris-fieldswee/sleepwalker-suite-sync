-- Check if PostgREST can see the functions via information_schema
-- This helps determine if PostgREST cache has refreshed

-- Method 1: Check routines that PostgREST typically exposes
SELECT 
  'PostgREST Visibility Check' as check_type,
  routine_name,
  routine_type,
  'Should be visible to PostgREST if cache refreshed' as note
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('update_room_with_configurations', 'insert_room_with_configurations')
ORDER BY routine_name;

-- Method 2: Direct check from pg_proc (what we know exists)
SELECT 
  'Direct Database Check' as check_type,
  proname as function_name,
  'Confirmed exists in database' as status
FROM pg_proc
WHERE proname IN ('update_room_with_configurations', 'insert_room_with_configurations')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- If both queries return the same functions, the functions exist
-- The issue is purely PostgREST cache needing a refresh

-- NOTE: Even if functions show up here, PostgREST may still need a restart
-- to rebuild its internal cache. The restart forces PostgREST to re-scan
-- and rebuild its schema cache from scratch.

