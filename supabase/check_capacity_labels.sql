-- Query to see the relationship between numeric capacity values and their text labels
-- This shows how capacity (numeric) and capacity_label (text) are linked

-- Show capacity values with their corresponding labels
SELECT 
  capacity,
  capacity_label,
  COUNT(*) as room_count,
  array_agg(name ORDER BY name) as room_names,
  array_agg(DISTINCT group_type ORDER BY group_type) as group_types
FROM public.rooms
GROUP BY capacity, capacity_label
ORDER BY capacity, capacity_label;

-- Show all rooms with their capacity and label mapping
SELECT 
  name,
  group_type,
  capacity as numeric_capacity,
  capacity_label as text_label,
  CASE 
    WHEN capacity_label IS NULL THEN 'No label assigned'
    WHEN capacity_label = capacity::text THEN 'Label matches numeric value'
    ELSE 'Label differs from numeric value'
  END as label_status,
  cleaning_types,
  created_at
FROM public.rooms
ORDER BY capacity, capacity_label, name;

-- Summary: Show unique capacity-to-label mappings
SELECT 
  'Unique Capacity Values' as metric,
  COUNT(DISTINCT capacity)::text as count
FROM public.rooms
UNION ALL
SELECT 
  'Unique Capacity Labels' as metric,
  COUNT(DISTINCT capacity_label)::text as count
FROM public.rooms
WHERE capacity_label IS NOT NULL
UNION ALL
SELECT 
  'Rooms with matching capacity and label' as metric,
  COUNT(*)::text as count
FROM public.rooms
WHERE capacity_label IS NOT NULL 
  AND capacity_label = capacity::text
UNION ALL
SELECT 
  'Rooms with different capacity and label' as metric,
  COUNT(*)::text as count
FROM public.rooms
WHERE capacity_label IS NOT NULL 
  AND capacity_label != capacity::text
UNION ALL
SELECT 
  'Rooms without capacity_label' as metric,
  COUNT(*)::text as count
FROM public.rooms
WHERE capacity_label IS NULL;

-- Show examples of capacity label patterns
SELECT 
  capacity_label,
  COUNT(*) as usage_count,
  array_agg(DISTINCT capacity ORDER BY capacity) as numeric_capacities_used,
  array_agg(DISTINCT group_type ORDER BY group_type) as group_types_using_this_label
FROM public.rooms
WHERE capacity_label IS NOT NULL
GROUP BY capacity_label
ORDER BY usage_count DESC, capacity_label;

