# Troubleshooting RPC Functions Not Visible to PostgREST

## The Problem
You're getting "Room saved (partial)" messages because PostgREST can't see the RPC functions even though they exist in the database.

## Solution Steps

### Step 1: Verify Functions Exist
Run this in Supabase SQL Editor:
```sql
SELECT proname, pg_get_function_identity_arguments(oid) 
FROM pg_proc 
WHERE proname IN ('update_room_with_configurations', 'insert_room_with_configurations')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

You should see both functions listed. If not, run `supabase/apply_rpc_functions.sql` again.

### Step 2: Force PostgREST Refresh
Run `supabase/force_postgrest_refresh.sql` in SQL Editor. This recreates the functions which sometimes helps PostgREST notice them.

### Step 3: Restart Supabase Project
1. Go to Supabase Dashboard
2. Click on your project
3. Go to **Settings** → **General**
4. Scroll down to find **"Restart project"** or **"Restart PostgREST"**
5. Click **Restart**
6. **Wait 3-5 minutes** for the restart to complete

### Step 4: Verify After Restart
After restarting, run this to check if PostgREST can see the functions:
```sql
-- This checks what PostgREST can see via information_schema
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('update_room_with_configurations', 'insert_room_with_configurations');
```

### Step 5: Test Room Creation
Try creating or editing a room. You should see:
- ✅ "Room created/updated successfully" (no "partial" message)
- ✅ No localStorage fallback needed
- ✅ Data saved directly to database

## Alternative: Wait for Automatic Refresh
If restart doesn't work, PostgREST refreshes its cache automatically every 5-30 minutes. You can:
- Wait and try again later
- Continue using the app - localStorage fallback preserves your data
- Edit rooms later - the data will be saved automatically when PostgREST cache refreshes

## Why This Happens
PostgREST maintains an internal schema cache for performance. When you create new functions, it doesn't immediately detect them. A restart forces PostgREST to rebuild its cache from scratch.

