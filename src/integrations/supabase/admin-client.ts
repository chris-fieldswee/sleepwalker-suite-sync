// Create a separate Supabase client for admin operations
// This file creates a client with service role key for admin operations

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://wxxrprwnovnyncgigrwi.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eHJwcndub3ZueW5jZ2lncndpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0ODE4MSwiZXhwIjoyMDc3MjI0MTgxfQ.3sSBNq7MT_dpIVGk9OINteoUOQu9Y-8_HX1B1at-oVs";

if (!SUPABASE_URL) {
  throw new Error('VITE_SUPABASE_URL is required');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

// Admin client with service role key for admin operations
export const supabaseAdmin = createClient<Database>(
  SUPABASE_URL, 
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
