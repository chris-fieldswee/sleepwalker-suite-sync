-- Diagnostic script to check if room saving setup is correct
-- Run this to see what's missing

-- 1. Check if capacity_configurations column exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'rooms' 
      AND column_name = 'capacity_configurations'
    ) THEN '✓ Column capacity_configurations EXISTS'
    ELSE '✗ Column capacity_configurations DOES NOT EXIST - Run: supabase/migrations/20250104_room_capacity_configurations_safe.sql'
  END as capacity_configurations_status;

-- 2. Check if RPC functions exist
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'update_room_with_configurations' 
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN '✓ Function update_room_with_configurations EXISTS'
    ELSE '✗ Function update_room_with_configurations DOES NOT EXIST - Run: supabase/apply_rpc_functions.sql'
  END as update_function_status
UNION ALL
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'insert_room_with_configurations' 
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN '✓ Function insert_room_with_configurations EXISTS'
    ELSE '✗ Function insert_room_with_configurations DOES NOT EXIST - Run: supabase/apply_rpc_functions.sql'
  END as insert_function_status;

-- 3. Check current rooms table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'rooms'
ORDER BY ordinal_position;

-- 4. Check if any rooms have capacity_configurations data
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'rooms' 
      AND column_name = 'capacity_configurations'
    ) THEN (
      SELECT 
        COUNT(*)::text || ' rooms have capacity_configurations data'
      FROM public.rooms
      WHERE capacity_configurations IS NOT NULL 
        AND jsonb_typeof(capacity_configurations) = 'array'
        AND jsonb_array_length(capacity_configurations) > 0
    )
    ELSE 'Column does not exist - cannot check data'
  END as rooms_with_capacity_configs;

-- 5. Show sample room data (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'rooms' 
    AND column_name = 'capacity_configurations'
  ) THEN
    RAISE NOTICE 'Sample room with capacity_configurations:';
  END IF;
END $$;

SELECT 
  name,
  capacity,
  capacity_label,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'rooms' 
      AND column_name = 'capacity_configurations'
    ) THEN capacity_configurations::text
    ELSE 'Column does not exist'::text
  END as capacity_configurations,
  cleaning_types
FROM public.rooms
LIMIT 3;

