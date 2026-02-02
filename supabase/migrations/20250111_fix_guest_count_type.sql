-- Migration: Ensure guest_count is TEXT type to store capacity identifiers (a, b, c, d, etc.)
-- This migration is idempotent and safe to run multiple times

-- Check and fix tasks.guest_count column type
DO $$
BEGIN
    -- Check if column exists and is INTEGER type
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tasks' 
        AND column_name = 'guest_count'
        AND data_type = 'integer'
    ) THEN
        -- Add temporary column
        ALTER TABLE public.tasks 
        ADD COLUMN IF NOT EXISTS guest_count_new TEXT;
        
        -- Migrate existing data (convert integers to strings, then map to capacity IDs)
        -- For now, convert to string representation
        UPDATE public.tasks 
        SET guest_count_new = guest_count::TEXT 
        WHERE guest_count_new IS NULL;
        
        -- Drop old column
        ALTER TABLE public.tasks 
        DROP COLUMN IF EXISTS guest_count;
        
        -- Rename new column
        ALTER TABLE public.tasks 
        RENAME COLUMN guest_count_new TO guest_count;
        
        -- Update constraints
        ALTER TABLE public.tasks 
        ALTER COLUMN guest_count DROP NOT NULL;
        
        ALTER TABLE public.tasks 
        ALTER COLUMN guest_count DROP DEFAULT;
        
        RAISE NOTICE 'Converted tasks.guest_count from INTEGER to TEXT';
    ELSIF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tasks' 
        AND column_name = 'guest_count'
        AND data_type = 'text'
    ) THEN
        RAISE NOTICE 'tasks.guest_count is already TEXT type, no changes needed';
    ELSE
        RAISE WARNING 'tasks.guest_count column not found';
    END IF;
END $$;

-- Check and fix limits.guest_count column type
DO $$
BEGIN
    -- Check if column exists and is INTEGER type
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'limits' 
        AND column_name = 'guest_count'
        AND data_type = 'integer'
    ) THEN
        -- Add temporary column
        ALTER TABLE public.limits 
        ADD COLUMN IF NOT EXISTS guest_count_new TEXT;
        
        -- Migrate existing data
        UPDATE public.limits 
        SET guest_count_new = guest_count::TEXT 
        WHERE guest_count_new IS NULL;
        
        -- Drop old column
        ALTER TABLE public.limits 
        DROP COLUMN IF EXISTS guest_count;
        
        -- Rename new column
        ALTER TABLE public.limits 
        RENAME COLUMN guest_count_new TO guest_count;
        
        -- Update constraints
        ALTER TABLE public.limits 
        ALTER COLUMN guest_count DROP NOT NULL;
        
        ALTER TABLE public.limits 
        ALTER COLUMN guest_count DROP DEFAULT;
        
        RAISE NOTICE 'Converted limits.guest_count from INTEGER to TEXT';
    ELSIF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'limits' 
        AND column_name = 'guest_count'
        AND data_type = 'text'
    ) THEN
        RAISE NOTICE 'limits.guest_count is already TEXT type, no changes needed';
    ELSE
        RAISE WARNING 'limits.guest_count column not found';
    END IF;
END $$;

-- Add comments to document the change
COMMENT ON COLUMN public.tasks.guest_count IS 'Capacity identifier (a, b, c, d, e, f, g, h) corresponding to visual patterns: a=1, b=1+1, c=1+1+1, d=2, e=2+1, f=2+2, g=2+2+1, h=2+2+2';
COMMENT ON COLUMN public.limits.guest_count IS 'Capacity identifier (a, b, c, d, e, f, g, h) corresponding to visual patterns';


