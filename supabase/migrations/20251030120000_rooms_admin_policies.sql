-- Allow admins to manage rooms without needing service role
-- Safe re-creation: drop then create

-- Ensure RLS is enabled
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view rooms
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'Allow authenticated users to view rooms'
  ) THEN
    CREATE POLICY "Allow authenticated users to view rooms"
    ON public.rooms FOR SELECT
    USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Drop existing admin manage policy if present
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'Admins can manage rooms'
  ) THEN
    DROP POLICY "Admins can manage rooms" ON public.rooms;
  END IF;
END $$;

-- Create admin manage policy (SELECT/INSERT/UPDATE/DELETE)
CREATE POLICY "Admins can manage rooms"
ON public.rooms FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_id = auth.uid() AND u.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_id = auth.uid() AND u.role = 'admin'
  )
);


