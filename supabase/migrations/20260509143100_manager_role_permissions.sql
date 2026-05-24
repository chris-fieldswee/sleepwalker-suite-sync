-- Manager is an operational admin role: admin shell access without Users or Rooms management.

DROP POLICY IF EXISTS "Users can view relevant tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update relevant tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin and reception can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin and reception can delete tasks" ON public.tasks;

CREATE POLICY "Users can view relevant tasks"
ON public.tasks FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'reception'::app_role) OR
  (public.has_role(auth.uid(), 'housekeeping'::app_role) AND user_id IN (
    SELECT id FROM public.users WHERE auth_id = auth.uid()
  ))
);

CREATE POLICY "Users can update relevant tasks"
ON public.tasks FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'reception'::app_role) OR
  (public.has_role(auth.uid(), 'housekeeping'::app_role) AND user_id IN (
    SELECT id FROM public.users WHERE auth_id = auth.uid()
  ))
);

CREATE POLICY "Admin and reception can insert tasks"
ON public.tasks FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'reception'::app_role)
);

CREATE POLICY "Admin and reception can delete tasks"
ON public.tasks FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'reception'::app_role)
);

DROP POLICY IF EXISTS "Users can view relevant work logs" ON public.work_logs;
DROP POLICY IF EXISTS "Reception and admin can manage work logs" ON public.work_logs;

CREATE POLICY "Users can view relevant work logs"
ON public.work_logs FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'reception'::app_role) OR
  (public.has_role(auth.uid(), 'housekeeping'::app_role) AND user_id IN (
    SELECT id FROM public.users WHERE auth_id = auth.uid()
  ))
);

CREATE POLICY "Reception and admin can manage work logs"
ON public.work_logs FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'reception'::app_role)
);

DROP POLICY IF EXISTS "Reception and admin can create issues" ON public.issues;
DROP POLICY IF EXISTS "Users can update relevant issues" ON public.issues;
DROP POLICY IF EXISTS "Admin and reception can delete issues" ON public.issues;

CREATE POLICY "Reception and admin can create issues"
ON public.issues FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'reception'::app_role)
);

CREATE POLICY "Users can update relevant issues"
ON public.issues FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'reception'::app_role) OR
  assigned_to_user_id IN (
    SELECT id FROM public.users WHERE auth_id = auth.uid()
  )
);

CREATE POLICY "Admin and reception can delete issues"
ON public.issues FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'reception'::app_role)
);

DROP POLICY IF EXISTS "Reception and admin can view all availability" ON public.staff_availability;
DROP POLICY IF EXISTS "Reception and admin can manage availability" ON public.staff_availability;

CREATE POLICY "Reception and admin can view all availability"
ON public.staff_availability FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role IN ('admin', 'manager', 'reception')
  )
);

CREATE POLICY "Reception and admin can manage availability"
ON public.staff_availability FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role IN ('admin', 'manager', 'reception')
  )
);

DROP POLICY IF EXISTS "Reception and admin can delete task photos" ON storage.objects;
DROP POLICY IF EXISTS "Reception and admin can delete issue photos" ON storage.objects;

CREATE POLICY "Reception and admin can delete task photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'task-photos' AND
  (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'reception'::app_role)
  )
);

CREATE POLICY "Reception and admin can delete issue photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'issue-photos' AND
  (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'manager'::app_role) OR
    public.has_role(auth.uid(), 'reception'::app_role)
  )
);

DO $$
DECLARE
  ewelina_auth_id uuid;
BEGIN
  SELECT auth_id
    INTO ewelina_auth_id
  FROM public.users
  WHERE lower(coalesce(first_name, '')) = 'ewelina'
    AND (
      lower(coalesce(last_name, '')) IN ('szczudlek', 'szczudłek')
      OR lower(coalesce(name, '')) IN ('ewelina szczudlek', 'ewelina szczudłek')
    )
  ORDER BY active DESC, created_at DESC
  LIMIT 1;

  IF ewelina_auth_id IS NOT NULL THEN
    UPDATE public.users
    SET role = 'manager'::user_role
    WHERE auth_id = ewelina_auth_id;

    DELETE FROM public.user_roles
    WHERE user_id = ewelina_auth_id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (ewelina_auth_id, 'manager'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
