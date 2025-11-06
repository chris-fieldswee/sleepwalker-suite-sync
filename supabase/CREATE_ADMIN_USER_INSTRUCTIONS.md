# Create Admin User - Step by Step Instructions

## Quick Summary
1. Create user in Supabase Dashboard
2. Copy the User UUID
3. Run SQL script with the UUID
4. Verify the setup

---

## Step 1: Create User in Supabase Dashboard

1. **Go to Supabase Dashboard**
   - Navigate to your project
   - Click **Authentication** in the left sidebar
   - Click **Users**

2. **Add New User**
   - Click **"Add user"** button (top right)
   - Select **"Create new user"**

3. **Fill in User Details**
   - **Email**: `admin@sleepwalker.com`
   - **Password**: `admin1234` (or your preferred password)
   - **✅ Check "Auto Confirm User"** (important!)
   - Leave other fields as default

4. **Create User**
   - Click **"Create user"**
   - The user will be created in `auth.users` table

5. **Copy the User UUID**
   - After creation, you'll see the user details
   - **Copy the User UUID** (it looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
   - You'll need this for Step 2

---

## Step 2: Run SQL Script

1. **Open Supabase SQL Editor**
   - Go to **SQL Editor** in the left sidebar
   - Click **"New query"**

2. **Open the SQL Script**
   - Open `supabase/create_admin_user.sql` in your project
   - Copy the entire script

3. **Replace the UUID**
   - Find this line: `v_auth_id UUID := 'YOUR_AUTH_ID_HERE';`
   - Replace `YOUR_AUTH_ID_HERE` with the UUID you copied in Step 1
   - Example: `v_auth_id UUID := '600675ad-af15-4c72-b6d0-59d1b8e572a4';`

4. **Run the Script**
   - Paste the modified script into SQL Editor
   - Click **"Run"** or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - You should see success messages

---

## Step 3: Verify the Setup

1. **Run Verification Query**
   - The script includes a verification query at the bottom
   - Or run `supabase/verify_password_update.sql`
   - You should see: `✓ User is properly configured - ready to log in!`

2. **Check All Components**
   - ✅ User exists in `auth.users`
   - ✅ User exists in `public.users` with `role = 'admin'`
   - ✅ User has entry in `public.user_roles` with `role = 'admin'`
   - ✅ User is `active = true`
   - ✅ Email is confirmed

---

## Step 4: Test Login

1. **Go to Your Application**
   - Open `http://localhost:8080` (or your dev server URL)
   - Navigate to login page

2. **Log In**
   - **Email**: `admin@sleepwalker.com`
   - **Password**: `admin1234` (or the password you set)
   - Click **"Sign In"**

3. **Verify Access**
   - You should be redirected to the admin dashboard
   - You should have access to all admin features

---

## Troubleshooting

### If login fails with 400 error:
- ✅ Check that email is confirmed (should be auto-confirmed if you checked the box)
- ✅ Verify the password is correct
- ✅ Wait 1-2 minutes if you just created the user (auth service may need to sync)
- ✅ Check browser console for detailed error message

### If user doesn't have admin access:
- ✅ Run the verification query to check all components
- ✅ Ensure `public.users.role = 'admin'`
- ✅ Ensure `public.user_roles.role = 'admin'`
- ✅ Ensure `public.users.active = true`

### If SQL script fails:
- ✅ Make sure you replaced `YOUR_AUTH_ID_HERE` with the actual UUID
- ✅ Verify the user exists in `auth.users` first
- ✅ Check that the UUID format is correct (should have hyphens)

---

## Quick Reference

**User Details:**
- Email: `admin@sleepwalker.com`
- Password: `admin1234` (or your chosen password)
- Role: `admin`
- Status: `active`

**Files:**
- Create script: `supabase/create_admin_user.sql`
- Verify script: `supabase/verify_password_update.sql`

