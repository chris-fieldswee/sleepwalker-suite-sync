# Independent Supabase Setup Guide

This guide will help you set up a completely independent Supabase project, separate from Lovable cloud.

## Step 1: Create a Supabase Project

### Option A: Using Supabase Dashboard (Recommended)

1. **Go to Supabase**
   - Visit: https://supabase.com
   - Sign in or create an account

2. **Create New Project**
   - Click "New Project"
   - Fill in the details:
     - **Name:** sleepwalker-suite-sync
     - **Database Password:** Create a strong password (save this!)
     - **Region:** Choose the closest region to your users
     - **Pricing Plan:** Free tier is sufficient for now
   - Click "Create new project"
   - Wait 2-3 minutes for the project to initialize

3. **Get Your Project Credentials**
   - Once the project is ready, go to **Settings > API**
   - You'll find:
     - **Project URL** (e.g., `https://xxxxxxxxxxxxx.supabase.co`)
     - **Anon/Public Key** (starts with `eyJ...`)
     - **Service Role Key** (starts with `eyJ...`)

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Create a new project
supabase projects create sleepwalker-suite-sync

# Get project credentials
supabase projects list
```

## Step 2: Set Up Environment Variables

1. **Create `.env.local` file** in your project root:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here

# Optional: Service Role Key (for admin operations)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

2. **Replace the values** with your actual project credentials from Step 1

3. **Update your Supabase client** to use environment variables (already configured in `src/integrations/supabase/client.ts`)

## Step 3: Apply Database Migrations

You need to run all your migrations in order on the new Supabase instance.

### Option A: Using Supabase Dashboard (SQL Editor)

1. **Go to SQL Editor** in your Supabase dashboard
2. **Run each migration file in order:**

   Run the SQL content from each file in this exact order:

   ```
   1. supabase/migrations/20251023101429_11faa264-0d00-4395-b2d2-b41e6c67d783.sql
   2. supabase/migrations/20251024082128_83f9623d-2be1-4d0f-a681-cf256838d247.sql
   3. supabase/migrations/20251026103030_2f3b28c6-803c-4d35-bc2a-60c8a0cdc791.sql
   4. supabase/migrations/20251027122118_45dedf70-5ecb-418e-8e2f-4dddf57b99b7.sql
   5. supabase/migrations/20251027122603_7e3ad47d-aab3-4014-8b67-8037be3190fe.sql
   6. supabase/migrations/20251027132011_030d3e0f-6ff5-448c-9fa6-2e56c02067dc.sql
   7. supabase/migrations/20250101_create_issues_table.sql
   8. supabase/migrations/20250102_fix_user_roles_recursion.sql
   ```

### Option B: Using Supabase CLI

```bash
# Link your local project to the remote Supabase project
supabase link --project-ref your-project-id

# Push all migrations
supabase db push
```

## Step 4: Configure Storage Buckets

1. **Go to Storage** in your Supabase dashboard
2. **Create each bucket** with these settings:

### task-photos Bucket
- **Name:** `task-photos`
- **Public:** ✅ Yes (check this box)
- **File size limit:** 5MB (5242880 bytes)
- **Allowed MIME types:** `image/jpeg,image/jpg,image/png,image/webp`

### issue-photos Bucket
- **Name:** `issue-photos`
- **Public:** ✅ Yes (check this box)
- **File size limit:** 5MB (5242880 bytes)
- **Allowed MIME types:** `image/jpeg,image/jpg,image/png,image/webp`

3. **Set up RLS Policies for Storage** (run in SQL Editor):

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

## Step 5: Create Admin User

1. **Go to Authentication > Users** in Supabase dashboard
2. **Click "Add user"** → **"Create new user"**
3. **Fill in:**
   - Email: `admin@example.com` (or your preferred email)
   - Password: Create a strong password
   - Auto Confirm User: ✅ Check this box
4. **Click "Create user"**
5. **After the user is created, run this SQL** to set the admin role:

```sql
-- Update user role in users table
UPDATE public.users 
SET role = 'admin' 
WHERE auth_id = 'YOUR_USER_AUTH_ID';

-- Add admin role to user_roles table
INSERT INTO public.user_roles (user_id, role)
VALUES ('YOUR_USER_AUTH_ID', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

Replace `YOUR_USER_AUTH_ID` with the actual UUID from the auth.users table.

## Step 6: Test the Connection

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Try logging in** with your admin user credentials

3. **Verify functionality:**
   - ✅ Can log in
   - ✅ Can access admin dashboard
   - ✅ Can view users
   - ✅ Can create new users
   - ✅ Can manage tasks/issues

## Step 7: Update Supabase Types (Optional)

If you make any schema changes, regenerate types:

```bash
# Using Supabase CLI
supabase gen types typescript --project-id your-project-id > src/integrations/supabase/types.ts
```

Or manually download from: **Settings > API > Generate TypeScript Types**

## Step 8: Deploy to Production

When ready to deploy:

1. **Update environment variables** in your hosting platform (Vercel, Netlify, etc.)
2. **Add both variables:**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

## Troubleshooting

### Common Issues

**Issue:** Can't connect to Supabase
- **Solution:** Check that `.env.local` has the correct credentials and that your app is reading the file

**Issue:** RLS policies blocking access
- **Solution:** Verify that your user has the correct role in both `users` and `user_roles` tables

**Issue:** Storage upload fails
- **Solution:** Check that buckets are public and RLS policies are set up correctly

**Issue:** Can't create users
- **Solution:** Make sure the admin user has both `role = 'admin'` in users table AND an entry in user_roles table

### Getting Help

- **Supabase Documentation:** https://supabase.com/docs
- **Supabase Discord:** https://discord.supabase.com
- **Supabase GitHub:** https://github.com/supabase/supabase

## Summary Checklist

- [ ] Created Supabase project
- [ ] Got project credentials (URL and keys)
- [ ] Created `.env.local` with credentials
- [ ] Ran all migrations in order
- [ ] Created storage buckets (task-photos, issue-photos)
- [ ] Set up storage RLS policies
- [ ] Created admin user in Authentication
- [ ] Set admin role in users and user_roles tables
- [ ] Tested login and basic functionality
- [ ] Updated production environment variables (when deploying)
