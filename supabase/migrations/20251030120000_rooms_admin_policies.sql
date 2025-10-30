-- Update rooms policies to work with has_role function
-- Safe re-creation: drop then create

-- Ensure RLS is enabled
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view rooms
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'Authenticated users can view rooms'
  ) THEN
    CREATE POLICY "Authenticated users can view rooms"
    ON public.rooms FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Drop existing rooms manage policy if present
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'Reception and admin can manage rooms'
  ) THEN
    DROP POLICY "Reception and admin can manage rooms" ON public.rooms;
  END IF;
END $$;

-- Create rooms manage policy (SELECT/INSERT/UPDATE/DELETE) using has_role function if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'has_role' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    -- Use has_role function
    CREATE POLICY "Reception and admin can manage rooms"
    ON public.rooms FOR ALL
    USING (
      public.has_role(auth.uid(), 'admin') OR 
      public.has_role(auth.uid(), 'reception')
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'admin') OR 
      public.has_role(auth.uid(), 'reception')
    );
  ELSE
    -- Fallback to direct user lookup
    CREATE POLICY "Reception and admin can manage rooms"
    ON public.rooms FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'reception')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'reception')
      )
    );
  END IF;
END $$;


