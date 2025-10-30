# Run Live Database Migrations

To fix the room creation 403 error on your live site, you need to run these two migrations in your Supabase project.

## Option 1: Using Supabase Dashboard (Recommended)

1. **Go to your Supabase project**: https://supabase.com/dashboard
2. **Navigate to SQL Editor**: Project → SQL Editor (in the left sidebar)
3. **Copy and paste each migration below**, then click "Run"

### Migration 1: Ensure rooms RLS policy
```sql
-- Ensure rooms policies allow admins to manage rooms without service role
-- This migration is idempotent and safe to run multiple times

-- Ensure RLS is enabled
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Drop and recreate the policy to ensure it's correct
DROP POLICY IF EXISTS "Reception and admin can manage rooms" ON public.rooms;

-- Create rooms manage policy using has_role function (breaks recursion)
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

### Migration 2: Ensure all users have roles in user_roles table
```sql
-- Ensure all users have roles in user_roles table
-- This fixes the case where users exist in public.users but not in user_roles

INSERT INTO public.user_roles (user_id, role)
SELECT auth_id, 
  CASE role::text
    WHEN 'admin' THEN 'admin'::app_role
    WHEN 'reception' THEN 'reception'::app_role
    WHEN 'housekeeping' THEN 'housekeeping'::app_role
  END
FROM public.users
WHERE auth_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = public.users.auth_id
  )
ON CONFLICT (user_id, role) DO NOTHING;
```

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

If you still get 403 errors after running migrations:

1. Check that your admin user has a role in `public.user_roles` table:
```sql
SELECT * FROM public.user_roles WHERE user_id = 'YOUR_AUTH_ID';
```

2. If no rows, manually insert your admin role:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('YOUR_AUTH_ID', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;
```

3. Verify the policy exists:
```sql
SELECT * FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'rooms' 
  AND policyname = 'Reception and admin can manage rooms';
```

