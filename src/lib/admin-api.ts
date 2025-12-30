import { supabaseAdmin, isAdminClientAvailable } from '@/integrations/supabase/admin-client';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type User = Database['public']['Tables']['users']['Row'];
type UserRole = Database['public']['Enums']['user_role'];

// Determine if we should use API routes (production) or direct admin client (development)
const shouldUseApiRoutes = () => {
  // Use API routes in production, fallback to admin client in development
  return import.meta.env.PROD && !import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
};

// Get auth token for API requests
const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
};

// API client for admin operations
export const adminApi = {
  // Fetch all users
  async fetchUsers(): Promise<User[]> {
    if (shouldUseApiRoutes()) {
      const token = await getAuthToken();
      const response = await fetch('/api/admin/users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch users');
      }

      const result = await response.json();
      return result.data || [];
    } else {
      // Fallback to direct admin client in development
      if (!supabaseAdmin) {
        throw new Error('Admin client not available. Set VITE_SUPABASE_SERVICE_ROLE_KEY for local development.');
      }

      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  },

  // Create user
  async createUser(params: {
    email: string;
    password: string;
    name: string;
    first_name?: string;
    last_name?: string;
    role: UserRole;
    active?: boolean;
  }): Promise<{ user: User; authUser: { id: string; email: string } }> {
    if (shouldUseApiRoutes()) {
      const token = await getAuthToken();
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }

      const result = await response.json();
      return {
        user: result.data,
        authUser: result.authUser,
      };
    } else {
      // Fallback to direct admin client in development
      if (!supabaseAdmin) {
        throw new Error('Admin client not available. Set VITE_SUPABASE_SERVICE_ROLE_KEY for local development.');
      }

      // Check if user already exists by name
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id, auth_id')
        .eq('name', params.name)
        .maybeSingle();

      if (existingUser) {
        throw new Error(`User with name "${params.name}" already exists`);
      }

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: params.email,
        password: params.password,
        email_confirm: true,
        user_metadata: {
          name: params.name,
          first_name: params.first_name,
          last_name: params.last_name,
          requires_password_change: true,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create auth user');

      const newAuthId = authData.user.id;

      try {
        // Check if user entry already exists (from trigger)
        const { data: existingUserEntry } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('auth_id', newAuthId)
          .maybeSingle();

        let userData: User;
        if (existingUserEntry) {
          // Update existing user
          const { data, error: userError } = await supabaseAdmin
            .from('users')
            .update({
              name: params.name,
              first_name: params.first_name,
              last_name: params.last_name,
              role: params.role,
              active: params.active !== undefined ? params.active : true,
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
              name: params.name,
              first_name: params.first_name,
              last_name: params.last_name,
              role: params.role,
              active: params.active !== undefined ? params.active : true,
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
              role: params.role as Database['public']['Enums']['app_role'],
            },
          ], {
            onConflict: 'user_id,role',
          });

        if (roleError) {
          // Rollback: delete auth user
          await supabaseAdmin.auth.admin.deleteUser(newAuthId);
          throw roleError;
        }

        return {
          user: userData,
          authUser: {
            id: authData.user.id,
            email: authData.user.email || params.email,
          },
        };
      } catch (innerError: any) {
        // Rollback: delete auth user
        await supabaseAdmin.auth.admin.deleteUser(newAuthId);
        throw innerError;
      }
    }
  },

  // Update user
  async updateUser(
    userId: string,
    params: {
      name?: string;
      first_name?: string;
      last_name?: string;
      role?: UserRole;
      active?: boolean;
      password?: string;
      auth_id?: string;
    }
  ): Promise<void> {
    if (shouldUseApiRoutes()) {
      const token = await getAuthToken();
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user');
      }
    } else {
      // Fallback to direct admin client in development
      const client = supabaseAdmin ?? supabase;

      // Update public.users
      const updateData: any = {};
      if (params.name !== undefined) updateData.name = params.name;
      if (params.first_name !== undefined) updateData.first_name = params.first_name;
      if (params.last_name !== undefined) updateData.last_name = params.last_name;
      if (params.role !== undefined) updateData.role = params.role;
      if (params.active !== undefined) updateData.active = params.active;

      const { error: userError } = await client
        .from('users')
        .update(updateData)
        .eq('id', userId);

      if (userError) {
        if (!supabaseAdmin && userError.code === '42501') {
          throw new Error('Update blocked by RLS. Log in as administrator or configure service role key.');
        }
        throw userError;
      }

      // Update password if provided
      if (params.password && params.auth_id) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        if (currentUser?.id === params.auth_id) {
          // Self-update
          const { error: passwordError } = await supabase.auth.updateUser({
            password: params.password,
          });
          if (passwordError) throw passwordError;
        } else if (supabaseAdmin) {
          // Admin update
          const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
            params.auth_id,
            { password: params.password }
          );
          if (passwordError) throw passwordError;
        } else {
          throw new Error('Cannot change another user\'s password without admin privileges.');
        }
      }

      // Update user_roles if role changed
      if (params.role && params.auth_id) {
        // Delete old roles
        await client
          .from('user_roles')
          .delete()
          .eq('user_id', params.auth_id);

        // Insert new role
        const { error: roleError } = await client
          .from('user_roles')
          .insert([{
            user_id: params.auth_id,
            role: params.role as Database['public']['Enums']['app_role'],
          }]);

        if (roleError) {
          throw new Error(`Failed to update role: ${roleError.message}`);
        }
      }
    }
  },

  // Delete user
  async deleteUser(userId: string, authId: string | null): Promise<void> {
    if (shouldUseApiRoutes()) {
      const token = await getAuthToken();
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ auth_id: authId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }
    } else {
      // Fallback to direct admin client in development
      if (!supabaseAdmin) {
        throw new Error('Admin client not available. User deletion requires VITE_SUPABASE_SERVICE_ROLE_KEY');
      }

      // Delete user_roles if auth_id provided
      if (authId) {
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', authId);
      }

      // Delete from public.users
      const { error: userError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);

      if (userError) throw userError;

      // Delete from auth.users if auth_id provided
      if (authId) {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(authId);
        if (authError) {
          console.warn('Failed to delete auth user (might already be gone):', authError);
        }
      }
    }
  },

  // Check if admin operations are available
  isAvailable(): boolean {
    if (shouldUseApiRoutes()) {
      // In production, API routes should always be available
      return true;
    }
    return isAdminClientAvailable();
  },
};

