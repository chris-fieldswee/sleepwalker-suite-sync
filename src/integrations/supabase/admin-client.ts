// Create a separate Supabase client for admin operations
// This file creates a client with service role key for admin operations

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// Note: Service role key must be prefixed with VITE_ to be accessible in client-side code
// ⚠️ SECURITY WARNING: Exposing service role key client-side is a security risk
// In production, consider using a backend API instead of direct admin client access
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error('VITE_SUPABASE_URL environment variable is required');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY not found. Admin features requiring service role access will not work.');
}

// Admin client with service role key for admin operations
// Only create if service role key is available
export const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient<Database>(
      SUPABASE_URL, 
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  : null;

// Helper function to check if admin client is available
export const isAdminClientAvailable = () => !!SUPABASE_SERVICE_ROLE_KEY;
