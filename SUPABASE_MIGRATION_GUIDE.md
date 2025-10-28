# Supabase Cloud Migration Guide

## Step 1: Get Your Supabase Project Credentials

1. **Go to your Supabase project in Lovable**
2. **Navigate to Settings > API**
3. **Copy the following:**
   - Project URL (e.g., `https://your-project-id.supabase.co`)
   - Anon/Public Key (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

## Step 2: Create Environment File

Create a `.env.local` file in your project root with:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
```

## Step 3: Database Migration

### Option A: Using Supabase CLI (Recommended)

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase:**
   ```bash
   supabase login
   ```

3. **Link your project:**
   ```bash
   supabase link --project-ref your-project-id
   ```

4. **Push migrations:**
   ```bash
   supabase db push
   ```

### Option B: Manual SQL Execution

1. **Go to your Supabase project dashboard**
2. **Navigate to SQL Editor**
3. **Run each migration file in order:**

   - `20251023101429_11faa264-0d00-4395-b2d2-b41e6c67d783.sql`
   - `20251024082128_83f9623d-2be1-4d0f-a681-cf256838d247.sql`
   - `20251026103030_2f3b28c6-803c-4d35-bc2a-60c8a0cdc791.sql`
   - `20251027122118_45dedf70-5ecb-418e-8e2f-4dddf57b99b7.sql`
   - `20251027122603_7e3ad47d-aab3-4014-8b67-8037be3190fe.sql`
   - `20251027132011_030d3e0f-6ff5-448c-9fa6-2e56c02067dc.sql`
   - `20250101_create_issues_table.sql`

## Step 4: Storage Buckets Setup

1. **Go to Storage in your Supabase dashboard**
2. **Create these buckets:**

   **task-photos bucket:**
   - Name: `task-photos`
   - Public: Yes
   - File size limit: 5MB
   - Allowed MIME types: `image/jpeg, image/jpg, image/png, image/webp`

   **issue-photos bucket:**
   - Name: `issue-photos`
   - Public: Yes
   - File size limit: 5MB
   - Allowed MIME types: `image/jpeg, image/jpg, image/png, image/webp`

3. **Set up RLS policies for each bucket:**

   **For task-photos:**
   ```sql
   -- Allow authenticated users to upload/view
   CREATE POLICY "Authenticated users can upload task photos" ON storage.objects
   FOR INSERT WITH CHECK (bucket_id = 'task-photos' AND auth.role() = 'authenticated');
   
   CREATE POLICY "Authenticated users can view task photos" ON storage.objects
   FOR SELECT USING (bucket_id = 'task-photos' AND auth.role() = 'authenticated');
   
   -- Allow reception/admin to delete
   CREATE POLICY "Reception and admin can delete task photos" ON storage.objects
   FOR DELETE USING (
     bucket_id = 'task-photos' AND 
     EXISTS (
       SELECT 1 FROM public.user_roles 
       WHERE user_id = auth.uid() AND role IN ('admin', 'reception')
     )
   );
   ```

   **For issue-photos:**
   ```sql
   -- Allow authenticated users to upload/view
   CREATE POLICY "Authenticated users can upload issue photos" ON storage.objects
   FOR INSERT WITH CHECK (bucket_id = 'issue-photos' AND auth.role() = 'authenticated');
   
   CREATE POLICY "Authenticated users can view issue photos" ON storage.objects
   FOR SELECT USING (bucket_id = 'issue-photos' AND auth.role() = 'authenticated');
   
   -- Allow reception/admin to delete
   CREATE POLICY "Reception and admin can delete issue photos" ON storage.objects
   FOR DELETE USING (
     bucket_id = 'issue-photos' AND 
     EXISTS (
       SELECT 1 FROM public.user_roles 
       WHERE user_id = auth.uid() AND role IN ('admin', 'reception')
     )
   );
   ```

## Step 5: Create Admin User

1. **Go to Authentication > Users in Supabase dashboard**
2. **Create a new user with admin role**
3. **Or update existing user's role:**

   ```sql
   -- Update user role in users table
   UPDATE public.users 
   SET role = 'admin' 
   WHERE auth_id = 'user-auth-id-here';
   
   -- Add role to user_roles table
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('user-auth-id-here', 'admin')
   ON CONFLICT (user_id, role) DO NOTHING;
   ```

## Step 6: Test Connection

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Test login with admin user**
3. **Verify all functionality works**

## Step 7: Update Types (if needed)

If you make any schema changes, regenerate types:

```bash
supabase gen types typescript --project-id your-project-id > src/integrations/supabase/types.ts
```

## Troubleshooting

- **403 Errors:** Check user roles in both `users` and `user_roles` tables
- **Connection Issues:** Verify environment variables are correct
- **Migration Errors:** Run migrations in the correct order
- **Storage Issues:** Check bucket policies and permissions
