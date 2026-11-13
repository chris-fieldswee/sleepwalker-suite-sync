/* eslint-disable @typescript-eslint/no-explicit-any -- hand-rolled fakes of the Supabase client and Vercel req/res */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// A configurable fake of the Supabase service client used by the handler.
const state: {
  sessionUser: { id: string } | null;
  isAdmin: boolean;
  targetRow: { id: string; auth_id: string | null } | null;
  writes: string[];
  updateUserById: ReturnType<typeof vi.fn>;
} = { sessionUser: null, isAdmin: false, targetRow: null, writes: [], updateUserById: vi.fn() };

const makeChain = (table: string) => {
  let mode: 'read' | 'update' | 'delete' | 'upsert' = 'read';
  let selected = '';
  const chain: any = {
    select: (cols = '*') => { selected = cols; return chain; },
    eq: () => chain,
    neq: () => chain,
    order: async () => ({ data: [], error: null }),
    update: () => { mode = 'update'; state.writes.push(`${table}.update`); return chain; },
    delete: () => { mode = 'delete'; state.writes.push(`${table}.delete`); return chain; },
    upsert: () => { mode = 'upsert'; state.writes.push(`${table}.upsert`); return chain; },
    single: async () => ({ data: { id: 'new' }, error: null }),
    maybeSingle: async () => {
      if (table === 'user_roles') return { data: state.isAdmin ? { role: 'admin' } : null, error: null };
      if (table === 'users' && selected === 'active') return { data: { active: true }, error: null };
      if (table === 'users') return { data: state.targetRow, error: null };
      return { data: null, error: null };
    },
    then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
  };
  void mode;
  return chain;
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: state.sessionUser }, error: state.sessionUser ? null : new Error('no session') }),
      admin: {
        updateUserById: (...args: unknown[]) => state.updateUserById(...args),
        createUser: vi.fn(),
        deleteUser: vi.fn(async () => ({ error: null })),
      },
    },
    from: (table: string) => makeChain(table),
  }),
}));

const { default: handler } = await import('./users');

const call = async (req: { method: string; headers?: Record<string, string>; query?: Record<string, string>; body?: unknown }) => {
  const res: any = { statusCode: 0, body: undefined, headers: {} as Record<string, string> };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: unknown) => { res.body = data; };
  res.setHeader = (name: string, value: string) => { res.headers[name] = value; };
  res.end = () => {};
  await handler({ headers: {}, query: {}, ...req } as any, res);
  return res;
};

const TARGET_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret';
  state.sessionUser = null;
  state.isAdmin = false;
  state.targetRow = { id: TARGET_ID, auth_id: 'target-auth-id' };
  state.writes = [];
  state.updateUserById = vi.fn(async () => ({ error: null }));
});

describe('api/admin/users authorization', () => {
  it('rejects a request with no session and performs no work', async () => {
    const res = await call({ method: 'GET' });
    expect(res.statusCode).toBe(401);
    expect(state.writes).toEqual([]);
  });

  it('rejects a signed-in non-admin trying to create an admin', async () => {
    state.sessionUser = { id: 'housekeeper-auth-id' };
    const res = await call({
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { email: 'x@y.pl', password: 'longenough', name: 'X', role: 'admin' },
    });
    expect(res.statusCode).toBe(403);
    expect(state.writes).toEqual([]);
  });

  it('sends no wildcard CORS header', async () => {
    const res = await call({ method: 'GET' });
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });
});

describe('api/admin/users as admin', () => {
  beforeEach(() => {
    state.sessionUser = { id: 'admin-auth-id' };
    state.isAdmin = true;
  });

  it('changes the password of the account linked to the row, ignoring a client-supplied auth_id', async () => {
    const res = await call({
      method: 'PUT',
      headers: { authorization: 'Bearer token' },
      query: { id: TARGET_ID },
      body: { password: 'newpassword1', auth_id: 'someone-else' },
    });
    expect(res.statusCode).toBe(200);
    expect(state.updateUserById).toHaveBeenCalledTimes(1);
    expect(state.updateUserById.mock.calls[0][0]).toBe('target-auth-id');
    expect(state.updateUserById.mock.calls[0][1]).toMatchObject({ user_metadata: { requires_password_change: true } });
  });

  it('rejects a malformed user id', async () => {
    const res = await call({ method: 'DELETE', headers: { authorization: 'Bearer token' }, query: { id: '1 or 1=1' } });
    expect(res.statusCode).toBe(400);
    expect(state.writes).toEqual([]);
  });

  it('refuses to let an admin delete their own account', async () => {
    state.targetRow = { id: TARGET_ID, auth_id: 'admin-auth-id' };
    const res = await call({ method: 'DELETE', headers: { authorization: 'Bearer token' }, query: { id: TARGET_ID } });
    expect(res.statusCode).toBe(400);
    expect(state.writes).toEqual([]);
  });
});
