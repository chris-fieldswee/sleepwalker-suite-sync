# Issues Functionality Fixes - Applied

## Summary
All critical fixes have been applied to make the issues functionality work as required. Housekeepers can now report issues that appear in the Issues page, and admins can assign issues to any staff member.

## Fixes Applied

### 1. ✅ RLS Policy Update - Allow Housekeepers to Create Issues
**File**: `supabase/migrations/20250109_allow_housekeepers_create_issues.sql`

- Added new RLS policy: `"Housekeepers can create issues"`
- Allows users with `housekeeping` role to insert into `issues` table
- This enables housekeepers to create issue records when reporting problems

### 2. ✅ Updated handleReportIssue to Create Issues Table Records
**File**: `src/hooks/useTaskActions.ts`

**Changes**:
- Added proper validation with user-friendly error messages
- Fetches current user's `id` from `users` table (not just `auth_id`)
- Gets task's `room_id` from the task object
- After updating the task with `issue_flag`, now also creates a record in `issues` table
- Creates issue with:
  - `room_id`: from task
  - `task_id`: the task ID
  - `reported_by_user_id`: current housekeeper user ID
  - `title`: first 100 chars of description
  - `description`: full description
  - `photo_url`: uploaded photo URL
  - `status`: 'open'
  - `priority`: 'medium'
- Improved error handling with proper toast notifications
- Handles partial failures gracefully (if issue creation fails but task update succeeds)

### 3. ✅ Fixed Staff Assignment - Allow Assigning to Housekeeping Staff
**File**: `src/components/reception/NewIssueDetailDialog.tsx`

**Changes**:
- Removed filter that restricted staff selection to only reception/admin
- Updated `getFilteredStaff` to return all staff members
- Admin can now assign issues to any staff member (admin, reception, or housekeeping) for fixing

### 4. ✅ Standardized Storage Bucket Names
**Files**: 
- `src/components/reception/NewIssueDetailDialog.tsx`
- `src/hooks/useReceptionActions.ts`

**Changes**:
- Standardized all storage bucket references to use `task_issues`
- Previously used both `task_issues` and `issue-photos`
- Now consistently uses `task_issues` across all components

## Testing Checklist

After applying the migration, test the following:

1. **Housekeeper Issue Reporting**:
   - [ ] Housekeeper logs in
   - [ ] Housekeeper reports an issue from a task
   - [ ] Issue appears in the Issues page
   - [ ] Issue shows correct room, description, and photo (if uploaded)

2. **Admin Issue Management**:
   - [ ] Admin views Issues page
   - [ ] Admin can see housekeeper-reported issues
   - [ ] Admin can update issue status
   - [ ] Admin can assign issue to any staff member (including housekeeping)
   - [ ] Admin can add notes to issues
   - [ ] Admin can upload/replace photos

3. **Reception Issue Management**:
   - [ ] Reception can create issues from Issues page
   - [ ] Reception can view and update issues
   - [ ] Reception can assign issues to staff

## Migration Instructions

To apply the database migration:

```bash
# If using Supabase CLI
supabase migration up

# Or apply manually in Supabase dashboard SQL editor
# Run: supabase/migrations/20250109_allow_housekeepers_create_issues.sql
```

## Notes

- The migration adds a new RLS policy without removing existing ones
- Existing functionality for admin/reception remains unchanged
- All storage operations now use the `task_issues` bucket consistently
- Error handling has been improved throughout with proper user feedback

## Files Modified

1. `supabase/migrations/20250109_allow_housekeepers_create_issues.sql` (NEW)
2. `src/hooks/useTaskActions.ts`
3. `src/components/reception/NewIssueDetailDialog.tsx`
4. `src/hooks/useReceptionActions.ts`

