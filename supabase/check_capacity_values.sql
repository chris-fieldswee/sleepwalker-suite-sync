-- Query to check current capacity values in the rooms table
-- This will show you what capacity values are currently stored in the database
-- This query handles the case where capacity_configurations column might not exist yet

-- First, check if capacity_configurations column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'rooms' 
    AND column_name = 'capacity_configurations'
  ) THEN
    RAISE NOTICE 'Column capacity_configurations does not exist yet. Run the migration: supabase/migrations/20250104_room_capacity_configurations_safe.sql';
  END IF;
END $$;

-- Show all capacity values with counts
SELECT 
  capacity,
  COUNT(*) as room_count,
  array_agg(name ORDER BY name) as room_names
FROM public.rooms
GROUP BY capacity
ORDER BY capacity;

-- Show detailed view of all rooms with capacity
-- This query works whether or not capacity_configurations exists
SELECT 
  id,
  name,
  group_type,
  capacity,
  capacity_label,
  cleaning_types,
  created_at
FROM public.rooms
ORDER BY name;

-- Show detailed view with capacity_configurations (only if column exists)
SELECT 
  id,
  name,
  group_type,
  capacity,
  capacity_label,
  cleaning_types,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'rooms' 
      AND column_name = 'capacity_configurations'
    ) THEN (
      SELECT capacity_configurations::text 
      FROM public.rooms r2 
      WHERE r2.id = r.id
    )
    ELSE 'Column does not exist'::text
  END as capacity_configurations,
  created_at
FROM public.rooms r
ORDER BY name;

-- Show summary statistics
SELECT 
  'Total Rooms' as metric,
  COUNT(*)::text as value
FROM public.rooms
UNION ALL
SELECT 
  'Unique Capacity Values' as metric,
  COUNT(DISTINCT capacity)::text as value
FROM public.rooms
UNION ALL
SELECT 
  'Rooms with capacity_label' as metric,
  COUNT(*)::text as value
FROM public.rooms
WHERE capacity_label IS NOT NULL
UNION ALL
SELECT 
  'Rooms without capacity_label' as metric,
  COUNT(*)::text as value
FROM public.rooms
WHERE capacity_label IS NULL;

-- If capacity_configurations column exists, show additional stats
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'rooms' 
    AND column_name = 'capacity_configurations'
  ) THEN
    RAISE NOTICE 'Capacity configurations column exists. Showing additional statistics...';
  END IF;
END $$;

