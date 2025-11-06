-- Force PostgREST Schema Cache Refresh
-- Run this after creating functions to help PostgREST recognize them

-- 1. Verify function signatures match what we're calling
SELECT 
  'Function Signature Check' as check_type,
  proname,
  pg_get_function_arguments(oid) as current_signature,
  'Expected for update: room_id_param uuid, room_name text, room_group_type room_group, room_capacity_configurations jsonb, room_capacity integer, room_capacity_label text' as expected_update,
  'Expected for insert: room_name text, room_group_type room_group, room_capacity_configurations jsonb, room_capacity integer, room_capacity_label text' as expected_insert
FROM pg_proc
WHERE proname IN ('update_room_with_configurations', 'insert_room_with_configurations')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. Try to refresh PostgREST cache by calling NOTIFY
-- Note: This only works if you have pg_notify available
-- PostgREST monitors certain events and may refresh on schema changes

-- 3. Alternative: Recreate the functions with explicit casting to ensure compatibility
-- (Uncomment if needed)
/*
CREATE OR REPLACE FUNCTION public.update_room_with_configurations(
  room_id_param UUID,
  room_name TEXT,
  room_group_type room_group,
  room_capacity_configurations JSONB,
  room_capacity INTEGER DEFAULT NULL,
  room_capacity_label TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.rooms
  SET
    name = room_name,
    group_type = room_group_type,
    capacity_configurations = room_capacity_configurations,
    capacity = room_capacity,
    capacity_label = room_capacity_label
  WHERE id = room_id_param;
  
  RETURN room_id_param;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_room_with_configurations(
  room_name TEXT,
  room_group_type room_group,
  room_capacity_configurations JSONB,
  room_capacity INTEGER DEFAULT NULL,
  room_capacity_label TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_room_id UUID;
BEGIN
  INSERT INTO public.rooms (
    name,
    group_type,
    capacity_configurations,
    capacity,
    capacity_label
  ) VALUES (
    room_name,
    room_group_type,
    room_capacity_configurations,
    room_capacity,
    room_capacity_label
  )
  RETURNING id INTO new_room_id;
  
  RETURN new_room_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_room_with_configurations(UUID, TEXT, room_group, JSONB, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_room_with_configurations(TEXT, room_group, JSONB, INTEGER, TEXT) TO authenticated;
*/

