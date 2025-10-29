# Sleepwalker Project - Troubleshooting Guide (Updated & Validated)

## Step-by-Step Fix Instructions

### Step 1: Verify Environment Variables ✅ **VALID**

1. **Use `.env.local` (not `.env`)** - Create this file in the root directory
2. Verify the variables are correctly formatted:
   ```env
   VITE_SUPABASE_URL=https://wxxrprwnovnyncgigrwi.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   ⚠️ **Note**: No quotes needed around values in `.env.local` files

3. **IMPORTANT**: Restart your dev server after changing `.env.local`:
   ```bash
   pkill -f "npm run dev"
   npm run dev
   ```

### Step 2: Fix Database Issues ✅ **VALID (with updates)**

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/20250105_fix_users_rls_simple.sql`
4. Click **Run** to execute the script
5. This migration fixes RLS policies to allow users to access their own profiles

**OR use Supabase CLI:**
```bash
supabase db push
```

### Step 3: AuthContext ✅ **ALREADY FIXED**

✅ **Note**: The AuthContext has already been simplified and fixed in the current codebase. No manual update needed.

The current `src/contexts/AuthContext.tsx`:
- ✅ No complex timeout logic
- ✅ Clean error handling
- ✅ Proper profile fetching
- ✅ No debugging console.log statements

### Step 4: Clear Browser Data ✅ **VALID**

1. Open Developer Tools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Clear all data:
   - Local Storage
   - Session Storage
   - Cookies
   - IndexedDB
4. Close and reopen the browser

### Step 5: Test the Login ✅ **VALID**

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open the browser console (F12) to see any errors

3. Try to log in with existing credentials:
   - Email: `admin@sleepwalker.com`
   - Password: `admin123`

4. Check the console for error messages

## Common Issues and Solutions

### Issue 1: "User profile not found" ✅ **VALID**

**Symptoms**: Login successful but redirects back to login

**Fix**: Run this SQL query in Supabase SQL Editor:
```sql
-- Check if user exists in users table
SELECT * FROM public.users WHERE auth_id = 'YOUR_AUTH_ID';

-- If missing, check auth.users first
SELECT id, email FROM auth.users WHERE email = 'admin@sleepwalker.com';

-- Then create the profile if missing (replace YOUR_AUTH_ID with actual ID)
INSERT INTO public.users (auth_id, name, role, active, first_name, last_name)
VALUES ('YOUR_AUTH_ID', 'Admin User', 'admin', true, 'Admin', 'User')
ON CONFLICT (auth_id) DO UPDATE SET role = 'admin', active = true;

-- Ensure role entry exists
INSERT INTO public.user_roles (user_id, role)
VALUES ('YOUR_AUTH_ID', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

### Issue 2: "Cannot read properties of null" ✅ **VALID**

**Symptoms**: White screen or error in console

**Fix**: 
1. Clear browser cache completely
2. Delete `node_modules/.vite` to clear Vite cache:
   ```bash
   rm -rf node_modules/.vite
   npm run dev
   ```

### Issue 3: Infinite redirect loop ✅ **VALID**

**Symptoms**: Page keeps reloading between `/auth` and `/`

**Fix**: This is usually caused by RLS policies. Run the migration:
```bash
supabase db push
```
Or manually run `supabase/migrations/20250105_fix_users_rls_simple.sql` in Supabase SQL Editor.

### Issue 4: "Failed to fetch" or "VITE_SUPABASE_URL is required" ✅ **VALID**

**Symptoms**: Network errors or environment variable errors

**Fix**:
1. ✅ Verify `.env.local` file exists (not `.env`)
2. ✅ Check the URL in `.env.local` is correct (no quotes)
3. ✅ Restart dev server after creating/modifying `.env.local`
4. ✅ Check Supabase project status in dashboard
5. ✅ Verify the project is not paused

## Debugging Checklist ✅ **VALID (updated)**

Run through this checklist:

- [ ] `.env.local` file exists (not `.env`) and has correct values
- [ ] Dev server restarted after `.env.local` changes
- [ ] Migration `20250105_fix_users_rls_simple.sql` executed successfully
- [ ] Browser cache cleared
- [ ] Console shows no CORS errors
- [ ] Supabase project is active (not paused)
- [ ] User exists in both `auth.users` AND `public.users` tables
- [ ] User has entry in `public.user_roles` table
- [ ] User `active` field is `true` in `public.users`

## Console Commands for Debugging ✅ **VALID (corrected)**

Run these in Supabase SQL Editor to check your data:

```sql
-- 1. Check auth users
SELECT id, email, created_at FROM auth.users;

-- 2. Check user profiles
SELECT * FROM public.users;

-- 3. Check user roles
SELECT * FROM public.user_roles;

-- 4. Check for orphaned auth users (users in auth but not in public.users)
SELECT au.email, au.id AS auth_id
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.auth_id
WHERE pu.id IS NULL;

-- 5. Check a specific user's full data
SELECT 
  au.id AS auth_id,
  au.email,
  pu.id AS user_id,
  pu.name,
  pu.role,
  pu.active,
  ur.role AS user_role_table_role
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.auth_id
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
WHERE au.email = 'admin@sleepwalker.com';
```

## Creating a Test Admin User ✅ **VALID**

If you need to create a test admin user:

1. **Create in Supabase Dashboard:**
   - Go to Authentication → Users → Add user
   - Email: `admin@sleepwalker.com`
   - Password: `admin123`
   - ✅ Check "Auto Confirm User"
   - Copy the User UUID

2. **Set Admin Role (SQL Editor):**
```sql
-- Replace YOUR_USER_AUTH_ID with the UUID from step 1
UPDATE public.users 
SET role = 'admin', active = true
WHERE auth_id = 'YOUR_USER_AUTH_ID';

INSERT INTO public.user_roles (user_id, role)
VALUES ('YOUR_USER_AUTH_ID', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

## Invalid/Outdated References ❌

The following are **NOT VALID** for the current codebase:

- ❌ Reference to "Database Fix Script" artifact - Use the migration file instead
- ❌ Reference to "Fixed AuthContext.tsx" artifact - Already fixed in codebase
- ❌ Reference to `public.auth_debug` view - This doesn't exist
- ❌ Mention of `.env` file - Should be `.env.local`

## Still Having Issues?

Check these files for syntax errors:
1. ✅ `src/integrations/supabase/client.ts` - Supabase client initialization
2. ✅ `src/contexts/AuthContext.tsx` - Authentication logic (already simplified)
3. ✅ `src/pages/Auth.tsx` - Login form
4. ✅ Browser console for JavaScript errors
5. ✅ Supabase Dashboard > Logs for backend errors
6. ✅ Network tab for failed requests

## Quick Reference

- **Environment File**: `.env.local` (not `.env`)
- **Migration File**: `supabase/migrations/20250105_fix_users_rls_simple.sql`
- **Dev Server Port**: `http://localhost:8080`
- **Admin Email**: `admin@sleepwalker.com`
- **Admin Password**: `admin123`

