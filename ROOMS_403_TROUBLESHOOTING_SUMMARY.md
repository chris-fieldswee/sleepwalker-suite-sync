# Rooms 403 Error - Complete Troubleshooting Summary

## Problem
When creating a room on the live site, you get:
- **403 Forbidden** error
- Message: "new row violates row-level security policy for table \"rooms\""

## Root Cause
The admin user doesn't have a role entry in the `user_roles` table, so the `has_role()` function returns `false`, causing the RLS policy to reject the INSERT operation.

## Quick Solution

**Run the SQL from `FIX_ROOMS_403_COMPLETE.sql` in your Supabase SQL Editor.**

This single migration will:
1. ✅ Ensure `app_role` enum exists
2. ✅ Create `user_roles` table if missing
3. ✅ Set up proper RLS policies on `user_roles`
4. ✅ Create/recreate the `has_role()` SECURITY DEFINER function
5. ✅ Insert the admin user's role into `user_roles` table
6. ✅ Set up correct RLS policies on `rooms` table
7. ✅ Verify everything is working

## Files Created

1. **`FIX_ROOMS_403_COMPLETE.sql`** - Complete one-shot fix (USE THIS!)
2. **`DIAGNOSE_ROOMS_ISSUE.sql`** - Diagnostic queries to check current state
3. **`RUN_LIVE_MIGRATIONS.md`** - Step-by-step guide with troubleshooting

## How to Apply

1. Go to https://supabase.com/dashboard → Your Project → SQL Editor
2. Open `FIX_ROOMS_403_COMPLETE.sql` (or copy from `RUN_LIVE_MIGRATIONS.md`)
3. Copy the entire SQL block
4. Paste into SQL Editor
5. Click "Run" (or Cmd+Enter)
6. Check the output - you should see:
   - "Policy exists: true"
   - "Current user has admin role: true"
7. Hard refresh your live site
8. Try creating a room - it should work! 🎉

## Expected Output After Running

```
NOTICE: Policy exists: true
NOTICE: Current user has admin role: true
```

Both should be `true`.

## Security Notes

- The `has_role()` function uses `SECURITY DEFINER` to bypass RLS
- This is safe because it's a read-only function
- Admin operations still go through regular RLS policies
- Service role key is no longer needed for room operations

