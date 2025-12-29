# Complete Fix for Duplicate Users Issue

## Understanding the Problem

You experienced this sequence:
1. **Two records with same email existed** - likely one in `auth.users` and duplicates in `public.users` for the same `auth_id`
2. **Deleted one record, but TWO disappeared** - This happened because:
   - `public.users` has `ON DELETE CASCADE` foreign key to `auth.users`
   - When you deleted from `auth.users`, it automatically deleted ALL matching entries in `public.users` with that `auth_id`
   - If there were 2 entries in `public.users` for the same `auth_id`, both got deleted
3. **Created new user, got duplicate error** - The trigger and application code both tried to create entries, causing duplicates again

## Root Causes

1. **Trigger creates entry automatically** - `handle_new_user()` trigger fires when auth user is created
2. **Application code also creates entry** - Admin interface code inserts into `public.users` 
3. **No conflict handling** - Neither the trigger nor the code checked for existing entries
4. **No unique constraint** - Database didn't prevent duplicates at the schema level

## Complete Solution

### Step 1: Fix Existing Duplicates

Run this SQL in Supabase SQL Editor to remove all duplicates:

```sql
-- File: supabase/fix_duplicate_users.sql
-- Or run directly:

-- 1. Check for duplicates
SELECT 
  auth_id,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as user_ids
FROM public.users
WHERE auth_id IS NOT NULL
GROUP BY auth_id
HAVING COUNT(*) > 1;

-- 2. Remove duplicates (keeps most recent)
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

### Step 2: Run Migrations

Apply the fixes in order:

```bash
supabase db push
```

Or run manually in Supabase SQL Editor in this order:

1. **`supabase/migrations/20251108_add_unique_constraint_auth_id.sql`**
   - Adds unique constraint to prevent duplicates at database level

2. **`supabase/migrations/20251108_fix_handle_new_user_trigger.sql`**
   - Updates trigger to check for existing users before inserting
   - Prevents trigger from creating duplicates

### Step 3: Code Already Fixed

The application code has been updated to use `upsert` instead of `insert`:
- ✅ `src/pages/admin/Users.tsx` - Uses `upsert` with `onConflict: 'auth_id'`
- ✅ `src/components/admin/BulkCreateHousekeepingUsers.tsx` - Uses `upsert` with `onConflict: 'auth_id'`

## What Each Fix Does

### 1. Unique Constraint (`20251108_add_unique_constraint_auth_id.sql`)
- Prevents database from allowing duplicate `auth_id` values
- Database will reject any attempt to create duplicates
- **Must run after removing existing duplicates**

### 2. Trigger Fix (`20251108_fix_handle_new_user_trigger.sql`)
- Trigger now checks if user exists before inserting
- If user exists, it updates instead of inserting
- Prevents trigger from creating duplicates even if it fires multiple times

### 3. Code Fix (Already Applied)
- Application code uses `upsert` instead of `insert`
- If trigger already created entry, code updates it instead of creating duplicate
- Handles race conditions gracefully

## Verification Steps

After applying fixes:

1. **Check for duplicates:**
```sql
SELECT auth_id, COUNT(*) 
FROM public.users 
WHERE auth_id IS NOT NULL 
GROUP BY auth_id 
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

2. **Check unique constraint exists:**
```sql
SELECT conname 
FROM pg_constraint 
WHERE conrelid = 'public.users'::regclass 
AND conname = 'users_auth_id_unique';
-- Should return 1 row
```

3. **Test creating a new user:**
   - Create a new user via admin interface
   - Check that only ONE entry exists in `public.users` for that `auth_id`
   - Try logging in - should work without errors

4. **Check trigger function:**
```sql
SELECT prosrc 
FROM pg_proc 
WHERE proname = 'handle_new_user';
-- Should show the updated function with IF NOT EXISTS check
```

## For Your Specific User

For the user with auth_id `36262746-28f7-484a-ac09-6f76ba8405db`:

```sql
-- Check current state
SELECT * FROM public.users 
WHERE auth_id = '36262746-28f7-484a-ac09-6f76ba8405db';

-- If duplicates exist, remove them (keep most recent)
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

## Prevention

After applying all fixes:
- ✅ **Unique constraint** prevents database-level duplicates
- ✅ **Trigger fix** prevents trigger from creating duplicates
- ✅ **Code fix** handles existing entries gracefully
- ✅ **All three layers** work together to prevent the issue

## Important Notes

1. **Run duplicate removal FIRST** - The unique constraint migration will fail if duplicates exist
2. **Order matters** - Run constraint migration before trigger fix (though trigger fix works either way)
3. **CASCADE behavior** - Remember that deleting from `auth.users` will delete from `public.users` due to CASCADE
4. **Email uniqueness** - `auth.users` enforces email uniqueness, but `public.users` doesn't track email directly

## Troubleshooting

If you still see duplicates after fixes:

1. **Check if migrations ran:**
```sql
SELECT * FROM supabase_migrations.schema_migrations 
WHERE name LIKE '%20251108%' 
ORDER BY version;
```

2. **Check trigger is active:**
```sql
SELECT * FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
```

3. **Manually verify constraint:**
```sql
\d public.users
-- Should show UNIQUE constraint on auth_id
```

