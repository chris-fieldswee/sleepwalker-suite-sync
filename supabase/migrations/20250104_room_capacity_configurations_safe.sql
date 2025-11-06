-- Safe migration: Add capacity_configurations column
-- This migration handles the case where the rooms table might not exist yet

-- Create enum types first if they don't exist
DO $$ 
BEGIN
  CREATE TYPE public.room_group AS ENUM ('P1', 'P2', 'A1S', 'A2S', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- First, ensure rooms table exists (if running migrations out of order)
DO $$ 
BEGIN
  -- Create rooms table if it doesn't exist
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rooms') THEN
    -- Create the rooms table
    CREATE TABLE public.rooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      group_type room_group NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 2,
      capacity_label TEXT,
      cleaning_types JSONB DEFAULT '["W","P"]'::jsonb,
      color TEXT,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

-- Now add capacity_configurations column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'rooms' 
    AND column_name = 'capacity_configurations'
  ) THEN
    ALTER TABLE public.rooms 
    ADD COLUMN capacity_configurations JSONB DEFAULT '[]'::jsonb;
    
    COMMENT ON COLUMN public.rooms.capacity_configurations IS 'JSONB array of capacity configurations. Each configuration contains capacity, capacity_label, and cleaning_types with time limits.';
  END IF;
END $$;

