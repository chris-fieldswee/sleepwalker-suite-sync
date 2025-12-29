# Staff Availability Cleanup - Only Current and Future Dates

This update ensures that the database only keeps staff availability records for current and future dates. Past availability records are automatically cleaned up.

## Changes Made

### 1. Database Migration (`20251108_cleanup_past_availability.sql`)

- **Cleanup Function**: Created `cleanup_past_availability()` function that deletes all availability records with dates before today
- **Date Validation Trigger**: Added `prevent_past_availability_date` trigger that prevents inserting or updating availability records with past dates
- **One-time Cleanup**: The migration automatically runs the cleanup function to remove existing past records

### 2. Frontend Updates

#### `AddAvailabilityDialog.tsx`
- Added validation to prevent selecting past dates
- Set minimum date on date input to today
- Shows error message if user tries to add availability for a past date

#### `ImportAvailabilityDialog.tsx`
- Filters out records with past dates during CSV import
- Shows warning message indicating how many past date records were skipped
- Only imports records with current or future dates

#### `StaffAvailabilityManager.tsx`
- Updated query to only fetch availability records with dates >= today
- Simplified sorting logic since we only show current/future dates
- Automatically filters out any past dates from the display

## How It Works

1. **Database Level Protection**: 
   - The trigger `prevent_past_availability_date` automatically rejects any INSERT or UPDATE operations that try to add past dates
   - Error message: "Cannot add availability for past dates. Only current and future dates are allowed."

2. **Frontend Validation**:
   - Date inputs have `min` attribute set to today's date
   - Form validation checks date before submission
   - CSV import filters out past dates before processing

3. **Automatic Cleanup**:
   - The `cleanup_past_availability()` function can be called manually or scheduled
   - Migration runs it once to clean up existing past records

## Running the Migration

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/20251108_cleanup_past_availability.sql`
4. Click **Run** to execute the migration

The migration will:
- Create the cleanup function
- Create the date validation trigger
- Delete all existing past availability records
- Set up protection against future past date insertions

## Manual Cleanup

If you need to manually clean up past records, you can run:

```sql
SELECT cleanup_past_availability();
```

## Notes

- The system now only stores and displays availability for today and future dates
- Past availability records are automatically excluded from all queries
- Users cannot add or import availability for past dates
- The database trigger provides an additional layer of protection

