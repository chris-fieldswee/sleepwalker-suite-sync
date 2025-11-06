# Fix for Room Save Issues

## Problem
When creating or editing rooms:
- Cleaning types are saved correctly ✓
- Capacity is only saved as a single value (e.g., 1) ✗
- You receive "partially successful" message ✗

## Root Cause
The `capacity_configurations` column doesn't exist in your database, or the RPC functions aren't set up. The code falls back to saving without `capacity_configurations`, which is why you only see a single capacity value.

## Solution

### Step 1: Run Diagnostic Query
Run `supabase/diagnose_room_save_issues.sql` in your Supabase SQL Editor to check what's missing.

### Step 2: Add the Column (if missing)
Run `supabase/migrations/20250104_room_capacity_configurations_safe.sql` in your Supabase SQL Editor.

This adds the `capacity_configurations` JSONB column to store multiple capacity options.

### Step 3: Create/Update RPC Functions
Run `supabase/apply_rpc_functions.sql` in your Supabase SQL Editor.

This creates the RPC functions that properly save `capacity_configurations` and extract `cleaning_types`.

### Step 4: Verify Setup
Run the diagnostic query again to confirm everything is set up correctly.

### Step 5: Test
1. Create a new room with multiple capacity options
2. Check the browser console for logs showing:
   - "Attempting to save via RPC functions first..."
   - "Successfully created/updated room via RPC function"
3. You should see a "Success" message (not "partially successful")
4. Check the database - `capacity_configurations` should contain all selected capacity options

## What Changed in the Code

1. **RPC Functions First**: The code now tries RPC functions first when saving rooms with capacity configurations, since they're more reliable.

2. **Better Logging**: Added console logs to help debug:
   - Capacity configurations count
   - Full capacity configurations JSON
   - Which save method is being used

3. **Clearer Error Handling**: Better error messages to identify what's failing.

## Understanding Capacity vs Capacity Configurations

- **`capacity`** (INTEGER): Legacy field storing a single numeric value (e.g., 1, 2, 3)
- **`capacity_label`** (TEXT): Text label for that capacity (e.g., "1", "2", "1+1", "2+1")
- **`capacity_configurations`** (JSONB): Array storing ALL capacity options with their cleaning types:
  ```json
  [
    {
      "capacity": 1,
      "capacity_label": "1",
      "cleaning_types": [...]
    },
    {
      "capacity": 2,
      "capacity_label": "2",
      "cleaning_types": [...]
    }
  ]
  ```

The `capacity` field is set to the first value from `capacity_configurations` for backward compatibility, but all options are stored in `capacity_configurations`.

## If Issues Persist

1. Check browser console for error messages
2. Run the diagnostic query to see what's missing
3. Make sure you've run both SQL scripts
4. Try refreshing PostgREST cache (see `supabase/force_postgrest_refresh.sql`)

