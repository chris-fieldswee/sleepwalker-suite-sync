-- Add display_order column to tasks for manual priority ordering on today's tab.
-- NULL means unordered; ordered tasks sort before unordered ones.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS display_order integer;
