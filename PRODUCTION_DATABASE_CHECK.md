# Production Database Check

## Issue
Time limits are not visible for OTHER location tasks and validation errors persist in production.

## Potential Causes

### 1. Database Migration Not Applied
The migration `20250111_fix_guest_count_type.sql` may not have been applied in production. This migration converts:
- `tasks.guest_count` from INTEGER to TEXT
- `limits.guest_count` from INTEGER to TEXT

**Check:**
```sql
-- Run this in Supabase SQL Editor to check column types
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('tasks', 'limits')
  AND column_name = 'guest_count';
```

**Expected Result:**
- `tasks.guest_count` should be `text`
- `limits.guest_count` should be `text`

**If not TEXT, run the migration:**
```bash
# Apply the migration
supabase db push
# OR manually run the SQL from supabase/migrations/20250111_fix_guest_count_type.sql
```

### 2. Limits Table Data Type Mismatch
The code now tries both INTEGER and TEXT queries, but if the limits table still has INTEGER type, the data might not match.

**Check limits table data:**
```sql
SELECT group_type, cleaning_type, guest_count, time_limit
FROM public.limits
WHERE group_type = 'OTHER'
ORDER BY cleaning_type, guest_count;
```

**Expected:** Should have entries like:
- `OTHER`, `S`, `1`, `15`
- `OTHER`, `G`, `1`, `20`
- etc.

### 3. Validation Schema Not Updated
The validation schema in `src/lib/validation.ts` has been updated to accept numeric strings, but production might be using cached code.

**Solution:** Clear service worker cache (see PRODUCTION_CACHE_FIX.md)

## Quick Fix Steps

1. **Verify database schema:**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'tasks' AND column_name = 'guest_count';
   ```

2. **If guest_count is INTEGER, run migration:**
   - Go to Supabase Dashboard → SQL Editor
   - Run the contents of `supabase/migrations/20250111_fix_guest_count_type.sql`

3. **Verify limits table has OTHER room entries:**
   ```sql
   SELECT * FROM public.limits WHERE group_type = 'OTHER';
   ```

4. **Clear production cache:**
   - Follow instructions in PRODUCTION_CACHE_FIX.md

5. **Redeploy with latest code:**
   ```bash
   git push
   ```

## Code Changes Made

1. **Updated validation schema** - Accepts numeric strings for OTHER rooms
2. **Updated time limit queries** - Tries both INTEGER and TEXT queries for compatibility
3. **Added comprehensive logging** - Tracks time limit calculation failures

The code now handles both INTEGER and TEXT guest_count columns in the limits table for backward compatibility.

