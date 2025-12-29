-- Add unique constraint on auth_id to prevent duplicate users
-- This migration should be run after fixing any existing duplicates

-- Step 1: Check for existing duplicates (informational only)
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT auth_id, COUNT(*) as cnt
    FROM public.users
    WHERE auth_id IS NOT NULL
    GROUP BY auth_id
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE WARNING 'Found % duplicate auth_ids. Please run fix_duplicate_users.sql first!', duplicate_count;
  END IF;
END $$;

-- Step 2: Add unique constraint on auth_id
-- This will fail if duplicates exist, so run fix_duplicate_users.sql first
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
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Cannot add unique constraint: duplicates exist. Please run fix_duplicate_users.sql first';
  WHEN others THEN
    RAISE EXCEPTION 'Error adding constraint: %', SQLERRM;
END $$;

