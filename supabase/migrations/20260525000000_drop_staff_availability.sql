-- Remove staff availability: housekeepers are always available for task assignment
DROP TRIGGER IF EXISTS staff_availability_trigger ON public.tasks;
DROP FUNCTION IF EXISTS update_staff_assigned_hours();
DROP TABLE IF EXISTS public.staff_availability;
DROP FUNCTION IF EXISTS update_staff_availability_updated_at();
