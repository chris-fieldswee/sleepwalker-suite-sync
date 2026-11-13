// Server-side authorization and input validation for the admin API (api/admin/*).
// Kept free of browser-only imports (no "@/" aliases, no import.meta.env) so the
// Vercel function can import it directly.

export const ROLES = ['admin', 'manager', 'reception', 'housekeeping'] as const;
export type Role = (typeof ROLES)[number];

export type AdminCheck =
  | { ok: true; authUserId: string }
  | { ok: false; status: 401 | 403; error: string };

// The minimal slice of the Supabase service client this check needs.
export interface AuthzClient {
  auth: {
    getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };
  // The real query builder is deeply generic; only select/eq/maybeSingle are used here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

const bearerToken = (header: string | string[] | undefined): string | null => {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match ? match[1].trim() : null;
};

/**
 * Allows the request only for a signed-in, active user who holds the `admin`
 * role in `user_roles`. `users.role` is deliberately not trusted here.
 */
export async function authorizeAdmin(
  authorizationHeader: string | string[] | undefined,
  client: AuthzClient,
): Promise<AdminCheck> {
  const token = bearerToken(authorizationHeader);
  if (!token) return { ok: false, status: 401, error: 'Authentication required' };

  const { data, error } = await client.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return { ok: false, status: 401, error: 'Invalid or expired session' };

  const { data: roleRow, error: roleError } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();
  if (roleError || !roleRow) return { ok: false, status: 403, error: 'Admin role required' };

  const { data: profile, error: profileError } = await client
    .from('users')
    .select('active')
    .eq('auth_id', user.id)
    .maybeSingle();
  if (profileError || !profile || profile.active === false) {
    return { ok: false, status: 403, error: 'Account is inactive' };
  }

  return { ok: true, authUserId: user.id };
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && (ROLES as readonly string[]).includes(value);

const optionalString = (value: unknown, field: string, max = 200): Parsed<string | undefined> => {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (typeof value !== 'string' || value.length > max) {
    return { ok: false, error: `Invalid ${field}` };
  }
  return { ok: true, value: value.trim() };
};

export const MIN_PASSWORD_LENGTH = 8;

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  first_name?: string;
  last_name?: string;
  role: Role;
  active: boolean;
}

export function parseCreateUser(body: unknown): Parsed<CreateUserInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())) {
    return { ok: false, error: 'Invalid email' };
  }
  if (typeof b.password !== 'string' || b.password.length < MIN_PASSWORD_LENGTH || b.password.length > 128) {
    return { ok: false, error: `Password must be ${MIN_PASSWORD_LENGTH}-128 characters` };
  }
  if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 200) {
    return { ok: false, error: 'Invalid name' };
  }
  if (!isRole(b.role)) return { ok: false, error: 'Invalid role' };
  if (b.active !== undefined && typeof b.active !== 'boolean') return { ok: false, error: 'Invalid active flag' };

  const first = optionalString(b.first_name, 'first_name');
  if ('error' in first) return { ok: false, error: first.error };
  const last = optionalString(b.last_name, 'last_name');
  if ('error' in last) return { ok: false, error: last.error };

  return {
    ok: true,
    value: {
      email: b.email.trim().toLowerCase(),
      password: b.password,
      name: b.name.trim(),
      first_name: first.value,
      last_name: last.value,
      role: b.role,
      active: typeof b.active === 'boolean' ? b.active : true,
    },
  };
}

export interface UpdateUserInput {
  name?: string;
  first_name?: string;
  last_name?: string;
  role?: Role;
  active?: boolean;
  password?: string;
}

export function parseUpdateUser(body: unknown): Parsed<UpdateUserInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const value: UpdateUserInput = {};

  if (b.name !== undefined) {
    if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 200) return { ok: false, error: 'Invalid name' };
    value.name = b.name.trim();
  }
  for (const field of ['first_name', 'last_name'] as const) {
    const parsed = optionalString(b[field], field);
    if ('error' in parsed) return { ok: false, error: parsed.error };
    if (parsed.value !== undefined) value[field] = parsed.value;
  }
  if (b.role !== undefined) {
    if (!isRole(b.role)) return { ok: false, error: 'Invalid role' };
    value.role = b.role;
  }
  if (b.active !== undefined) {
    if (typeof b.active !== 'boolean') return { ok: false, error: 'Invalid active flag' };
    value.active = b.active;
  }
  if (b.password !== undefined && b.password !== null && b.password !== '') {
    if (typeof b.password !== 'string' || b.password.length < MIN_PASSWORD_LENGTH || b.password.length > 128) {
      return { ok: false, error: `Password must be ${MIN_PASSWORD_LENGTH}-128 characters` };
    }
    value.password = b.password;
  }
  return { ok: true, value };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
