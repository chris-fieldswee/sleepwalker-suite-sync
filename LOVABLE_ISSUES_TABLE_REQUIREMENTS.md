# Issues Table Requirements for Lovable

## Table: `issues`

Create a new table called `issues` to manage room and task-related problems separately from tasks.

### Basic Structure

**Table Name**: `issues`

### Fields

1. **id** (UUID, Primary Key)
   - Auto-generated
   - Primary key

2. **room_id** (UUID, Foreign Key)
   - References: `rooms` table
   - Required: YES
   - Description: The room where the issue exists
   - ON DELETE: CASCADE

3. **task_id** (UUID, Foreign Key, Optional)
   - References: `tasks` table
   - Required: NO
   - Description: Optional link to the specific task where issue was reported
   - ON DELETE: SET NULL

4. **reported_by_user_id** (UUID, Foreign Key, Optional)
   - References: `users` table
   - Required: NO
   - Description: User who reported the issue
   - ON DELETE: SET NULL

5. **assigned_to_user_id** (UUID, Foreign Key, Optional)
   - References: `users` table
   - Required: NO
   - Description: User assigned to resolve the issue
   - ON DELETE: SET NULL

6. **title** (TEXT)
   - Required: YES
   - Description: Short title/name of the issue

7. **description** (TEXT)
   - Required: YES
   - Description: Detailed description of the issue

8. **status** (ENUM)
   - Type: `issue_status`
   - Values: `open`, `in_progress`, `resolved`, `closed`
   - Default: `open`
   - Description: Current status of the issue

9. **priority** (ENUM)
   - Type: `issue_priority`
   - Values: `low`, `medium`, `high`, `urgent`
   - Default: `medium`
   - Description: Priority level of the issue

10. **photo_url** (TEXT, Optional)
    - Required: NO
    - Description: URL to photo of the issue

11. **reported_at** (TIMESTAMPTZ)
    - Required: YES
    - Default: NOW()
    - Description: When the issue was reported

12. **resolved_at** (TIMESTAMPTZ, Optional)
    - Required: NO
    - Description: When the issue was resolved

13. **resolved_by_user_id** (UUID, Foreign Key, Optional)
    - References: `users` table
    - Required: NO
    - Description: User who resolved the issue
    - ON DELETE: SET NULL

14. **notes** (TEXT, Optional)
    - Required: NO
    - Description: Additional notes about the issue

15. **created_at** (TIMESTAMPTZ)
    - Required: YES
    - Default: NOW()
    - Description: When record was created

16. **updated_at** (TIMESTAMPTZ)
    - Required: YES
    - Default: NOW()
    - Description: Last update timestamp

### Enums to Create

**ENUM Name**: `issue_status`
Values:
- `open`
- `in_progress`
- `resolved`
- `closed`

**ENUM Name**: `issue_priority`
Values:
- `low`
- `medium`
- `high`
- `urgent`

### Indexes

Create the following indexes for better performance:

1. Index on `room_id`
   - Name: `idx_issues_room_id`
   - Column: `room_id`

2. Index on `task_id`
   - Name: `idx_issues_task_id`
   - Column: `task_id`

3. Index on `status`
   - Name: `idx_issues_status`
   - Column: `status`

4. Index on `reported_at`
   - Name: `idx_issues_reported_at`
   - Column: `reported_at`

5. Index on `assigned_to_user_id`
   - Name: `idx_issues_assigned_to`
   - Column: `assigned_to_user_id`

### Row Level Security (RLS)

Enable RLS and create the following policies:

#### 1. View Policy
- **Name**: "Authenticated users can view issues"
- **Operation**: SELECT
- **Condition**: `auth.uid() IS NOT NULL`
- **Description**: All authenticated users can view issues

#### 2. Insert Policy
- **Name**: "Reception and admin can create issues"
- **Operation**: INSERT
- **Condition**: User has `admin` OR `reception` role
- **Description**: Only reception and admin can create issues

#### 3. Update Policy
- **Name**: "Users can update relevant issues"
- **Operation**: UPDATE
- **Condition**: User has `admin` OR `reception` role OR is assigned to the issue
- **Description**: Admin/reception can update any issue, housekeeping can update assigned issues

#### 4. Delete Policy
- **Name**: "Admin and reception can delete issues"
- **Operation**: DELETE
- **Condition**: User has `admin` OR `reception` role
- **Description**: Only admin and reception can delete issues

### Triggers

