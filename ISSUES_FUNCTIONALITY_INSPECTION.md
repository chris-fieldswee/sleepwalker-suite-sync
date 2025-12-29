# Issues Functionality Inspection Report

## Overview
This document summarizes the current state of the issues functionality and identifies what's working and what needs to be fixed.

## Current Implementation Status

### ✅ What's Working

#### 1. **Database Schema**
- `issues` table exists with proper structure:
  - Fields: `id`, `room_id`, `task_id`, `reported_by_user_id`, `assigned_to_user_id`, `title`, `description`, `status`, `priority`, `photo_url`, `reported_at`, `resolved_at`, `resolved_by_user_id`, `notes`
  - Enums: `issue_status` (open, in_progress, resolved, closed), `issue_priority` (low, medium, high, urgent)
  - Proper indexes and foreign keys
  - Realtime subscriptions enabled

#### 2. **Admin & Reception - Create Issues**
- ✅ **Location**: `src/pages/reception/Issues.tsx` - `handleCreateIssue` function
- ✅ **Component**: `ReportNewIssueDialog` (`src/components/reception/ReportNewIssueDialog.tsx`)
- ✅ **Functionality**: 
  - Can create issues from the Issues page
  - Can select room, add description, upload photo
  - Creates record in `issues` table
  - RLS policy allows: `has_role('admin') OR has_role('reception')`

#### 3. **Admin - Track & Update Issues**
- ✅ **Location**: `src/components/reception/NewIssueDetailDialog.tsx`
- ✅ **Functionality**:
  - View issue details (room, description, photo, reported by, dates)
  - **Update status** (open, in_progress, resolved, closed) ✅
  - **Assign person** (from reception/admin staff list) ✅
  - **Add notes** ✅
  - Update priority
  - Upload/replace photo
  - RLS policy allows updates for admin, reception, or assigned housekeeping staff

#### 4. **Issues Display**
- ✅ **Location**: `src/pages/reception/Issues.tsx`
- ✅ **Functionality**:
  - Displays all issues from `issues` table
  - Shows: Room, Title, Priority, Status, Assigned To, Reported Date, Photo indicator
  - Filtering by: Status, Room, Priority
  - Real-time updates via Supabase subscriptions
  - Click to view/edit details

### ❌ What's NOT Working / Missing

#### 1. **Housekeeper Issue Reporting - CRITICAL ISSUE**
- ❌ **Problem**: Housekeepers can report issues, but they're NOT creating records in the `issues` table
- **Current Behavior**:
  - Location: `src/hooks/useTaskActions.ts` - `handleReportIssue` function
  - Only updates `tasks` table with: `issue_flag=true`, `issue_description`, `issue_photo`
  - Does NOT create a record in the `issues` table
  - RLS policy blocks housekeepers from inserting into `issues` table
  
- **Impact**: 
  - Issues reported by housekeepers won't appear on the Issues page
  - Admin/reception can't track or manage housekeeper-reported issues
  - Two separate systems: tasks with issue flags vs. issues table

#### 2. **RLS Policy Restriction**
- ❌ **Current Policy** (`supabase/migrations/20251027122118_45dedf70-5ecb-418e-8e2f-4dddf57b99b7.sql`):
  ```sql
  CREATE POLICY "Reception and admin can create issues"
  ON public.issues FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'reception'::app_role)
  );
  ```
- ❌ **Issue**: Housekeepers cannot insert into `issues` table

## Required Fixes

### Fix 1: Allow Housekeepers to Create Issues
**Priority: HIGH**

1. **Update RLS Policy** to allow housekeepers to insert issues:
   ```sql
   -- Allow housekeepers to create issues
   CREATE POLICY "Housekeepers can create issues"
   ON public.issues FOR INSERT
   WITH CHECK (
     has_role(auth.uid(), 'housekeeping'::app_role)
   );
   ```

2. **Update `handleReportIssue` in `useTaskActions.ts`**:
   - After updating the task with `issue_flag`, also create a record in the `issues` table
   - Get the task's `room_id` from the task data
   - Get the current user's `user_id` from the users table
   - Insert into `issues` table with:
     - `room_id`: from task
     - `task_id`: the task ID
     - `reported_by_user_id`: current housekeeper user ID
     - `title`: first 100 chars of description
     - `description`: full description
     - `photo_url`: uploaded photo URL
     - `status`: 'open'
     - `priority`: 'medium' (or allow housekeeper to set?)

### Fix 2: Ensure Admin Can Assign Any Staff Member
**Priority: MEDIUM**

- **Current**: `NewIssueDetailDialog.tsx` filters staff to only show reception/admin (line 33-39)
- **Issue**: Admin might want to assign issues to housekeeping staff for fixing
- **Fix**: Update `getFilteredStaff` to include all staff, or add a separate filter for assignment

### Fix 3: Storage Bucket Consistency
**Priority: LOW**

- **Current**: Multiple storage bucket names used:
  - `task_issues` (used in `useTaskActions.ts` and `Issues.tsx`)
  - `issue-photos` (used in `NewIssueDetailDialog.tsx`)
- **Fix**: Standardize on one bucket name

## Summary

### ✅ Working Features:
1. Admin/Reception can create issues from Issues page
2. Admin can view, update status, assign person, and add notes to issues
3. Issues are displayed on the Issues page with filtering
4. Real-time updates work

### ❌ Missing/Broken Features:
1. **CRITICAL**: Housekeeper-reported issues don't create records in `issues` table
2. Admin can only assign to reception/admin staff (not housekeeping)
3. Storage bucket naming inconsistency

## Recommended Action Plan

1. **Immediate**: Fix housekeeper issue reporting to create `issues` records
2. **Short-term**: Update RLS policy to allow housekeepers to insert
3. **Short-term**: Update `handleReportIssue` to insert into `issues` table
4. **Medium-term**: Allow admin to assign issues to housekeeping staff
5. **Low-priority**: Standardize storage bucket names

