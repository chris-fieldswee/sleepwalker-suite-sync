-- Fix handle_new_user trigger to prevent duplicates
-- This ensures the trigger won't create duplicate entries even if it fires multiple times
-- or if the application code already created the user entry

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user already exists to prevent duplicates
  -- This handles cases where:
  -- 1. The trigger fires multiple times
  -- 2. The application code already created the user entry
  -- 3. There's a race condition between trigger and application code
  
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE auth_id = NEW.id) THEN
    -- User doesn't exist, create it
    INSERT INTO public.users (auth_id, name, first_name, last_name, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name',
      'housekeeping'::user_role
    );
  ELSE
    -- User already exists, update only if needed (preserve existing data)
    UPDATE public.users
    SET
      name = COALESCE(NULLIF(COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), ''), name),
      first_name = COALESCE(NULLIF(NEW.raw_user_meta_data->>'first_name', ''), first_name),
      last_name = COALESCE(NULLIF(NEW.raw_user_meta_data->>'last_name', ''), last_name)
      -- Don't update role - preserve what was set by application code
    WHERE auth_id = NEW.id;
  END IF;
  
  -- Insert role into user_roles table (with conflict handling)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'housekeeping'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$function$;

-- Verify the trigger exists and is attached
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
    RAISE NOTICE 'Trigger on_auth_user_created created';
  ELSE
    RAISE NOTICE 'Trigger on_auth_user_created already exists';
  END IF;
END $$;