#### 1. Auto-update `updated_at` timestamp
- **Trigger Name**: `issues_updated_at_trigger`
- **Event**: BEFORE UPDATE on `issues` table
- **Function**: Update `updated_at` to current timestamp

#### 2. Auto-set resolution data
- **Trigger Name**: `issue_resolution_trigger`
- **Event**: BEFORE UPDATE on `issues` table
- **Function**: 
  - When status changes to `resolved` or `closed`, automatically set `resolved_at` timestamp
  - Store the resolving user ID if not already set

### Realtime

Enable Supabase Realtime for the `issues` table so that changes are broadcast to all clients in real-time.

### Storage Buckets for Images

To support photo uploads for both tasks and issues, you need to configure two Supabase Storage buckets.

#### 1. Bucket Configurations

**Bucket 1: `task-photos`**
- **Public**: YES (set to public so images can be accessed via URL)
- **File Size Limit**: 5 MB
- **Allowed MIME Types**: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
- **Description**: For storing task-related images

**Bucket 2: `issue-photos`**
- **Public**: YES (set to public so images can be accessed via URL)
- **File Size Limit**: 5 MB
- **Allowed MIME Types**: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
- **Description**: For storing issue-related images

#### 2. Storage Policies (Row Level Security)

Create the following RLS policies for **both** buckets:

**For `task-photos` bucket:**

##### Policy 1: View/Download Images (task-photos)
- **Name**: "Anyone can view task images"
- **Operation**: SELECT (read/download)
- **Condition**: `bucket_id = 'task-photos'`
- **Description**: Public read access to task images

##### Policy 2: Upload Images (task-photos)
- **Name**: "Authenticated users can upload task images"
- **Operation**: INSERT (upload)
- **Condition**: `auth.uid() IS NOT NULL AND bucket_id = 'task-photos'`
- **Description**: Any authenticated user can upload images

##### Policy 3: Update Images (task-photos)
- **Name**: "Authenticated users can update task images"
- **Operation**: UPDATE (update/replace)
- **Condition**: `auth.uid() IS NOT NULL AND bucket_id = 'task-photos'`
- **Description**: Users can update/replace existing images

##### Policy 4: Delete Images (task-photos)
- **Name**: "Reception and admin can delete task images"
- **Operation**: DELETE
- **Condition**: User has `admin` OR `reception` role AND bucket_id = 'task-photos'
- **Description**: Only reception and admin can delete task images

**For `issue-photos` bucket:**

##### Policy 5: View/Download Images (issue-photos)
- **Name**: "Anyone can view issue images"
- **Operation**: SELECT (read/download)
- **Condition**: `bucket_id = 'issue-photos'`
- **Description**: Public read access to issue images

##### Policy 6: Upload Images (issue-photos)
- **Name**: "Authenticated users can upload issue images"
- **Operation**: INSERT (upload)
- **Condition**: `auth.uid() IS NOT NULL AND bucket_id = 'issue-photos'`
- **Description**: Any authenticated user can upload images

##### Policy 7: Update Images (issue-photos)
- **Name**: "Authenticated users can update issue images"
- **Operation**: UPDATE (update/replace)
- **Condition**: `auth.uid() IS NOT NULL AND bucket_id = 'issue-photos'`
- **Description**: Users can update/replace existing images

##### Policy 8: Delete Images (issue-photos)
- **Name**: "Reception and admin can delete issue images"
- **Operation**: DELETE
- **Condition**: User has `admin` OR `reception` role AND bucket_id = 'issue-photos'
- **Description**: Only reception and admin can delete issue images

#### 3. Storage Configuration Checklist

**For `task-photos` bucket:**
- [ ] Create `task-photos` storage bucket
- [ ] Set bucket to public
- [ ] Set file size limit to 5 MB
- [ ] Set allowed MIME types to `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
- [ ] Create view policy (public read access)
- [ ] Create upload policy (authenticated users)
- [ ] Create update policy (authenticated users)
- [ ] Create delete policy (reception and admin only)

**For `issue-photos` bucket:**
- [ ] Create `issue-photos` storage bucket
- [ ] Set bucket to public
- [ ] Set file size limit to 5 MB
- [ ] Set allowed MIME types to `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
- [ ] Create view policy (public read access)
- [ ] Create upload policy (authenticated users)
- [ ] Create update policy (authenticated users)
- [ ] Create delete policy (reception and admin only)

#### 4. Upload Path Structure

Images should be uploaded to the following path structure:

