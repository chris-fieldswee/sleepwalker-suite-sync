-- Create staff availability table
CREATE TABLE IF NOT EXISTS public.staff_availability (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  total_hours decimal(4,1) NOT NULL DEFAULT 0,
  assigned_hours decimal(4,1) NOT NULL DEFAULT 0,
  available_hours decimal(4,1) GENERATED ALWAYS AS (total_hours - assigned_hours) STORED,
  position text,
  location text,
  start_time time,
  end_time time,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(staff_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_staff_availability_staff_id ON public.staff_availability(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_availability_date ON public.staff_availability(date);
CREATE INDEX IF NOT EXISTS idx_staff_availability_available_hours ON public.staff_availability(available_hours);

-- Enable RLS
ALTER TABLE public.staff_availability ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own availability"
ON public.staff_availability FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND id = staff_id
  )
);

CREATE POLICY "Reception and admin can view all availability"
ON public.staff_availability FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role IN ('reception', 'admin')
  )
);

CREATE POLICY "Reception and admin can manage availability"
ON public.staff_availability FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role IN ('reception', 'admin')
  )
);

-- Create function to update assigned hours when tasks are created/updated
CREATE OR REPLACE FUNCTION update_staff_assigned_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Update assigned hours for the staff member on the task date
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Only update if user_id is set (task is assigned)
    IF NEW.user_id IS NOT NULL THEN
      -- Add hours for new/updated task
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

-- Create trigger
CREATE TRIGGER staff_availability_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_assigned_hours();

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_staff_availability_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER staff_availability_updated_at_trigger
  BEFORE UPDATE ON public.staff_availability
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_availability_updated_at();

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_availability;
