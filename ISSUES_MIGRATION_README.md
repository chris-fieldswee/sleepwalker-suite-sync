# Issues Management System - Migration Guide

## Overview

This migration refactors the issue management system from being embedded in tasks to a separate, dedicated `issues` table. This provides better tracking, management, and reporting capabilities for issues.

## What Changed

### Before
- Issues were stored as fields in the `tasks` table:
  - `issue_flag` (boolean)
  - `issue_description` (text)
  - `issue_photo` (text URL)
- Issues were task-specific only

### After
- Dedicated `issues` table with:
  - Status tracking (`open`, `in_progress`, `resolved`, `closed`)
  - Priority levels (`low`, `medium`, `high`, `urgent`)
  - Assignment to specific users
  - Separate from but linkable to tasks
  - Direct link to rooms (can create issues without tasks)
  - Better reporting and tracking

## Database Schema

### Issues Table Structure

```sql
issues
├── id (UUID, Primary Key)
├── room_id (UUID, Foreign Key to rooms)
├── task_id (UUID, Optional - Foreign Key to tasks)
├── reported_by_user_id (UUID, Foreign Key to users)
├── assigned_to_user_id (UUID, Optional - Foreign Key to users)
├── title (TEXT, Required)
├── description (TEXT, Required)
├── status (enum: open, in_progress, resolved, closed)
├── priority (enum: low, medium, high, urgent)
├── photo_url (TEXT)
├── reported_at (TIMESTAMPTZ)
├── resolved_at (TIMESTAMPTZ)
├── resolved_by_user_id (UUID, Foreign Key to users)
├── notes (TEXT)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

## Features

### 1. Issue Status Workflow
- **open**: Newly reported issue
- **in_progress**: Issue is being worked on
- **resolved**: Issue has been fixed
- **closed**: Issue is closed (administrative action)

### 2. Priority Levels
- **low**: Minor issues that don't affect operations
- **medium**: Standard issues that need attention
- **high**: Critical issues requiring immediate attention
- **urgent**: Emergency issues requiring immediate resolution

### 3. Assignment System
- Issues can be assigned to specific staff members
- Track who reported and who resolved each issue
- Better accountability and workload distribution

### 4. Room-Centric Issues
- Issues can be linked directly to rooms
- Can create issues for rooms independent of tasks
- Better tracking of ongoing room problems

## Migration Details

### Data Migration
All existing issues from the `tasks` table are automatically migrated:
- Issues with `issue_flag = true` are copied to the new `issues` table
- `task_id` links the new issue to the original task
- Status is set based on task status
- Photos and descriptions are preserved

### Backward Compatibility
The old fields remain in the `tasks` table for backward compatibility:
- `issue_flag`
- `issue_description`
- `issue_photo`

These can be removed in a future migration once the new system is fully adopted.

## Application Changes Needed

### 1. Database Types (src/integrations/supabase/types.ts)
Add new types:
```typescript
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Issue {
  id: string;
  room_id: string;
  task_id?: string | null;
  reported_by_user_id?: string | null;
  assigned_to_user_id?: string | null;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  photo_url?: string | null;
  reported_at: string;
  resolved_at?: string | null;
  resolved_by_user_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}
```

### 2. New Components to Create

#### Issue Management Dialog
- Create/edit issues
- Assign to staff
- Set priority and status
- Upload photos

#### Issues List View
- View all issues
- Filter by room, status, priority
- Sort by date, priority
- Quick status updates

#### Issue Assignment
- Assign issues to housekeeping staff
- Track workload
- Notification system (future)

### 3. Updated Components

#### ReportNewIssueDialog
- Update to use the new `issues` table
- Add room selection (optional - can link to current task)
- Add priority selection
- Better photo upload handling

#### Task Table
- Still show issue indicator
- Link to issues list
- Allow creating issues from tasks

## Benefits

### 1. Better Issue Tracking
- Issues persist independently of tasks
- Track issue lifecycle from creation to resolution
- Historical data and reporting

### 2. Improved Workflow
- Assign issues to specific staff
- Track who's responsible for each issue
- Priority-based triage

### 3. Reporting & Analytics
- Track resolution times
- Identify recurring problems
- Monitor issue trends by room/priority
- Performance metrics

### 4. Room Management
- Create issues directly for rooms
- Track ongoing problems
- Better maintenance management

## Usage Examples

### Creating an Issue from a Task
```typescript
await supabase.from('issues').insert({
  room_id: task.room_id,
  task_id: task.id,
  reported_by_user_id: currentUser.id,
  title: 'Broken shower handle',
  description: 'The shower handle is loose and difficult to turn',
  status: 'open',
  priority: 'high',
  photo_url: uploadedPhotoUrl
});
```

### Creating a Room Issue (Independent)
```typescript
await supabase.from('issues').insert({
  room_id: 'room-uuid',
  reported_by_user_id: currentUser.id,
  title: 'AC not working',
  description: 'Air conditioning not cooling properly',
  status: 'open',
  priority: 'urgent'
});
```

### Assigning an Issue
```typescript
await supabase.from('issues')
  .update({ 
    assigned_to_user_id: staffMember.id,
    status: 'in_progress'
  })
  .eq('id', issueId);
```

### Resolving an Issue
```typescript
await supabase.from('issues')
  .update({ 
    status: 'resolved',
    notes: 'Fixed by replacing the unit'
  })
  .eq('id', issueId);
```

## Next Steps

1. **Run the Migration**
   ```bash
   supabase db push
   ```

2. **Update TypeScript Types**
   - Add Issue-related types to `types.ts`

3. **Create New Components**
   - IssueDialog for creating/editing issues
   - IssuesList component for viewing all issues
   - IssueAssignment feature

4. **Update Existing Components**
   - Modify ReportNewIssueDialog to use new table
   - Update TaskTable to link to issues
   - Add issues view to navigation

5. **Testing**
   - Test issue creation from tasks
   - Test room-specific issue creation
   - Test assignment and resolution workflow
   - Verify data migration was successful

6. **Future Enhancements**
   - Remove backward compatibility fields from tasks
   - Add notification system for new assignments
   - Create issue analytics dashboard
   - Add issue recurrence tracking

