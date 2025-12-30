/**
 * @deprecated This file is kept for backward compatibility with local development.
 * 
 * ⚠️ SECURITY WARNING: This client exposes the service role key in the client bundle.
 * 
 * For production deployments, use the admin API client instead:
 * - Import: `import { adminApi } from '@/lib/admin-api'`
 * - The admin API uses secure Vercel serverless functions that keep the service role key server-side
 * 
 * Migration guide:
 * - User management operations: Use `adminApi.fetchUsers()`, `adminApi.createUser()`, etc.
 * - This client is still used for non-user operations (rooms, tasks) as a fallback for RLS bypass
 * - In production, the admin API automatically routes to secure API endpoints
 * - In development, it falls back to this client if VITE_SUPABASE_SERVICE_ROLE_KEY is set
 * 
 * See: src/lib/admin-api.ts for the secure implementation
 */

// Create a separate Supabase client for admin operations
// This file creates a client with service role key for admin operations

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// Note: Service role key must be prefixed with VITE_ to be accessible in client-side code
// ⚠️ SECURITY WARNING: Exposing service role key client-side is a security risk
// In production, use the admin API (src/lib/admin-api.ts) which routes through secure serverless functions
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
const IS_PROD = import.meta.env.MODE === 'production';

if (!SUPABASE_URL) {
  throw new Error('VITE_SUPABASE_URL environment variable is required');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Admin client disabled: no service role key present.');
}

// Admin client with service role key for admin operations
// Only create if service role key is available
// 
// ⚠️ DEPRECATED: This is kept for backward compatibility and local development only.
// For user management operations, use adminApi from '@/lib/admin-api' instead.
// This client may still be used for non-user operations (rooms, tasks) as an RLS bypass fallback.
// 
// SECURITY WARNING: The service role key is exposed in the client bundle when using VITE_ prefix.
// In production, the admin API routes through secure serverless functions instead.
// 
// Use singleton pattern to avoid multiple GoTrueClient instances
const getSingletonAdminClient = () => {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  
  const g = globalThis as unknown as { __supabaseAdminClient?: ReturnType<typeof createClient<Database>> };
  if (!g.__supabaseAdminClient) {
    g.__supabaseAdminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { 
        autoRefreshToken: false, 
        persistSession: false,
        // Use a different storage key to avoid conflicts with regular client
        storageKey: 'sb-admin-auth',
        // Use memory storage instead of localStorage to avoid conflicts
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      }
    });
  }
  return g.__supabaseAdminClient;
};

export const supabaseAdmin = getSingletonAdminClient();

// Helper function to check if admin client is available
export const isAdminClientAvailable = () => !!supabaseAdmin;
