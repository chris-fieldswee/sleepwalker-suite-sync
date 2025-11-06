-- Create a function to update rooms with capacity_configurations
-- This bypasses PostgREST schema cache issues

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

-- Grant execute permissions (with full function signatures)
GRANT EXECUTE ON FUNCTION public.update_room_with_configurations(UUID, TEXT, room_group, JSONB, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_room_with_configurations(TEXT, room_group, JSONB, INTEGER, TEXT) TO authenticated;

-- Also grant to anon for public access if needed (adjust based on your security requirements)
-- GRANT EXECUTE ON FUNCTION public.update_room_with_configurations(UUID, TEXT, room_group, JSONB, INTEGER, TEXT) TO anon;
-- GRANT EXECUTE ON FUNCTION public.insert_room_with_configurations(TEXT, room_group, JSONB, INTEGER, TEXT) TO anon;

