-- Data Migration: Convert numeric capacity values to letter identifiers
-- This migration adds capacity_id to capacity_configurations and converts existing task guest_count values

-- Step 1: Add capacity_id to all capacity_configurations in rooms table
-- This function maps capacity_label to capacity_id based on the predefined mapping
DO $$
DECLARE
  room_record RECORD;
  config_item JSONB;
  updated_configs JSONB;
  capacity_label TEXT;
  capacity_id TEXT;
  i INTEGER;
BEGIN
  -- Iterate through all rooms with capacity_configurations
  FOR room_record IN 
    SELECT id, capacity_configurations 
    FROM public.rooms 
    WHERE capacity_configurations IS NOT NULL 
      AND jsonb_array_length(capacity_configurations) > 0
  LOOP
    updated_configs := '[]'::JSONB;
    
    -- Process each configuration in the array
    FOR i IN 0..jsonb_array_length(room_record.capacity_configurations) - 1 LOOP
      config_item := room_record.capacity_configurations->i;
      
      -- Extract capacity_label
      capacity_label := config_item->>'capacity_label';
      
      -- If capacity_label is null, try to derive from capacity field
      IF capacity_label IS NULL THEN
        capacity_label := (config_item->>'capacity');
      END IF;
      
      -- Normalize the label (remove extra spaces around +)
      IF capacity_label IS NOT NULL THEN
        capacity_label := TRIM(REPLACE(capacity_label, ' ', ''));
      END IF;
      
      -- Map label to capacity_id
      capacity_id := CASE capacity_label
        WHEN '1' THEN 'a'
        WHEN '1+1' THEN 'b'
        WHEN '1+1+1' THEN 'c'
        WHEN '2' THEN 'd'
        WHEN '2+1' THEN 'e'
        WHEN '2+2' THEN 'f'
        WHEN '2+2+1' THEN 'g'
        WHEN '2+2+2' THEN 'h'
        ELSE NULL
      END;
      
      -- If we couldn't map it, try to infer from numeric capacity value
      IF capacity_id IS NULL AND config_item->>'capacity' IS NOT NULL THEN
        CASE (config_item->>'capacity')::INTEGER
          WHEN 1 THEN capacity_id := 'a';
          WHEN 2 THEN 
            -- For capacity 2, default to 'd' (2) if we can't determine
            capacity_id := 'd';
          WHEN 3 THEN 
            -- For capacity 3, could be 'c' (1+1+1) or 'e' (2+1), default to 'c'
            capacity_id := 'c';
          WHEN 4 THEN capacity_id := 'f'; -- 2+2
          WHEN 5 THEN capacity_id := 'g'; -- 2+2+1
          WHEN 6 THEN capacity_id := 'h'; -- 2+2+2
          ELSE NULL
        END CASE;
      END IF;
      
      -- If still no capacity_id, skip this config (log warning)
      IF capacity_id IS NOT NULL THEN
        -- Add capacity_id to the configuration
        config_item := config_item || jsonb_build_object('capacity_id', capacity_id);
        -- Keep the old capacity field for backward compatibility
        updated_configs := updated_configs || jsonb_build_array(config_item);
      END IF;
    END LOOP;
    
    -- Update the room with new configurations
    UPDATE public.rooms 
    SET capacity_configurations = updated_configs
    WHERE id = room_record.id;
  END LOOP;
END $$;

-- Step 2: Migrate tasks.guest_count from numeric to capacity_id
-- For each task, find the matching capacity configuration from its room
DO $$
DECLARE
  task_record RECORD;
  room_configs JSONB;
  config_item JSONB;
  capacity_id TEXT;
  numeric_guest_count INTEGER;
  i INTEGER;
  found_match BOOLEAN;
