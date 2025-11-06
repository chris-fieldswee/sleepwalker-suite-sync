-- SQL Script to create RPC functions for room management
-- Run this in your Supabase SQL Editor to fix the 404 error
-- This bypasses PostgREST schema cache issues

-- Create a function to update rooms with capacity_configurations
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
DECLARE
  extracted_cleaning_types JSONB;
BEGIN
  -- Extract unique cleaning types from capacity_configurations
  -- Collect all cleaning type values from all capacity configurations
  SELECT COALESCE(
    jsonb_agg(DISTINCT cleaning_type_value ORDER BY cleaning_type_value),
    '[]'::jsonb
  ) INTO extracted_cleaning_types
  FROM (
    SELECT jsonb_array_elements(config->'cleaning_types')->>'type' AS cleaning_type_value
    FROM jsonb_array_elements(room_capacity_configurations) AS config
    WHERE config->'cleaning_types' IS NOT NULL
      AND jsonb_typeof(config->'cleaning_types') = 'array'
  ) AS extracted
  WHERE cleaning_type_value IS NOT NULL;
  
  -- If no cleaning types found in capacity_configurations, set to empty array
  IF extracted_cleaning_types IS NULL OR jsonb_array_length(extracted_cleaning_types) = 0 THEN
    extracted_cleaning_types := '[]'::jsonb;
  END IF;
  
  UPDATE public.rooms
  SET
    name = room_name,
    group_type = room_group_type,
    capacity_configurations = room_capacity_configurations,
    capacity = room_capacity,
    capacity_label = room_capacity_label,
    cleaning_types = extracted_cleaning_types
  WHERE id = room_id_param;
  
  RETURN room_id_param;
END;
$$;

-- Create a function to insert rooms with capacity_configurations
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
  extracted_cleaning_types JSONB;
BEGIN
  -- Extract unique cleaning types from capacity_configurations
  -- Collect all cleaning type values from all capacity configurations
  SELECT COALESCE(
    jsonb_agg(DISTINCT cleaning_type_value ORDER BY cleaning_type_value),
    '[]'::jsonb
  ) INTO extracted_cleaning_types
  FROM (
    SELECT jsonb_array_elements(config->'cleaning_types')->>'type' AS cleaning_type_value
    FROM jsonb_array_elements(room_capacity_configurations) AS config
    WHERE config->'cleaning_types' IS NOT NULL
      AND jsonb_typeof(config->'cleaning_types') = 'array'
  ) AS extracted
  WHERE cleaning_type_value IS NOT NULL;
  
  -- If no cleaning types found in capacity_configurations, set to empty array
  IF extracted_cleaning_types IS NULL OR jsonb_array_length(extracted_cleaning_types) = 0 THEN
    extracted_cleaning_types := '[]'::jsonb;
  END IF;
  
  INSERT INTO public.rooms (
    name,
    group_type,
    capacity_configurations,
    capacity,
    capacity_label,
    cleaning_types
  ) VALUES (
    room_name,
    room_group_type,
    room_capacity_configurations,
    room_capacity,
    room_capacity_label,
    extracted_cleaning_types
  )
  RETURNING id INTO new_room_id;
  
  RETURN new_room_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.update_room_with_configurations(UUID, TEXT, room_group, JSONB, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_room_with_configurations(TEXT, room_group, JSONB, INTEGER, TEXT) TO authenticated;

-- Verify functions were created (optional - will show an error if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'update_room_with_configurations' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE EXCEPTION 'Function update_room_with_configurations was not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'insert_room_with_configurations' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE EXCEPTION 'Function insert_room_with_configurations was not created';
  END IF;
  
  RAISE NOTICE 'Both functions created successfully!';
END $$;

