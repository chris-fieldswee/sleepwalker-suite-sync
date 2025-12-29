# Fix Duplicate Users Error

## Problem

When logging in, you receive this error:
```
PGRST116: Results contain 2 rows, application/vnd.pgrst.object+json requires 1 row
```

This happens because there are **duplicate entries** in the `public.users` table for the same `auth_id`.

## Root Cause

When a user is created:
1. The `handle_new_user()` trigger automatically creates an entry in `public.users` when an auth user is created
2. The application code also manually inserts into `public.users`
3. This results in **2 rows** for the same `auth_id`

## Solution

### Step 1: Fix Existing Duplicates

Run this SQL script in the Supabase SQL Editor:

```sql
-- File: supabase/fix_duplicate_users.sql
```

Or run these commands directly:

```sql
-- 1. Check for duplicates
SELECT 
  auth_id,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as user_ids
FROM public.users
WHERE auth_id IS NOT NULL
GROUP BY auth_id
HAVING COUNT(*) > 1;

-- 2. Remove duplicates (keeps the most recent entry)
WITH duplicates AS (
  SELECT 
    id,
    auth_id,
    ROW_NUMBER() OVER (PARTITION BY auth_id ORDER BY created_at DESC, id DESC) as rn
  FROM public.users
  WHERE auth_id IS NOT NULL
)
DELETE FROM public.users
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 3. Verify no duplicates remain
SELECT 
  auth_id,
  COUNT(*) as count
FROM public.users
WHERE auth_id IS NOT NULL
GROUP BY auth_id
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

### Step 2: Add Unique Constraint

Run the migration to prevent future duplicates:

```bash
supabase db push
```

Or manually run in Supabase SQL Editor:

```sql
-- File: supabase/migrations/20251108_add_unique_constraint_auth_id.sql
```

This adds a `UNIQUE` constraint on `auth_id` to prevent duplicates.

### Step 3: Code Fixes (Already Applied)

The code has been updated to use `upsert` instead of `insert` when creating users:
- `src/pages/admin/Users.tsx` - Now uses `upsert` with `onConflict: 'auth_id'`
- `src/components/admin/BulkCreateHousekeepingUsers.tsx` - Now uses `upsert` with `onConflict: 'auth_id'`

This ensures that if the trigger already created a user entry, the code will update it instead of creating a duplicate.

## Quick Fix for Your Current User

For the specific user with auth_id `36262746-28f7-484a-ac09-6f76ba8405db`:

**Option 1: Run the dedicated fix script:**
```sql
-- File: supabase/fix_specific_user_duplicate.sql
-- This script will check, fix, and verify the duplicate issue
```

**Option 2: Run manually:**
```sql
-- Check duplicates for this user
SELECT * FROM public.users 
WHERE auth_id = '36262746-28f7-484a-ac09-6f76ba8405db'
ORDER BY created_at DESC;

-- Keep the most recent one, delete others
DELETE FROM public.users 
WHERE auth_id = '36262746-28f7-484a-ac09-6f76ba8405db'
AND id NOT IN (
  SELECT id FROM public.users 
  WHERE auth_id = '36262746-28f7-484a-ac09-6f76ba8405db'
  ORDER BY created_at DESC, id DESC
  LIMIT 1
);

-- Verify only one remains
SELECT COUNT(*) FROM public.users 
WHERE auth_id = '36262746-28f7-484a-ac09-6f76ba8405db';
-- Should return 1
```

## Verification

After fixing, verify the user can log in:

1. Check that only one row exists:
```sql
SELECT COUNT(*) FROM public.users 
WHERE auth_id = '36262746-28f7-484a-ac09-6f76ba8405db';
-- Should return 1
```

2. Try logging in again with the user credentials

3. Check browser console - should no longer see the PGRST116 error

## Prevention

The unique constraint and code changes ensure this won't happen again:
- ✅ Unique constraint on `auth_id` prevents database-level duplicates
- ✅ Code uses `upsert` to handle trigger-created entries gracefully
- ✅ Future user creation will update existing entries instead of creating duplicates

