-- Check the current data type of guest_count columns
-- Run this to verify if migrations have been applied

-- Check tasks.guest_count
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'tasks' 
  AND column_name = 'guest_count';

-- Check limits.guest_count
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'limits' 
  AND column_name = 'guest_count';

-- Sample a few task records to see current values
SELECT id, guest_count, room_id, cleaning_type
FROM public.tasks
LIMIT 5;

