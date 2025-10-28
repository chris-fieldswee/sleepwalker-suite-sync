-- Safe migration: Only create what doesn't exist
-- This migration checks for existence before creating anything

-- Create enum types only if they don't exist
DO $$ BEGIN
  CREATE TYPE public.issue_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.issue_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create issues table only if it doesn't exist
CREATE TABLE IF NOT EXISTS public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  reported_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status issue_status DEFAULT 'open',
  priority issue_priority DEFAULT 'medium',
  photo_url TEXT,
  reported_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes only if they don't exist
CREATE INDEX IF NOT EXISTS idx_issues_room_id ON public.issues(room_id);
CREATE INDEX IF NOT EXISTS idx_issues_task_id ON public.issues(task_id);
CREATE INDEX IF NOT EXISTS idx_issues_reported_by ON public.issues(reported_by_user_id);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON public.issues(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON public.issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON public.issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_reported_at ON public.issues(reported_at);

-- Enable RLS (safe to run multiple times)
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- Create policies only if they don't exist
DO $$ BEGIN
  CREATE POLICY "Users can view issues"
  ON public.issues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE auth_id = auth.uid() AND role IN ('admin', 'reception', 'housekeeping')
    )
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Reception and admin can insert issues"
  ON public.issues FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE auth_id = auth.uid() AND role IN ('admin', 'reception')
    )
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Reception and admin can update issues"
  ON public.issues FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE auth_id = auth.uid() AND role IN ('admin', 'reception')
    )
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Reception and admin can delete issues"
  ON public.issues FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE auth_id = auth.uid() AND role IN ('admin', 'reception')
    )
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create functions (will replace if they exist)
CREATE OR REPLACE FUNCTION public.update_issues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.set_issue_resolution_data()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to resolved and resolved_at is null, set it
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at = now();
    NEW.resolved_by_user_id = (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    );
  END IF;
  
  -- If status changed from resolved to something else, clear resolution data
  IF OLD.status = 'resolved' AND NEW.status != 'resolved' THEN
    NEW.resolved_at = NULL;
    NEW.resolved_by_user_id = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (will replace if they exist)
DROP TRIGGER IF EXISTS issues_updated_at_trigger ON public.issues;
CREATE TRIGGER issues_updated_at_trigger
  BEFORE UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_issues_updated_at();

DROP TRIGGER IF EXISTS issue_resolution_trigger ON public.issues;
CREATE TRIGGER issue_resolution_trigger
  BEFORE UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_issue_resolution_data();

-- Add to realtime publication (safe to run multiple times)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.issues;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
