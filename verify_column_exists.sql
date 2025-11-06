-- Verify that capacity_configurations column exists
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'rooms' 
  AND column_name = 'capacity_configurations';

