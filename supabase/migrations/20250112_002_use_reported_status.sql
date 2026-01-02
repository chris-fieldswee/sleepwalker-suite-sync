-- Step 2: Use the 'reported' status (after it's been committed in previous migration)
-- This migration sets the default status and updates the trigger function
-- Note: 'reported' is the database value, displayed as 'Zgłoszone' in Polish UI

-- Update the default status for the issues table
ALTER TABLE public.issues 
  ALTER COLUMN status SET DEFAULT 'reported';

-- Update the trigger function to handle 'reported' status
-- (reported should not trigger resolved_at/resolved_by)
CREATE OR REPLACE FUNCTION set_issue_resolution_data()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to resolved or closed and resolved_at is not set
  IF (NEW.status IN ('resolved', 'closed')) AND 
     (OLD.status NOT IN ('resolved', 'closed')) AND 
     (NEW.resolved_at IS NULL) THEN
    NEW.resolved_at = NOW();
    
    -- Set resolved_by_user_id if not already set
    IF NEW.resolved_by_user_id IS NULL THEN
      NEW.resolved_by_user_id = (
        SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

