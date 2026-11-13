# Setup Instructions

## Environment Variables

Create a `.env.local` file in the root directory with the following content:

```bash
VITE_SUPABASE_URL=https://wxxrprwnovnyncgigrwi.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<redacted>
# Server-side only (never VITE_-prefixed): SUPABASE_SERVICE_ROLE_KEY=<secret key>
```

⚠️ **Note**: The service role key must be prefixed with `VITE_` to be accessible in client-side Vite code. This is a security consideration - in production, consider using a backend API for admin operations.

## Running the Application

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Access the application:**
   - Open `http://localhost:8080` in your browser

## Testing Authentication

### Test User Credentials

- **Admin User:**
  - Email: `admin@sleepwalker.com`
  - Password: `admin123`

## Recent Fixes

1. ✅ **Simplified AuthContext** - Removed complex timeout logic
2. ✅ **Clean Supabase client configuration** - No hardcoded credentials
3. ✅ **Removed debugging code** - Clean console output
4. ✅ **Fixed RLS policies** - Users can access their own profiles
5. ✅ **Cleaned up temporary files** - Removed SQL scripts and debugging files

## Migration to Run

Run the latest migration to fix RLS policies:

```bash
supabase db push
```

This will apply the migration `20250105_fix_users_rls_simple.sql` which allows users to access their own profiles.
