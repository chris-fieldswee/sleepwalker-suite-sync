-- Simple query to check current capacity values in the rooms table
-- This works even if capacity_configurations column doesn't exist yet

-- Show all capacity values with counts
SELECT 
  capacity,
  COUNT(*) as room_count,
  array_agg(name ORDER BY name) as room_names
FROM public.rooms
GROUP BY capacity
ORDER BY capacity;

-- Show detailed view of all rooms
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

