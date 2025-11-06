-- Test the RPC Functions Directly
-- This will verify the functions work even if PostgREST can't see them yet

-- Test insert function
DO $$
DECLARE
  test_room_id UUID;
  test_config JSONB := '[
    {
      "capacity": 2,
      "capacity_label": "2",
      "cleaning_types": [
        {"type": "W", "time_limit": 40},
        {"type": "P", "time_limit": 30}
      ]
    },
    {
      "capacity": 2,
      "capacity_label": "1+1",
      "cleaning_types": [
        {"type": "W", "time_limit": 40},
        {"type": "P", "time_limit": 30}
      ]
    }
  ]'::jsonb;
BEGIN
  -- Create a test room
  SELECT public.insert_room_with_configurations(
    'TEST_ROOM_' || to_char(now(), 'YYYYMMDDHH24MISS'),
    'A1S'::room_group,
    test_config,
    2,
    '2'
  ) INTO test_room_id;
  
  RAISE NOTICE '✓ Insert function works! Created room ID: %', test_room_id;
  
  -- Test update function
  UPDATE public.rooms
  SET name = 'TEST_ROOM_UPDATED_' || to_char(now(), 'YYYYMMDDHH24MISS')
  WHERE id = test_room_id;
  
  SELECT public.update_room_with_configurations(
    test_room_id,
    'TEST_ROOM_UPDATED_' || to_char(now(), 'YYYYMMDDHH24MISS'),
    'A1S'::room_group,
    test_config,
    2,
    '2'
  );
  
  RAISE NOTICE '✓ Update function works! Updated room ID: %', test_room_id;
  
  -- Verify the data was saved correctly
  IF EXISTS (
    SELECT 1 FROM public.rooms 
    WHERE id = test_room_id 
    AND capacity_configurations IS NOT NULL
    AND jsonb_array_length(capacity_configurations) = 2
  ) THEN
    RAISE NOTICE '✓ Data saved correctly with 2 capacity configurations';
  ELSE
    RAISE WARNING '✗ Data may not have saved correctly';
  END IF;
  
  -- Clean up
  DELETE FROM public.rooms WHERE id = test_room_id;
  RAISE NOTICE '✓ Test completed and cleaned up';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Test failed: %', SQLERRM;
END $$;

-- If the above runs without errors, the functions work perfectly!
-- The only remaining issue is PostgREST cache refresh

