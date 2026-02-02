-- Fix Duplicate Users in public.users table
-- This script finds and removes duplicate entries for the same auth_id

-- Step 1: Check for duplicates
SELECT 
  'DUPLICATE CHECK' as check_type,
  auth_id,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as user_ids,
  STRING_AGG(name, ', ') as names,
  STRING_AGG(role::text, ', ') as roles
FROM public.users
WHERE auth_id IS NOT NULL
GROUP BY auth_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 2: For each duplicate auth_id, keep the most recent entry and delete others
-- This keeps the user with the latest created_at timestamp
WITH duplicates AS (
  SELECT 
    id,
    auth_id,
    ROW_NUMBER() OVER (PARTITION BY auth_id ORDER BY created_at DESC, id DESC) as rn
  FROM public.users
  WHERE auth_id IS NOT NULL
)
DELETE FROM public.users
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 3: Verify no duplicates remain
SELECT 
  'VERIFICATION - Should show 0 rows if no duplicates' as check_type,
  auth_id,
  COUNT(*) as count
FROM public.users
WHERE auth_id IS NOT NULL
GROUP BY auth_id
HAVING COUNT(*) > 1;

-- Step 4: Add unique constraint on auth_id to prevent future duplicates
-- This will fail if duplicates still exist, so run Step 2 first
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_auth_id_unique' 
    AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users 
    ADD CONSTRAINT users_auth_id_unique UNIQUE (auth_id);
    RAISE NOTICE 'Unique constraint added to auth_id';
  ELSE
    RAISE NOTICE 'Unique constraint already exists on auth_id';
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Error adding constraint: %', SQLERRM;
    RAISE NOTICE 'Make sure all duplicates are removed first';
END $$;

-- Step 5: Final check - show all users with their auth_ids
SELECT 
  'FINAL CHECK - All users' as check_type,
  id,
  auth_id,
  name,
  role,
  active,
  created_at
FROM public.users
WHERE auth_id IS NOT NULL
ORDER BY created_at DESC;


