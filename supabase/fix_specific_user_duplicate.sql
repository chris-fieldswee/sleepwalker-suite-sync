-- Quick fix for specific user with auth_id: 36262746-28f7-484a-ac09-6f76ba8405db
-- Run this if you're getting the PGRST116 error for this specific user

-- Step 1: Check current state
SELECT 
  'CURRENT STATE' as check_type,
  id,
  auth_id,
  name,
  role,
  active,
  created_at
FROM public.users 
WHERE auth_id = '36262746-28f7-484a-ac09-6f76ba8405db'
ORDER BY created_at DESC;

-- Step 2: Check if there are duplicates
SELECT 
  'DUPLICATE CHECK' as check_type,
  auth_id,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as user_ids
FROM public.users
WHERE auth_id = '36262746-28f7-484a-ac09-6f76ba8405db'
GROUP BY auth_id;

-- Step 3: Remove duplicates (keeps the most recent entry)
-- This keeps the entry with the latest created_at timestamp
WITH user_entries AS (
  SELECT 
    id,
    auth_id,
    ROW_NUMBER() OVER (ORDER BY created_at DESC, id DESC) as rn
  FROM public.users
  WHERE auth_id = '36262746-28f7-484a-ac09-6f76ba8405db'
)
DELETE FROM public.users
WHERE id IN (
  SELECT id FROM user_entries WHERE rn > 1
);

-- Step 4: Verify only one entry remains
SELECT 
  'VERIFICATION' as check_type,
  COUNT(*) as remaining_count
FROM public.users 
WHERE auth_id = '36262746-28f7-484a-ac09-6f76ba8405db';
-- Should show: remaining_count = 1

-- Step 5: Show the final state
SELECT 
  'FINAL STATE' as check_type,
  id,
  auth_id,
  name,
  role,
  active,
  created_at
FROM public.users 
WHERE auth_id = '36262746-28f7-484a-ac09-6f76ba8405db';

-- Step 6: Verify the user can be found by auth_id (this is what the app queries)
SELECT 
  'APP QUERY TEST' as check_type,
  id,
  role,
  name,
  first_name,
  last_name,
  active
FROM public.users
WHERE auth_id = '36262746-28f7-484a-ac09-6f76ba8405db';
-- Should return exactly 1 row

