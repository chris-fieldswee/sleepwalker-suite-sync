-- "Ready to clean" marks a task whose room is free and can be cleaned right now.
-- Set by admin, manager and reception; housekeeping only reads it.
-- Flagged tasks sort to the top of the housekeeper's list.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS ready_to_clean boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ready_to_clean_at timestamptz;

-- RLS on tasks is row-level only: housekeeping can update its own rows, which would
-- otherwise let a housekeeper flag their own task. Guard the column with a trigger.
CREATE OR REPLACE FUNCTION public.enforce_ready_to_clean_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ready_to_clean IS DISTINCT FROM OLD.ready_to_clean THEN
    -- auth.uid() is NULL for the service role (admin client) and for server-side jobs;
    -- RLS already blocks anonymous callers, so only authenticated users are checked here.
    IF auth.uid() IS NOT NULL AND NOT (
      public.has_role(auth.uid(), 'admin'::app_role) OR
      public.has_role(auth.uid(), 'manager'::app_role) OR
      public.has_role(auth.uid(), 'reception'::app_role)
    ) THEN
      RAISE EXCEPTION 'Only admin, manager and reception can change ready_to_clean';
    END IF;

    NEW.ready_to_clean_at := CASE WHEN NEW.ready_to_clean THEN now() ELSE NULL END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_ready_to_clean_permissions ON public.tasks;

CREATE TRIGGER enforce_ready_to_clean_permissions
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_ready_to_clean_permissions();

-- Supports the "flagged tasks first" ordering on the housekeeper's list.
CREATE INDEX IF NOT EXISTS tasks_ready_to_clean_idx
  ON public.tasks (ready_to_clean)
  WHERE ready_to_clean;
