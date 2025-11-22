# How to Update Admin Password

## Method 1: Supabase Dashboard (Recommended - Easiest)

1. **Go to Supabase Dashboard**
   - Navigate to your project
   - Click on **Authentication** in the left sidebar
   - Click on **Users**

2. **Find the Admin User**
   - Search for `admin@sleepwalker.com` in the users list
   - Click on the user to open their details

3. **Update Password**
   - Click **"Update user"** button (or the edit icon)
   - In the password field, enter the new password: `admin1234` (or your preferred password)
   - **Important**: Make sure **"Auto Confirm User"** is checked (if available)
   - Click **"Update"** or **"Save"**

4. **Verify**
   - The password is now updated
   - Try logging in with the new password

## Method 2: Using Admin API (Programmatic)

If you have access to the service role key, you can use the Supabase Admin API:

```javascript
// Using Supabase Admin Client
const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
  '600675ad-af15-4c72-b6d0-59d1b8e572a4', // auth user ID
  { password: 'admin1234' }
);
```

## Method 3: Password Reset Link (If User Can Access Email)

1. Go to your login page
2. Click "Forgot password" or "Reset password"
3. Enter `admin@sleepwalker.com`
4. Check email for reset link
5. Follow the link to set a new password

## Current Admin User Details

- **Email**: `admin@sleepwalker.com`
- **Auth ID**: `600675ad-af15-4c72-b6d0-59d1b8e572a4`
- **User ID**: `10b84c59-3717-4188-aee5-43470b91e8e5`

## Recommended Password

For development/testing: `admin1234`
For production: Use a strong, unique password





