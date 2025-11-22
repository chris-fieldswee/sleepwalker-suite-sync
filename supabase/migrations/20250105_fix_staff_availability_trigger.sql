-- Fix the update_staff_assigned_hours trigger function
-- The trigger was referencing 'assigned_to_user_id' which doesn't exist in tasks table
-- Tasks table uses 'user_id' instead

CREATE OR REPLACE FUNCTION update_staff_assigned_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Update assigned hours for the staff member on the task date
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Only update if user_id is set (task is assigned)
    IF NEW.user_id IS NOT NULL THEN
      -- Update assigned hours for the staff member
      UPDATE public.staff_availability
      SET assigned_hours = (
        SELECT COALESCE(SUM(time_limit), 0) / 60.0
        FROM public.tasks
        WHERE user_id = NEW.user_id
          AND date = NEW.date
          AND status != 'done'
      )
      WHERE staff_id = NEW.user_id
        AND date = NEW.date;
    END IF;
  END IF;
  
  -- Subtract hours for deleted task
  IF TG_OP = 'DELETE' THEN
    -- Only update if user_id was set (task was assigned)
    IF OLD.user_id IS NOT NULL THEN
      UPDATE public.staff_availability
      SET assigned_hours = (
        SELECT COALESCE(SUM(time_limit), 0) / 60.0
        FROM public.tasks
        WHERE user_id = OLD.user_id
          AND date = OLD.date
          AND status != 'done'
      )
      WHERE staff_id = OLD.user_id
        AND date = OLD.date;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;





