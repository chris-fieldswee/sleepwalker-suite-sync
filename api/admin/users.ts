import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/integrations/supabase/types';
import {
  authorizeAdmin,
  isUuid,
  parseCreateUser,
  parseUpdateUser,
  type Role,
} from '../../src/lib/admin-authz';

// Vercel serverless function types
type VercelRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

type AdminClient = ReturnType<typeof createClient<Database>>;

// The service credential lives only in server-side environment variables.
// It must never be exposed through a VITE_-prefixed variable.
const getAdminClient = (): AdminClient => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const fail = (res: VercelResponse, status: number, error: string, cause?: unknown) => {
  if (cause) console.error(`[api/admin/users] ${error}:`, cause);
  return res.status(status).json({ error });
};

// Replace the user's roles with exactly `role`, adding the new one before
// removing the others so a failure never leaves the account without a role.
const setRole = async (client: AdminClient, authId: string, role: Role) => {
  const { error: upsertError } = await client
    .from('user_roles')
    .upsert([{ user_id: authId, role }], { onConflict: 'user_id,role' });
  if (upsertError) throw upsertError;

  const { error: deleteError } = await client
    .from('user_roles')
    .delete()
    .eq('user_id', authId)
    .neq('role', role);
  if (deleteError) throw deleteError;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Same-origin only: no CORS headers are sent, so other sites cannot call this from a browser.
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let client: AdminClient;
  try {
    client = getAdminClient();
  } catch (error) {
    return fail(res, 500, 'Server misconfigured', error);
  }

  const auth = await authorizeAdmin(req.headers.authorization, client);
  if (!auth.ok) {
    return fail(res, auth.status, auth.error);
  }

  const idParam = req.query.id;
  const userId = Array.isArray(idParam) ? idParam[0] : idParam;
  if (userId !== undefined && !isUuid(userId)) {
    return fail(res, 400, 'Invalid user id');
  }

  try {
    if (req.method === 'GET') {
      if (userId) {
        const { data, error } = await client.from('users').select('*').eq('id', userId).maybeSingle();
        if (error) return fail(res, 500, 'Failed to fetch user', error);
        if (!data) return fail(res, 404, 'User not found');
        return res.status(200).json({ data });
      }

      const { data, error } = await client.from('users').select('*').order('created_at', { ascending: false });
      if (error) return fail(res, 500, 'Failed to fetch users', error);
      return res.status(200).json({ data: data || [] });
    }

    if (req.method === 'POST') {
      const parsed = parseCreateUser(req.body);
      if (!parsed.ok) return fail(res, 400, parsed.error);
      const input = parsed.value;

      const { data: existingUser } = await client.from('users').select('id').eq('name', input.name).maybeSingle();
      if (existingUser) return fail(res, 409, `User with name "${input.name}" already exists`);

      const { data: authData, error: authError } = await client.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          name: input.name,
          first_name: input.first_name,
          last_name: input.last_name,
          requires_password_change: true,
        },
      });
      if (authError || !authData.user) {
        // Auth errors here are actionable for the admin (e.g. email already registered).
        return fail(res, 400, authError?.message || 'Failed to create login', authError);
      }

      const newAuthId = authData.user.id;
      try {
        const profile = {
          name: input.name,
          first_name: input.first_name,
          last_name: input.last_name,
          role: input.role,
          active: input.active,
        };
        // The signup trigger may already have created the profile row.
        const { data: userData, error: userError } = await client
          .from('users')
          .upsert({ auth_id: newAuthId, ...profile }, { onConflict: 'auth_id' })
          .select()
          .single();
        if (userError) throw userError;

        await setRole(client, newAuthId, input.role);

        return res.status(201).json({
          data: userData,
          authUser: { id: newAuthId, email: authData.user.email },
        });
      } catch (innerError) {
        await client.auth.admin.deleteUser(newAuthId);
        return fail(res, 500, 'Failed to create user', innerError);
      }
    }

    if (req.method === 'PUT') {
      if (!userId) return fail(res, 400, 'User ID is required');
      const parsed = parseUpdateUser(req.body);
      if (!parsed.ok) return fail(res, 400, parsed.error);
      const { password, ...profileChanges } = parsed.value;

      // The login account is always derived from the profile row, never taken from the request.
      const { data: target, error: targetError } = await client
        .from('users')
        .select('id, auth_id')
        .eq('id', userId)
        .maybeSingle();
      if (targetError) return fail(res, 500, 'Failed to load user', targetError);
      if (!target) return fail(res, 404, 'User not found');

      if (Object.keys(profileChanges).length > 0) {
        const { error } = await client.from('users').update(profileChanges).eq('id', userId);
        if (error) return fail(res, 500, 'Failed to update user', error);
      }

      if (password) {
        if (!target.auth_id) return fail(res, 400, 'User has no login account');
        const isSelf = target.auth_id === auth.authUserId;
        // A password set by an admin for someone else is temporary: they must change it on next login.
        const { error } = await client.auth.admin.updateUserById(target.auth_id, {
          password,
          ...(isSelf ? {} : { user_metadata: { requires_password_change: true } }),
        });
        if (error) return fail(res, 400, error.message || 'Failed to set password', error);
      }

      if (profileChanges.role && target.auth_id) {
        await setRole(client, target.auth_id, profileChanges.role);
      }

      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      if (!userId) return fail(res, 400, 'User ID is required');

      const { data: target, error: targetError } = await client
        .from('users')
        .select('id, auth_id')
        .eq('id', userId)
        .maybeSingle();
      if (targetError) return fail(res, 500, 'Failed to load user', targetError);
      if (!target) return fail(res, 404, 'User not found');
      if (target.auth_id && target.auth_id === auth.authUserId) {
        return fail(res, 400, 'You cannot delete your own account');
      }

      if (target.auth_id) {
        const { error } = await client.from('user_roles').delete().eq('user_id', target.auth_id);
        if (error) return fail(res, 500, 'Failed to remove roles', error);
      }

      const { error: userError } = await client.from('users').delete().eq('id', userId);
      if (userError) return fail(res, 500, 'Failed to delete user', userError);

      if (target.auth_id) {
        const { error } = await client.auth.admin.deleteUser(target.auth_id);
        if (error) console.warn('[api/admin/users] login already removed or not deletable:', error);
      }

      return res.status(200).json({ success: true });
    }

    return fail(res, 405, 'Method not allowed');
  } catch (error) {
    return fail(res, 500, 'Internal server error', error);
  }
}
