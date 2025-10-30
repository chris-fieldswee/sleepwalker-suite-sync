-- Safe RLS policies for public.users

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow a user to view their own profile
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = auth_id);
  END IF;
END $$;

-- Allow admins to view all users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Admins can view all users'
  ) THEN
    CREATE POLICY "Admins can view all users"
    ON public.users FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.role = 'admin'
    ));
  END IF;
END $$;

-- Allow admins to manage users (optional; comment out if using server-only)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Admins can manage users'
  ) THEN
    CREATE POLICY "Admins can manage users"
    ON public.users FOR ALL
    USING (EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.role = 'admin'
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.role = 'admin'
    ));
  END IF;
END $$;


