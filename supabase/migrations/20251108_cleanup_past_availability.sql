-- Migration: Cleanup past availability records
-- This migration ensures that only current and future availability records are kept in the database

-- Function to clean up past availability records
CREATE OR REPLACE FUNCTION cleanup_past_availability()
RETURNS void AS $$
BEGIN
  -- Delete all availability records with dates before today
  DELETE FROM public.staff_availability
  WHERE date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to prevent inserting past dates (check constraint)
CREATE OR REPLACE FUNCTION check_availability_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent inserting or updating with past dates
  IF NEW.date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot add availability for past dates. Only current and future dates are allowed.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent past dates on insert/update
DROP TRIGGER IF EXISTS prevent_past_availability_date ON public.staff_availability;
CREATE TRIGGER prevent_past_availability_date
  BEFORE INSERT OR UPDATE ON public.staff_availability
  FOR EACH ROW
  EXECUTE FUNCTION check_availability_date();

-- Clean up existing past records
SELECT cleanup_past_availability();

-- Grant execute permission on cleanup function to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_past_availability() TO authenticated;

-- Add comment
COMMENT ON FUNCTION cleanup_past_availability() IS 'Deletes all staff availability records with dates before today';
COMMENT ON FUNCTION check_availability_date() IS 'Prevents inserting or updating availability records with past dates';