BEGIN
  FOR task_record IN 
    SELECT t.id, t.room_id, t.guest_count, t.cleaning_type, r.capacity_configurations
    FROM public.tasks t
    LEFT JOIN public.rooms r ON t.room_id = r.id
    WHERE t.guest_count IS NOT NULL
      AND t.guest_count ~ '^[0-9]+$' -- Only process if it's still numeric (string representation)
  LOOP
    found_match := FALSE;
    capacity_id := NULL;
    
    -- Try to parse guest_count as integer
    BEGIN
      numeric_guest_count := (task_record.guest_count)::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      numeric_guest_count := NULL;
    END;
    
    -- If room has capacity_configurations, try to find matching config
    IF task_record.capacity_configurations IS NOT NULL 
       AND jsonb_array_length(task_record.capacity_configurations) > 0 THEN
      
      -- Look for matching configuration by numeric capacity
      FOR i IN 0..jsonb_array_length(task_record.capacity_configurations) - 1 LOOP
        config_item := task_record.capacity_configurations->i;
        
        -- Check if numeric capacity matches
        IF (config_item->>'capacity')::INTEGER = numeric_guest_count THEN
          -- Found a match, use its capacity_id
          capacity_id := config_item->>'capacity_id';
          IF capacity_id IS NOT NULL THEN
            found_match := TRUE;
            EXIT;
          END IF;
        END IF;
      END LOOP;
    END IF;
    
    -- If no match found, use fallback mapping based on numeric value
    IF NOT found_match AND numeric_guest_count IS NOT NULL THEN
      capacity_id := CASE numeric_guest_count
        WHEN 1 THEN 'a'
        WHEN 2 THEN 'd' -- Default to 'd' (2) for capacity 2
        WHEN 3 THEN 'c' -- Default to 'c' (1+1+1) for capacity 3
        WHEN 4 THEN 'f' -- 2+2
        WHEN 5 THEN 'g' -- 2+2+1
        WHEN 6 THEN 'h' -- 2+2+2
        ELSE NULL
      END;
    END IF;
    
    -- Update the task with capacity_id
    IF capacity_id IS NOT NULL THEN
      UPDATE public.tasks 
      SET guest_count = capacity_id
      WHERE id = task_record.id;
    ELSE
      -- Log warning for unmapped values (could use RAISE WARNING in production)
      RAISE WARNING 'Could not map guest_count % for task %', task_record.guest_count, task_record.id;
    END IF;
  END LOOP;
END $$;

-- Step 3: Migrate limits.guest_count (if still used)
-- Convert numeric guest_count to capacity_id in limits table
DO $$
DECLARE
  limit_record RECORD;
  capacity_id TEXT;
  numeric_guest_count INTEGER;
BEGIN
  FOR limit_record IN 
    SELECT id, guest_count
    FROM public.limits
    WHERE guest_count IS NOT NULL
      AND guest_count ~ '^[0-9]+$' -- Only process if it's still numeric
  LOOP
    -- Try to parse as integer
    BEGIN
      numeric_guest_count := (limit_record.guest_count)::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      numeric_guest_count := NULL;
    END;
    
    -- Map to capacity_id
    IF numeric_guest_count IS NOT NULL THEN
      capacity_id := CASE numeric_guest_count
        WHEN 1 THEN 'a'
        WHEN 2 THEN 'd' -- Default to 'd' (2) for capacity 2
        WHEN 3 THEN 'c' -- Default to 'c' (1+1+1) for capacity 3
        WHEN 4 THEN 'f'
        WHEN 5 THEN 'g'
        WHEN 6 THEN 'h'
        ELSE NULL
      END;
      
      IF capacity_id IS NOT NULL THEN
        UPDATE public.limits 
        SET guest_count = capacity_id
        WHERE id = limit_record.id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Step 4: Re-add NOT NULL constraint after migration
ALTER TABLE public.tasks 
ALTER COLUMN guest_count SET NOT NULL;

-- Set a default value (will be 'd' for capacity 2, which is most common)
ALTER TABLE public.tasks 
ALTER COLUMN guest_count SET DEFAULT 'd';

-- For limits table, keep it nullable since it might not always be set
-- ALTER TABLE public.limits ALTER COLUMN guest_count SET NOT NULL;

