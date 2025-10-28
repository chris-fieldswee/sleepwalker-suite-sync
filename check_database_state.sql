-- Check what already exists in the database
-- Run this in Supabase SQL Editor to see what's already created

-- Check if enum types exist
SELECT 
  typname as enum_name,
  enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE typname IN ('issue_status', 'issue_priority', 'user_role', 'app_role')
ORDER BY typname, enumlabel;

-- Check if tables exist
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('issues', 'users', 'user_roles', 'rooms', 'tasks', 'work_logs', 'limits')
ORDER BY tablename;

-- Check if functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('has_role', 'fix_admin_role', 'update_issues_updated_at', 'set_issue_resolution_data')
ORDER BY routine_name;
