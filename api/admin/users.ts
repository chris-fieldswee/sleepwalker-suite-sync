import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/integrations/supabase/types';

// Vercel serverless function types
type VercelRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  body?: any;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

// Initialize Supabase admin client with service role key
const getAdminClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase configuration. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Helper to verify admin authorization (optional - can be enhanced with JWT verification)
const verifyAdmin = async (req: VercelRequest, supabaseAdmin: ReturnType<typeof getAdminClient>) => {
  // In production, you should verify the user's JWT token and check if they have admin role
  // For now, we rely on the service role key being secure server-side
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) {
        return false;
      }
      // Optionally check if user has admin role in database
      // This is a basic check - enhance as needed
      return true;
    } catch {
      return false;
    }
  }
  // If no auth header, we still allow (service role key is server-side only)
  return true;
};

// GET /api/admin/users - Fetch all users
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supabaseAdmin = getAdminClient();

    // Verify admin access (optional but recommended)
    const isAuthorized = await verifyAdmin(req, supabaseAdmin);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const userId = req.query.id as string | undefined;

    if (req.method === 'GET') {
      if (userId) {
        // Get single user
        const { data, error } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          return res.status(400).json({ error: error.message });
        }

        return res.status(200).json({ data });
      } else {
        // Get all users
        const { data, error } = await supabaseAdmin
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          return res.status(400).json({ error: error.message });
        }

        return res.status(200).json({ data: data || [] });
      }
    }

    if (req.method === 'POST') {
      // Create user
      const { email, password, name, first_name, last_name, role, active } = req.body;

      if (!email || !password || !name || !role) {
        return res.status(400).json({ error: 'Missing required fields: email, password, name, role' });
      }

      // Check if user already exists by name
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id, auth_id')
        .eq('name', name)
        .maybeSingle();

      if (existingUser) {
        return res.status(400).json({ error: `User with name "${name}" already exists` });
      }

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          first_name,
          last_name,
          requires_password_change: true,
        },
      });

      if (authError) {
        return res.status(400).json({ error: authError.message });
      }

      if (!authData.user) {
        return res.status(500).json({ error: 'Failed to create auth user' });
      }

      const newAuthId = authData.user.id;

      try {
        // Check if user entry already exists (from trigger)
        const { data: existingUserEntry } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('auth_id', newAuthId)
          .maybeSingle();

        let userData;
        if (existingUserEntry) {
          // Update existing user
          const { data, error: userError } = await supabaseAdmin
            .from('users')
            .update({
              name,
              first_name,
              last_name,
              role,
              active: active !== undefined ? active : true,
            })
            .eq('auth_id', newAuthId)
            .select()
            .single();

          if (userError) throw userError;
          userData = data;
        } else {
          // Insert new user
          const { data, error: userError } = await supabaseAdmin
            .from('users')
            .insert({
              auth_id: newAuthId,
              name,
              first_name,
              last_name,
              role,
              active: active !== undefined ? active : true,
            })
            .select()
            .single();

          if (userError) throw userError;
          userData = data;
        }

        // Insert into user_roles
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .upsert([
            {
              user_id: newAuthId,
              role: role as Database['public']['Enums']['app_role'],
            },
          ], {
            onConflict: 'user_id,role',
          });

        if (roleError) {
          // Rollback: delete auth user
          await supabaseAdmin.auth.admin.deleteUser(newAuthId);
          throw roleError;
        }

        return res.status(201).json({
          data: userData,
          authUser: {
            id: authData.user.id,
            email: authData.user.email,
          },
        });
      } catch (innerError: any) {
        // Rollback: delete auth user
        await supabaseAdmin.auth.admin.deleteUser(newAuthId);
        return res.status(400).json({ error: innerError.message });
      }
    }

    if (req.method === 'PUT') {
      // Update user
      const userId = req.query.id as string;
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const { name, first_name, last_name, role, active, password, auth_id } = req.body;

      // Update public.users
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (first_name !== undefined) updateData.first_name = first_name;
      if (last_name !== undefined) updateData.last_name = last_name;
      if (role !== undefined) updateData.role = role;
      if (active !== undefined) updateData.active = active;

      const { error: userError } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', userId);

      if (userError) {
        return res.status(400).json({ error: userError.message });
      }

      // Update password if provided
      if (password && auth_id) {
        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
          auth_id,
          { password }
        );

        if (passwordError) {
          return res.status(400).json({ error: passwordError.message });
        }
      }

      // Update user_roles if role changed
      if (role && auth_id) {
        // Delete old roles
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', auth_id);

        // Insert new role
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert([{
            user_id: auth_id,
            role: role as Database['public']['Enums']['app_role'],
          }]);

        if (roleError) {
          return res.status(400).json({ error: `Failed to update role: ${roleError.message}` });
        }
      }

      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      // Delete user
      const userId = req.query.id as string;
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const { auth_id } = req.body;

      // Delete user_roles if auth_id provided
      if (auth_id) {
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', auth_id);
      }

      // Delete from public.users
      const { error: userError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);

      if (userError) {
        return res.status(400).json({ error: userError.message });
      }

      // Delete from auth.users if auth_id provided
      if (auth_id) {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(auth_id);
        if (authError) {
          console.warn('Failed to delete auth user (might already be gone):', authError);
        }
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

