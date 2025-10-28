# Next Steps After Migration Setup

## ✅ Completed
- [x] Created Supabase project
- [x] Updated environment variables (.env.local)
- [x] Ran all database migrations
- [x] Started development server

## 🔄 Next Steps to Complete Setup

### 1. Set Up Storage Buckets
Go to your Supabase dashboard → Storage and create:

**task-photos bucket:**
- Name: `task-photos`
- Public: ✅ Yes
- File size limit: 5MB
- Allowed MIME types: `image/jpeg,image/jpg,image/png,image/webp`

**issue-photos bucket:**
- Name: `issue-photos`  
- Public: ✅ Yes
- File size limit: 5MB
- Allowed MIME types: `image/jpeg,image/jpg,image/png,image/webp`

### 2. Set Up Storage RLS Policies
Run this SQL in Supabase SQL Editor:

```sql
-- Storage policies for task-photos
CREATE POLICY "Authenticated users can upload task photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'task-photos' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can view task photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'task-photos' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Reception and admin can delete task photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'task-photos' AND 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_id = auth.uid() AND role IN ('admin', 'reception')
  )
);

-- Storage policies for issue-photos
CREATE POLICY "Authenticated users can upload issue photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'issue-photos' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can view issue photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'issue-photos' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Reception and admin can delete issue photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'issue-photos' AND 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_id = auth.uid() AND role IN ('admin', 'reception')
  )
);
```

### 3. Create Admin User
1. Go to Supabase dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Fill in:
   - Email: `admin@example.com` (or your email)
   - Password: Create a strong password
   - Auto Confirm User: ✅ Check this
4. Click "Create user"
5. Copy the user's UUID from the auth.users table
6. Run this SQL to set admin role:

```sql
-- Replace YOUR_USER_AUTH_ID with the actual UUID from auth.users
UPDATE public.users 
SET role = 'admin' 
WHERE auth_id = 'YOUR_USER_AUTH_ID';

INSERT INTO public.user_roles (user_id, role)
VALUES ('YOUR_USER_AUTH_ID', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

### 4. Test the Application
1. Open your browser to `http://localhost:5173` (or the port shown in terminal)
2. Try logging in with your admin credentials
3. Test these features:
   - [ ] Can log in successfully
   - [ ] Can access admin dashboard
   - [ ] Can view users page
   - [ ] Can create new users
   - [ ] Can view tasks/issues
   - [ ] Can upload images (if storage is set up)

### 5. Add Sample Data (Optional)
If you want to test with sample data, you can add some rooms and tasks:

```sql
-- Add some sample rooms
INSERT INTO public.rooms (name, group_type, capacity) VALUES
('101', 'P1', 2),
('102', 'P1', 2),
('201', 'P2', 2),
('301', 'A1S', 2);

-- Add some sample tasks (after creating a user)
-- You'll need to replace the user_id with an actual user ID
```

## 🚨 Troubleshooting

### If you can't log in:
- Check that the admin user exists in both `auth.users` and `public.users` tables
- Verify the user has `role = 'admin'` in `public.users`
- Verify the user has an entry in `public.user_roles` table

### If you get 403 errors:
- Check that RLS policies are set up correctly
- Verify the user has the proper role in `user_roles` table
- Try clicking "Fix Admin Role" button in the Users page

### If storage uploads fail:
- Check that buckets are created and public
- Verify storage RLS policies are set up
- Check browser console for specific error messages

## 🎉 Success Indicators
- ✅ Can log in as admin
- ✅ Can access all admin features
- ✅ Can create new users
- ✅ Can manage tasks and issues
- ✅ Can upload images
- ✅ No console errors

## 📞 Need Help?
- Check browser console for errors
- Verify all SQL migrations ran successfully
- Check Supabase dashboard for any error logs
- Review the INDEPENDENT_SUPABASE_SETUP.md guide
