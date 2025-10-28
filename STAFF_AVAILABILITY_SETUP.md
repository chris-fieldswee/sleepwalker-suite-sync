# Staff Availability System Setup

## Database Migration Required

To enable the staff availability management system, you need to run the following SQL migration in your Supabase dashboard:

### Step 1: Run the Migration

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/20250103_create_staff_availability_table.sql`
4. Click **Run** to execute the migration

### Step 2: Verify the Migration

After running the migration, verify that the following were created:

- ✅ `staff_availability` table
- ✅ Indexes on `staff_id`, `date`, and `available_hours`
- ✅ RLS policies for security
- ✅ Triggers for automatic hour tracking
- ✅ Realtime subscription enabled

### Step 3: Test the System

1. **Import Staff Availability:**
   - Go to **Admin → Staff Availability**
   - Click **"Import Staff Availability"**
   - Upload a CSV file with the format:
     ```
     Data	Pracownik	Stanowisko	Lokalizacja	Start	Koniec	Suma Godzin
     2025-10-27	Ewelina Szczudlek	Recepcja I zm.	Recepcja	6:00	14:30	8.5
     ```

2. **Create a Task:**
   - Go to **Reception → Tasks**
   - Click **"Add Task"**
   - Select a date and room
   - Notice that only available staff members appear in the assignment dropdown

3. **View Availability:**
   - Go to **Admin → Staff Availability**
   - View the availability schedule
   - See how assigned hours are automatically tracked

## How It Works

### Automatic Hour Tracking
- When a task is assigned to a staff member, their `assigned_hours` automatically increase
- `available_hours` is calculated as `total_hours - assigned_hours`
- When tasks are completed or cancelled, hours are automatically freed up

### CSV Import Format
The system expects tab-separated values with these columns:
- **Data**: Date in YYYY-MM-DD format
- **Pracownik**: Staff member name (must match user names in the system)
- **Stanowisko**: Position/role
- **Lokalizacja**: Location
- **Start**: Start time (HH:MM format)
- **Koniec**: End time (HH:MM format)
- **Suma Godzin**: Total available hours (decimal, e.g., 8.5)

### Staff Filtering
- Only staff members with `available_hours > 0` appear in task assignment dropdowns
- Admin users are always available (can be assigned tasks regardless of availability)
- The system falls back to showing all staff if availability data is not available

## Troubleshooting

### Import Issues
- **"No matching users found"**: Check that staff names in CSV exactly match user names in the system
- **"Invalid CSV format"**: Ensure the file is tab-separated and has the correct headers

### Availability Not Showing
- Check that the `staff_availability` table was created successfully
- Verify that RLS policies are working correctly
- Ensure the migration completed without errors

### Tasks Not Filtering Staff
- Check that availability data exists for the selected date
- Verify that the `available_hours` calculation is working
- Check browser console for any JavaScript errors

## Next Steps

After setting up the system:

1. **Import your staff schedules** using the CSV import feature
2. **Test task creation** to see availability filtering in action
3. **Monitor availability** through the admin interface
4. **Set up regular imports** for updated schedules

The system will automatically track assigned hours and update availability as tasks are created, completed, or cancelled.
