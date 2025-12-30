-- Migration: Change guest_count from INTEGER to TEXT to store capacity identifiers (a, b, c, d, etc.)
-- This allows distinguishing between capacity patterns like "2" and "1+1" that previously shared the same numeric value

-- Step 1: Add a temporary column to store the new capacity_id values
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS guest_count_new TEXT;

-- Step 2: Add a temporary column to limits table as well (if still used)
ALTER TABLE public.limits 
ADD COLUMN IF NOT EXISTS guest_count_new TEXT;

-- Step 3: Migrate existing data (this will be done in a separate data migration)
-- For now, we'll convert numeric values to strings as a temporary measure
-- The actual conversion to letter identifiers will happen in the data migration script
UPDATE public.tasks 
SET guest_count_new = guest_count::TEXT 
WHERE guest_count_new IS NULL;

UPDATE public.limits 
SET guest_count_new = guest_count::TEXT 
WHERE guest_count_new IS NULL;

-- Step 4: Drop the old INTEGER columns
ALTER TABLE public.tasks 
DROP COLUMN IF EXISTS guest_count;

ALTER TABLE public.limits 
DROP COLUMN IF EXISTS guest_count;

-- Step 5: Rename the new columns to the original names
ALTER TABLE public.tasks 
RENAME COLUMN guest_count_new TO guest_count;

ALTER TABLE public.limits 
RENAME COLUMN guest_count_new TO guest_count;

-- Step 6: Update constraints and defaults
-- Remove NOT NULL constraint temporarily to allow migration
ALTER TABLE public.tasks 
ALTER COLUMN guest_count DROP NOT NULL;

-- Remove the old integer default and set new text default
ALTER TABLE public.tasks 
ALTER COLUMN guest_count DROP DEFAULT;

-- Set default to 'd' (capacity 2, most common) after data migration
-- This will be set in the data migration script
-- ALTER TABLE public.tasks ALTER COLUMN guest_count SET DEFAULT 'd';

-- Update limits table constraint
ALTER TABLE public.limits 
ALTER COLUMN guest_count DROP NOT NULL;

-- Remove default from limits table
ALTER TABLE public.limits 
ALTER COLUMN guest_count DROP DEFAULT;

-- Step 7: Re-add NOT NULL constraint after data migration completes
-- (This will be done in the data migration script after all values are converted)
-- ALTER TABLE public.tasks ALTER COLUMN guest_count SET NOT NULL;
-- ALTER TABLE public.limits ALTER COLUMN guest_count SET NOT NULL;

-- Add comment to document the change
COMMENT ON COLUMN public.tasks.guest_count IS 'Capacity identifier (a, b, c, d, e, f, g, h) corresponding to visual patterns: a=1, b=1+1, c=1+1+1, d=2, e=2+1, f=2+2, g=2+2+1, h=2+2+2';
COMMENT ON COLUMN public.limits.guest_count IS 'Capacity identifier (a, b, c, d, e, f, g, h) corresponding to visual patterns';

