-- Create issues status enum
CREATE TYPE public.issue_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE public.issue_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create issues table
CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL, -- Optional link to specific task
  reported_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status issue_status DEFAULT 'open',
  priority issue_priority DEFAULT 'medium',
  photo_url TEXT, -- Store issue photo URL
  reported_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT, -- Additional notes from staff
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_issues_room_id ON public.issues(room_id);
CREATE INDEX idx_issues_task_id ON public.issues(task_id);
CREATE INDEX idx_issues_status ON public.issues(status);
CREATE INDEX idx_issues_reported_at ON public.issues(reported_at);
CREATE INDEX idx_issues_assigned_to ON public.issues(assigned_to_user_id);

-- Enable Row Level Security
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- RLS Policies for issues table

-- Authenticated users can view issues
CREATE POLICY "Authenticated users can view issues"
ON public.issues FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Reception and admin can insert issues
CREATE POLICY "Reception and admin can create issues"
ON public.issues FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'reception')
);

-- Users can update issues (reception, admin, or assigned housekeeping staff)
CREATE POLICY "Users can update relevant issues"
ON public.issues FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'reception') OR
  assigned_to_user_id IN (
    SELECT id FROM public.users WHERE auth_id = auth.uid()
  )
);

-- Only admin and reception can delete issues
CREATE POLICY "Admin and reception can delete issues"
ON public.issues FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'reception')
);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_issues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER issues_updated_at_trigger
BEFORE UPDATE ON public.issues
FOR EACH ROW
EXECUTE FUNCTION update_issues_updated_at();

-- Create trigger to automatically set resolved_at when status changes to resolved/closed
CREATE OR REPLACE FUNCTION handle_issue_resolution()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to resolved or closed, set resolved_at if not already set
  IF NEW.status IN ('resolved', 'closed') AND OLD.status NOT IN ('resolved', 'closed') THEN
    IF NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    END IF;
    -- Store who resolved it
    IF NEW.resolved_by_user_id IS NULL THEN
      NEW.resolved_by_user_id := (
        SELECT id FROM public.users WHERE auth_id = auth.uid()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER issue_resolution_trigger
BEFORE UPDATE ON public.issues
FOR EACH ROW
EXECUTE FUNCTION handle_issue_resolution();

-- Enable realtime for issues table
ALTER PUBLICATION supabase_realtime ADD TABLE public.issues;

-- Migration: Copy existing issue data from tasks to issues table
INSERT INTO public.issues (
  room_id,
  task_id,
  reported_by_user_id,
  title,
  description,
  photo_url,
  status,
  priority,
  reported_at,
  created_at
)
SELECT 
  t.room_id,
  t.id as task_id,
  NULL as reported_by_user_id, -- We don't have this data in old structure
  CASE 
    WHEN t.issue_description IS NOT NULL THEN LEFT(t.issue_description, 100)
    ELSE 'Issue reported on task'
  END as title,
  COALESCE(t.issue_description, 'Issue reported during task completion') as description,
  t.issue_photo,
  CASE 
    WHEN t.status = 'repair_needed' THEN 'open'::issue_status
    ELSE 'resolved'::issue_status
  END as status,
  'medium'::issue_priority as priority,
  t.created_at as reported_at,
  t.created_at
FROM public.tasks t
WHERE t.issue_flag = true
  AND t.issue_description IS NOT NULL;

-- Add issue_id column to tasks for backward compatibility (optional)
-- This allows linking new issues back to tasks if needed
ALTER TABLE public.tasks
ADD COLUMN issue_id UUID REFERENCES public.issues(id) ON DELETE SET NULL;

-- Create index for issue_id in tasks
CREATE INDEX idx_tasks_issue_id ON public.tasks(issue_id);

-- Note: We're keeping issue_flag, issue_description, and issue_photo in tasks table
-- for backward compatibility during the transition period
-- These can be removed in a future migration once fully migrated

COMMENT ON TABLE public.issues IS 'Separate issues management table for tracking room and task-related issues';
COMMENT ON COLUMN public.issues.task_id IS 'Optional link to the specific task where the issue was reported';
COMMENT ON COLUMN public.issues.room_id IS 'The room where the issue exists (required)';
COMMENT ON COLUMN public.issues.status IS 'Issue status: open, in_progress, resolved, or closed';
COMMENT ON COLUMN public.issues.priority IS 'Issue priority: low, medium, high, or urgent';