**For tasks:**
```
task-photos/
  └── {task_id}/{timestamp}.{ext}
```

**Example**: `task-photos/abc123_1699123456789.jpg`

**For issues:**
```
issue-photos/
  └── {issue_id}/{timestamp}.{ext}
```

**Example**: `issue-photos/xyz789_1699123456789.jpg`

#### 5. Usage Examples

**Upload a photo for a task:**
```javascript
// 1. Upload file to storage bucket
const fileExt = photoFile.name.split('.').pop();
const fileName = `${taskId}/${Date.now()}.${fileExt}`;

const { data: uploadData, error: uploadError } = await supabase.storage
  .from('task-photos')
  .upload(fileName, photoFile);

if (uploadError) throw uploadError;

// 2. Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('task-photos')
  .getPublicUrl(uploadData.path);

// 3. Store URL in database
await supabase.from('tasks')
  .update({ issue_photo: publicUrl })
  .eq('id', taskId);
```

**Upload a photo for an issue:**
```javascript
// 1. Upload file to storage bucket
const fileExt = photoFile.name.split('.').pop();
const fileName = `${issueId}/${Date.now()}.${fileExt}`;

const { data: uploadData, error: uploadError } = await supabase.storage
  .from('issue-photos')
  .upload(fileName, photoFile);

if (uploadError) throw uploadError;

// 2. Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('issue-photos')
  .getPublicUrl(uploadData.path);

// 3. Store URL in database
await supabase.from('issues')
  .update({ photo_url: publicUrl })
  .eq('id', issueId);
```

**Delete a photo from storage:**
```javascript
// Extract the file path from the public URL
const urlParts = photoUrl.split('/');
const filePath = urlParts.slice(urlParts.indexOf('issue-photos') + 1).join('/');

const { error } = await supabase.storage
  .from('issue-photos')
  .remove([filePath]);

if (error) throw error;
```

### Migration Notes

1. **Backward Compatibility**: The existing issue fields in `tasks` table (`issue_flag`, `issue_description`, `issue_photo`) should be kept for now to maintain backward compatibility

2. **Data Migration**: After creating the table, optionally migrate existing issues from tasks where `issue_flag = true`

3. **Optional Field**: Add `issue_id` column to `tasks` table to link tasks to issues (optional)

### Usage Examples

Create an issue linked to a task:
```sql
INSERT INTO issues (room_id, task_id, title, description, status, priority)
VALUES ('room-uuid', 'task-uuid', 'Broken shower', 'Shower handle is loose', 'open', 'high');
```

Create a standalone room issue:
```sql
INSERT INTO issues (room_id, title, description, status, priority)
VALUES ('room-uuid', 'AC not working', 'Air conditioning not cooling', 'open', 'urgent');
```

Assign an issue to a staff member:
```sql
UPDATE issues 
SET assigned_to_user_id = 'user-uuid', status = 'in_progress'
WHERE id = 'issue-uuid';
```

Resolve an issue:
```sql
UPDATE issues 
SET status = 'resolved', notes = 'Fixed by replacing the unit'
WHERE id = 'issue-uuid';
```

### Summary Checklist

**Database:**
- [ ] Create `issue_status` ENUM with 4 values
- [ ] Create `issue_priority` ENUM with 4 values
- [ ] Create `issues` table with all 16 fields
- [ ] Create 5 indexes
- [ ] Enable RLS
- [ ] Create 4 RLS policies
- [ ] Create 2 triggers
- [ ] Enable Supabase Realtime
- [ ] (Optional) Add `issue_id` column to `tasks` table
- [ ] (Optional) Migrate existing issue data

**Storage - Tasks:**
- [ ] Create `task-photos` storage bucket (public)
- [ ] Configure bucket file size limit (5 MB)
- [ ] Configure bucket allowed MIME types (JPEG, JPG, PNG, WebP)
- [ ] Create storage view policy (public read access)
- [ ] Create storage upload policy (authenticated users)
- [ ] Create storage update policy (authenticated users)
- [ ] Create storage delete policy (reception/admin only)

**Storage - Issues:**
- [ ] Create `issue-photos` storage bucket (public)
- [ ] Configure bucket file size limit (5 MB)
- [ ] Configure bucket allowed MIME types (JPEG, JPG, PNG, WebP)
- [ ] Create storage view policy (public read access)
- [ ] Create storage upload policy (authenticated users)
- [ ] Create storage update policy (authenticated users)
- [ ] Create storage delete policy (reception/admin only)

