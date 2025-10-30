# Run Live Database Migrations

To fix the room creation 403 error on your live site, you need to run this complete migration in your Supabase project.

## Quick Fix: Run the Complete Migration

1. **Go to your Supabase project**: https://supabase.com/dashboard
2. **Navigate to SQL Editor**: Project → SQL Editor (in the left sidebar)
3. **Copy and paste the complete fix below**, then click "Run"

### Complete Fix (Copy this entire block)
```sql
-- Complete fix for rooms 403 error
-- This ensures all necessary components are in place

-- Step 1: Ensure app_role enum exists
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'reception', 'housekeeping');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Ensure user_roles table exists
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Step 3: Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop and recreate user_roles SELECT policy (allow users to see their own roles)
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Step 5: Create or recreate has_role function as SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT exists(
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 6: Ensure current admin user has role in user_roles table
DO $$
DECLARE
  current_admin_id uuid;
BEGIN
  SELECT auth_id INTO current_admin_id 
  FROM public.users 
  WHERE auth_id = auth.uid() AND role = 'admin'
  LIMIT 1;
  
  IF current_admin_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (current_admin_id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- Step 7: Ensure RLS is enabled on rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Step 8: Drop and recreate rooms manage policy
DROP POLICY IF EXISTS "Reception and admin can manage rooms" ON public.rooms;
DROP POLICY IF EXISTS "Authenticated users can view rooms" ON public.rooms;

CREATE POLICY "Authenticated users can view rooms"
ON public.rooms FOR SELECT
USING (auth.uid() IS NOT NULL);

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
```

## First: Run Diagnostics (Optional but Recommended)

Before running the fix, you can diagnose the issue by running this in the SQL Editor:

```sql
-- See file: DIAGNOSE_ROOMS_ISSUE.sql for full diagnostic queries
SELECT * FROM public.user_roles WHERE user_id = auth.uid();
SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rooms';
```

This will tell you:
- If your admin user has a role in `user_roles` table
- What RLS policies exist on the rooms table

## Option 2: Using Supabase CLI (if you have it installed)

```bash
# Make sure you're in the project directory
cd /Users/krzysztofpolasik/Documents/sleepwalker/sleepwalker-suite-sync

# Link to your remote Supabase project (one-time setup)
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

## Verify the Fix

After running the migrations:

1. **Hard refresh** your live site (Cmd+Shift+R or Ctrl+Shift+R)
2. **Try creating a room** again
3. It should work now! ✨

## Troubleshooting

If you still get 403 errors after running the complete fix:

### Step 1: Run the diagnostic queries
Open `DIAGNOSE_ROOMS_ISSUE.sql` in your SQL Editor and run all queries to see what's missing.

### Step 2: Check your auth_id
```sql
SELECT auth_id, name, role FROM public.users WHERE role = 'admin';
```

### Step 3: Manually insert your admin role (if missing)
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('YOUR_AUTH_ID_FROM_STEP_2', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;
```

### Step 4: Test the has_role function
```sql
SELECT public.has_role(auth.uid(), 'admin'::app_role);
```
This should return `true`.

### Step 5: Verify policies
```sql
SELECT * FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'rooms';
```

You should see two policies:
- "Authenticated users can view rooms" (for SELECT)
- "Reception and admin can manage rooms" (for ALL operations)

## Next Steps After Fixing

Once the migration runs successfully:
1. **Hard refresh** your live site (Cmd+Shift+R or Ctrl+Shift+R)  
2. **Clear browser cache** if needed
3. **Try creating a room** - it should work! 🎉

