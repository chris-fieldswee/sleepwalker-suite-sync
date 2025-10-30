# Run Capacity Label Migration

To enable differentiation between "1+1" and "2" room capacity options, you need to run this migration on your live Supabase project.

## Quick Fix

1. **Go to your Supabase project**: https://supabase.com/dashboard
2. **Navigate to SQL Editor**: Project → SQL Editor (in the left sidebar)
3. **Copy and paste the migration below**, then click "Run"

### Migration Script

```sql
-- Add capacity_label field to rooms table to differentiate between "2" and "1+1"
-- This field stores the label/display format while capacity stores the numeric value

-- Add capacity_label column to rooms table
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS capacity_label TEXT;

-- Update existing rooms to have default capacity_label based on their capacity
UPDATE public.rooms SET capacity_label = capacity::TEXT WHERE capacity_label IS NULL;

-- Make sure the column has a default value for future inserts
ALTER TABLE public.rooms ALTER COLUMN capacity_label SET DEFAULT '2';
```

## What This Does

- Adds a new `capacity_label` column to the `rooms` table
- Populates existing rooms with their numeric capacity as the label (e.g., "2")
- Sets a default value for future room creations

## After Running

1. **Hard refresh** your live site (Cmd+Shift+R or Ctrl+Shift+R)
2. **Try creating a room** with "1+1" capacity
3. The selection will now be persisted and displayed correctly!

## Next Steps

The application will now:
- Store the user's exact selection (e.g., "1+1" vs "2")
- Display the correct icons based on the stored label
- Allow you to distinguish between twin beds ("1+1") and a shared bed ("2")

