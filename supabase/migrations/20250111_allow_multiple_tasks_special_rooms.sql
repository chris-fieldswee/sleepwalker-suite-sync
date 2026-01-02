-- Allow multiple tasks for specific rooms: pralnia, śniadania, and przerwa śniadaniowa
-- Update the trigger function to exclude these rooms from duplicate task prevention

CREATE OR REPLACE FUNCTION public.prevent_duplicate_open_room_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  conflicting_task_id UUID;
  room_name TEXT;
  normalized_room_name TEXT;
BEGIN
  -- Skip validation when either date or room is missing
  IF NEW.date IS NULL OR NEW.room_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Default missing status to 'todo' to treat it as open
  IF NEW.status IS NULL THEN
    NEW.status := 'todo';
  END IF;

  -- Only enforce when the resulting status is an open one
  IF NEW.status <> 'done' THEN
    -- Get the room name to check if it's one of the special rooms
    SELECT r.name INTO room_name
    FROM public.rooms r
    WHERE r.id = NEW.room_id;

    -- Allow multiple tasks for these specific rooms
    -- Check if room name contains or matches any of the special room keywords
    -- This handles "Pralnia + Magazyn", "pralnia", etc.
    IF room_name IS NOT NULL THEN
      normalized_room_name := LOWER(TRIM(room_name));
      
      -- Check if room name contains "pralnia" (matches "Pralnia + Magazyn", "pralnia", etc.)
      -- or exactly matches "śniadania" or contains "przerwa śniadaniowa"
      IF POSITION('pralnia' IN normalized_room_name) > 0 OR
         normalized_room_name = 'śniadania' OR
         POSITION('przerwa śniadaniowa' IN normalized_room_name) > 0 OR
         POSITION('przerwa sniadaniowa' IN normalized_room_name) > 0 THEN
        -- Skip duplicate check for these rooms
        RETURN NEW;
      END IF;
    END IF;

    -- For all other rooms, check for duplicates
    SELECT t.id
      INTO conflicting_task_id
    FROM public.tasks t
    WHERE t.date = NEW.date
      AND t.room_id = NEW.room_id
      AND t.status <> 'done'
      AND (TG_OP = 'INSERT' OR t.id <> NEW.id)
    LIMIT 1;

    IF conflicting_task_id IS NOT NULL THEN
      RAISE EXCEPTION
        USING MESSAGE = 'An open task already exists for this room on this date. Close it before creating another.',
              ERRCODE = '23505',
              DETAIL = format('room_id=%s date=%s existing_task_id=%s', NEW.room_id, NEW.date, conflicting_task_id),
              HINT = 'Mark the existing task as done before creating a new one.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

