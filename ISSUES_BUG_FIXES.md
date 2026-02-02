# Issues Functionality Bug Fixes

## Issues Fixed

### 1. ✅ Storage Bucket Name Mismatch
**Problem**: Code was trying to use `task_issues` bucket, but the actual bucket name is `issue-photos`.

**Fix**: Updated all references from `task_issues` to `issue-photos` in:
- `src/hooks/useTaskActions.ts`
- `src/pages/reception/Issues.tsx`
- `src/components/reception/NewIssueDetailDialog.tsx`
- `src/hooks/useReceptionActions.ts`

### 2. ✅ SVG File Support
**Problem**: SVG files were not in the allowed MIME types for the storage bucket, causing upload failures.

**Fixes Applied**:
1. Created migration: `supabase/migrations/20250109_add_svg_support_to_issue_photos.sql`
   - Adds `image/svg+xml` to allowed MIME types for `issue-photos` bucket
2. Improved file type validation in `ReportNewIssueDialog.tsx`
   - Now checks for SVG files by MIME type and file extension
   - Better error messages for unsupported file types

### 3. ✅ Housekeeper-Created Issues Not Visible
**Problem**: Issues created by housekeepers were not appearing in the admin's Issues page.

**Root Cause**: The query used `room:rooms!inner` which is an INNER JOIN. If there was any issue with the room relationship or data, the issue would be filtered out.

**Fix**: Changed the query from `room:rooms!inner` to `room:rooms` (left join) in `src/pages/reception/Issues.tsx`. This ensures issues are shown even if there's a problem with room data.

**Additional Improvements**:
- Added better error logging in `handleReportIssue` to help debug future issues
- Added `.select().single()` to the insert query to verify the issue was created
- Console logging now shows the created issue data

## Migration Instructions

Run these migrations in order:

1. **Allow housekeepers to create issues** (if not already applied):
   ```sql
   -- File: supabase/migrations/20250109_allow_housekeepers_create_issues.sql
   ```

2. **Add SVG support to storage bucket**:
   ```sql
   -- File: supabase/migrations/20250109_add_svg_support_to_issue_photos.sql
   ```

Or apply via Supabase CLI:
```bash
supabase migration up
```

## Testing Checklist

After applying fixes, test:

1. **Storage Bucket**:
   - [ ] Upload JPG/PNG image - should work
   - [ ] Upload SVG file - should work (after migration)
   - [ ] Verify files are stored in `issue-photos` bucket

2. **Housekeeper Issue Reporting**:
   - [ ] Housekeeper reports an issue
   - [ ] Check browser console for "Issue created successfully" log
   - [ ] Verify issue appears in admin's Issues page
   - [ ] Verify issue shows correct room, description, and photo

3. **Admin View**:
   - [ ] Admin can see all issues (including housekeeper-created)
   - [ ] Admin can filter, update, and assign issues
   - [ ] All issue data displays correctly

## Files Modified

1. `supabase/migrations/20250109_add_svg_support_to_issue_photos.sql` (NEW)
2. `src/hooks/useTaskActions.ts`
3. `src/pages/reception/Issues.tsx`
4. `src/components/reception/NewIssueDetailDialog.tsx`
5. `src/hooks/useReceptionActions.ts`
6. `src/components/reception/ReportNewIssueDialog.tsx`

## Notes

- The storage bucket `issue-photos` must exist in your Supabase project
- If the bucket doesn't exist, create it via Supabase dashboard or run the storage bucket migration
- SVG support requires the migration to be applied
- The query change from `!inner` to regular join ensures issues are visible even if room data has issues


