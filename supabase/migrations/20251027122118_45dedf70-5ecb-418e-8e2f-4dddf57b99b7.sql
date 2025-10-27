-- Create issue_status enum
CREATE TYPE issue_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- Create issue_priority enum
CREATE TYPE issue_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create issues table
CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  reported_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status issue_status NOT NULL DEFAULT 'open',
  priority issue_priority NOT NULL DEFAULT 'medium',
  photo_url TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_issues_room_id ON public.issues(room_id);
CREATE INDEX idx_issues_task_id ON public.issues(task_id);
CREATE INDEX idx_issues_status ON public.issues(status);
CREATE INDEX idx_issues_reported_at ON public.issues(reported_at);
CREATE INDEX idx_issues_assigned_to ON public.issues(assigned_to_user_id);

-- Enable RLS
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view issues"
  ON public.issues
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Reception and admin can create issues"
  ON public.issues
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'reception'::app_role)
  );

CREATE POLICY "Users can update relevant issues"
  ON public.issues
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'reception'::app_role) OR
    assigned_to_user_id IN (
      SELECT id FROM public.users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Admin and reception can delete issues"
  ON public.issues
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'reception'::app_role)
  );

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_issues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at trigger
CREATE TRIGGER issues_updated_at_trigger
  BEFORE UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION update_issues_updated_at();

-- Trigger function for resolution data
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

-- Create resolution trigger
CREATE TRIGGER issue_resolution_trigger
  BEFORE UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION set_issue_resolution_data();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.issues;