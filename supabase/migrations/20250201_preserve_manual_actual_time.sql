-- Preserve manual admin overrides of actual_time when start_time/stop_time did not change.
-- When an admin manually sets actual_time via the UI, the trigger should not overwrite it.

CREATE OR REPLACE FUNCTION calculate_task_times()
RETURNS TRIGGER AS $$
BEGIN
  -- Only recalculate actual_time/difference when start_time or stop_time changed
  -- This preserves admin manual overrides of actual_time
  IF (TG_OP = 'UPDATE') AND
     (OLD.start_time IS NOT DISTINCT FROM NEW.start_time) AND
     (OLD.stop_time IS NOT DISTINCT FROM NEW.stop_time) THEN
    -- Preserve NEW.actual_time and NEW.difference as sent by client
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Recalculate when task is stopped (start_time or stop_time changed)
  IF NEW.stop_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    NEW.actual_time := EXTRACT(EPOCH FROM (NEW.stop_time - NEW.start_time))::INTEGER / 60 - COALESCE(NEW.total_pause, 0);
    IF NEW.time_limit IS NOT NULL THEN
      NEW.difference := NEW.actual_time - NEW.time_limit;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
