/* eslint-disable @typescript-eslint/no-explicit-any -- hand-rolled fake of the Supabase query builder */
import { describe, it, expect, vi } from 'vitest';
import { authorizeAdmin, parseCreateUser, parseUpdateUser, isUuid } from './admin-authz';
import { findSecrets } from '../../scripts/check-bundle-secrets.mjs';

type Rows = { user_roles?: unknown; users?: unknown };

// Minimal fake of the Supabase service client: every query on a table resolves to the configured row.
const fakeClient = (user: { id: string } | null, rows: Rows = {}) => {
  const getUser = vi.fn(async () => ({ data: { user }, error: user ? null : new Error('bad token') }));
  const from = vi.fn((table: keyof Rows) => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
    };
    return chain;
  });
  return { auth: { getUser }, from };
};

describe('authorizeAdmin', () => {
  it('rejects a request without a bearer token (401) and never looks up a user', async () => {
    const client = fakeClient({ id: 'u1' });
    expect(await authorizeAdmin(undefined, client)).toMatchObject({ ok: false, status: 401 });
    expect(await authorizeAdmin('Basic abc', client)).toMatchObject({ ok: false, status: 401 });
    expect(client.auth.getUser).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired token (401)', async () => {
    const client = fakeClient(null);
    expect(await authorizeAdmin('Bearer nope', client)).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects a signed-in user without the admin role (403)', async () => {
    const client = fakeClient({ id: 'housekeeper' }, { user_roles: null, users: { active: true } });
    expect(await authorizeAdmin('Bearer token', client)).toMatchObject({ ok: false, status: 403 });
  });

  it('rejects an inactive admin (403)', async () => {
    const client = fakeClient({ id: 'old-admin' }, { user_roles: { role: 'admin' }, users: { active: false } });
    expect(await authorizeAdmin('Bearer token', client)).toMatchObject({ ok: false, status: 403 });
  });

  it('allows an active admin and returns their auth id', async () => {
    const client = fakeClient({ id: 'admin-1' }, { user_roles: { role: 'admin' }, users: { active: true } });
    expect(await authorizeAdmin('Bearer token', client)).toEqual({ ok: true, authUserId: 'admin-1' });
    expect(client.auth.getUser).toHaveBeenCalledWith('token');
  });
});

describe('parseCreateUser', () => {
  const valid = { email: 'Anna@Hotel.pl ', password: 'longenough', name: ' Anna ', role: 'housekeeping' };

  it('accepts and normalises a valid payload', () => {
    expect(parseCreateUser(valid)).toEqual({
      ok: true,
      value: { email: 'anna@hotel.pl', password: 'longenough', name: 'Anna', first_name: undefined, last_name: undefined, role: 'housekeeping', active: true },
    });
  });

  it.each([
    ['unknown role', { ...valid, role: 'superuser' }],
    ['short password', { ...valid, password: 'short' }],
    ['bad email', { ...valid, email: 'not-an-email' }],
    ['missing name', { ...valid, name: '  ' }],
    ['non-boolean active', { ...valid, active: 'yes' }],
  ])('rejects %s', (_label, body) => {
    expect(parseCreateUser(body).ok).toBe(false);
  });
});

describe('parseUpdateUser', () => {
  it('drops fields it does not know, including a client-supplied auth_id', () => {
    const parsed = parseUpdateUser({ name: 'Ola', auth_id: 'someone-else', role: 'reception' });
    expect(parsed).toEqual({ ok: true, value: { name: 'Ola', role: 'reception' } });
  });

  it('treats an empty password as "no change" and rejects a short one', () => {
    expect(parseUpdateUser({ password: '' })).toEqual({ ok: true, value: {} });
    expect(parseUpdateUser({ password: 'abc' }).ok).toBe(false);
  });

  it('rejects an invalid role', () => {
    expect(parseUpdateUser({ role: 'owner' }).ok).toBe(false);
  });
});

describe('isUuid', () => {
  it('accepts uuids only', () => {
    expect(isUuid('6f9619ff-8b86-d011-b42d-00c04fc964ff')).toBe(true);
    expect(isUuid('1; drop table users')).toBe(false);
  });
});

describe('findSecrets (bundle credential check)', () => {
  const jwt = (payload: object) =>
    `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig_nature`;

  it('allows the public anon key', () => {
    expect(findSecrets(`const k="${jwt({ role: 'anon' })}"`)).toEqual([]);
  });

  it('flags a service_role JWT without printing it', () => {
    const findings = findSecrets(`const k="${jwt({ role: 'service_role' })}"`);
    expect(findings).toEqual(['JWT with role "service_role"']);
  });

  it('flags a new-style secret key', () => {
    expect(findSecrets('x="sb_secret_abcdefghijklmnop"')).toHaveLength(1);
  });
});
