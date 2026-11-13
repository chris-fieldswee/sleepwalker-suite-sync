import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type User = Database['public']['Tables']['users']['Row'];
type UserRole = Database['public']['Enums']['user_role'];

// All privileged user management runs in the server-side function at /api/admin/users,
// which checks that the caller is an admin. The browser never holds a service credential.
const ENDPOINT = '/api/admin/users';

const authHeaders = async (): Promise<Record<string, string>> => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
};

const request = async <T>(path: string, init: RequestInit, fallbackError: string): Promise<T> => {
  const response = await fetch(path, { ...init, headers: await authHeaders() });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON response (e.g. the API route is not running in this environment).
  }
  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error;
    throw new Error(message || `${fallbackError} (HTTP ${response.status})`);
  }
  return body as T;
};

export const adminApi = {
  async fetchUsers(): Promise<User[]> {
    const result = await request<{ data: User[] }>(ENDPOINT, { method: 'GET' }, 'Failed to fetch users');
    return result?.data || [];
  },

  async createUser(params: {
    email: string;
    password: string;
    name: string;
    first_name?: string;
    last_name?: string;
    role: UserRole;
    active?: boolean;
  }): Promise<{ user: User; authUser: { id: string; email: string } }> {
    const result = await request<{ data: User; authUser: { id: string; email: string } }>(
      ENDPOINT,
      { method: 'POST', body: JSON.stringify(params) },
      'Failed to create user',
    );
    return { user: result.data, authUser: result.authUser };
  },

  async updateUser(
    userId: string,
    params: {
      name?: string;
      first_name?: string;
      last_name?: string;
      role?: UserRole;
      active?: boolean;
      password?: string;
      // Accepted for backward compatibility with callers; the server derives the login account itself.
      auth_id?: string;
    },
  ): Promise<void> {
    const { auth_id: _ignored, ...body } = params;
    await request(
      `${ENDPOINT}?id=${encodeURIComponent(userId)}`,
      { method: 'PUT', body: JSON.stringify(body) },
      'Failed to update user',
    );
  },

  async deleteUser(userId: string, _authId?: string | null): Promise<void> {
    await request(
      `${ENDPOINT}?id=${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
      'Failed to delete user',
    );
  },

  // Kept for existing callers: admin operations are always available through the API.
  isAvailable(): boolean {
    return true;
  },
};
