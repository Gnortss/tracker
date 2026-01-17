import type { D1Database } from '@cloudflare/workers-types';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { fail } from '$lib/server/apiResponse';

export const SESSION_COOKIE = 'tracker_session';
const SESSION_TTL_DAYS = 30;
const SESSION_RENEW_DAYS = 7;

type UserRow = {
  id: string;
  email: string;
  timezone: string;
  password_hash: string;
};

type SessionRow = {
  id: string;
  user_id: string;
  expires_at: string;
};

type ApiKeyRow = {
  id: string;
  key_hash: string;
  key_encrypted?: string | null;
  key_iv?: string | null;
  revoked_at: string | null;
};

const isoNow = () => new Date().toISOString();

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const toBase64 = (bytes: Uint8Array) =>
  typeof Buffer !== 'undefined' ? Buffer.from(bytes).toString('base64') : btoa(String.fromCharCode(...bytes));

const fromBase64 = (value: string) => {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
};

const base64Url = (bytes: Uint8Array) => {
  const base64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(bytes).toString('base64')
      : btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

export const hashPassword = async (password: string): Promise<string> => bcrypt.hash(password, 12);

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => bcrypt.compare(password, hash);

export const generateApiKey = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
};

const deriveKey = async (secret: string) => {
  if (!secret) throw new Error('API_KEY_SECRET_MISSING');
  const data = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
};

const encryptApiKey = async (apiKey: string, secret: string) => {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(apiKey);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { ciphertext: toBase64(new Uint8Array(encrypted)), iv: toBase64(iv) };
};

const decryptApiKey = async (ciphertext: string, iv: string, secret: string) => {
  const key = await deriveKey(secret);
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(ciphertext));
  return new TextDecoder().decode(data);
};

export const hashApiKey = async (apiKey: string): Promise<string> => {
  const data = new TextEncoder().encode(apiKey);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
};

export const maskedApiKey = (): string => '************';

export const getUserByEmail = async (db: D1Database, email: string): Promise<UserRow | null> => {
  const row = await db
    .prepare('SELECT id, email, timezone, password_hash FROM users WHERE email = ?')
    .bind(email)
    .first<UserRow>();
  return row ?? null;
};

export const getUserById = async (db: D1Database, id: string): Promise<UserRow | null> => {
  const row = await db.prepare('SELECT id, email, timezone, password_hash FROM users WHERE id = ?').bind(id).first<UserRow>();
  return row ?? null;
};

export const createUser = async (db: D1Database, input: { email: string; password: string; timezone?: string }) => {
  const id = crypto.randomUUID();
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const timezone = input.timezone ?? 'UTC';
  await db
    .prepare('INSERT INTO users (id, email, password_hash, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, email, passwordHash, timezone, isoNow(), isoNow())
    .run();
  return { id, email, timezone };
};

export const createSession = async (db: D1Database, userId: string) => {
  const id = crypto.randomUUID();
  const expires = addDays(new Date(), SESSION_TTL_DAYS);
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, userId, expires.toISOString(), isoNow())
    .run();
  return { id, expires_at: expires.toISOString() };
};

export const deleteSession = async (db: D1Database, sessionId: string) => {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
};

const parseExpires = (value: string) => new Date(value);

const shouldRenew = (expires: Date) => expires.getTime() - Date.now() < SESSION_RENEW_DAYS * 24 * 60 * 60 * 1000;

export const getSessionWithUser = async (db: D1Database, sessionId: string) => {
  const row = await db
    .prepare(
      `SELECT s.id as session_id, s.expires_at, u.id as user_id, u.email, u.timezone, u.password_hash
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .bind(sessionId)
    .first<{ session_id: string; expires_at: string } & UserRow>();
  if (!row) return null;
  const expires = parseExpires(row.expires_at);
  if (Number.isNaN(expires.getTime()) || expires <= new Date()) {
    await deleteSession(db, sessionId);
    return null;
  }
  if (shouldRenew(expires)) {
    const renewed = addDays(new Date(), SESSION_TTL_DAYS);
    await db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').bind(renewed.toISOString(), sessionId).run();
    row.expires_at = renewed.toISOString();
  }
  return {
    session: { id: row.session_id, user_id: row.user_id, expires_at: row.expires_at } satisfies SessionRow,
    user: { id: row.user_id, email: row.email, timezone: row.timezone, password_hash: row.password_hash } satisfies UserRow
  };
};

export const setSessionCookie = (cookies: Cookies, secure: boolean, sessionId: string, expiresAt: string) => {
  cookies.set(SESSION_COOKIE, sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    expires: new Date(expiresAt)
  });
};

export const clearSessionCookie = (cookies: Cookies, secure: boolean) => {
  cookies.delete(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure });
};

const getSessionId = (cookies: Cookies) => cookies.get(SESSION_COOKIE) ?? '';

export const findUserByApiKey = async (db: D1Database, apiKey: string) => {
  const keyHash = await hashApiKey(apiKey);
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.timezone, u.password_hash
       FROM api_keys k
       JOIN users u ON u.id = k.user_id
       WHERE k.key_hash = ? AND k.revoked_at IS NULL`
    )
    .bind(keyHash)
    .first<UserRow>();
  return row ?? null;
};

export const getOrCreateApiKey = async (db: D1Database, userId: string, secret: string) => {
  const existing = await db
    .prepare('SELECT id, key_encrypted, key_iv FROM api_keys WHERE user_id = ? AND revoked_at IS NULL')
    .bind(userId)
    .first<ApiKeyRow>();
  if (existing?.key_encrypted && existing?.key_iv) {
    const apiKey = await decryptApiKey(existing.key_encrypted, existing.key_iv, secret);
    return { apiKey, created: false };
  }
  const apiKey = generateApiKey();
  const keyHash = await hashApiKey(apiKey);
  const encrypted = await encryptApiKey(apiKey, secret);
  if (existing?.id) {
    await db
      .prepare('UPDATE api_keys SET key_hash = ?, key_encrypted = ?, key_iv = ?, revoked_at = NULL WHERE id = ?')
      .bind(keyHash, encrypted.ciphertext, encrypted.iv, existing.id)
      .run();
  } else {
    await db
      .prepare('INSERT INTO api_keys (id, user_id, key_hash, key_encrypted, key_iv, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), userId, keyHash, encrypted.ciphertext, encrypted.iv, isoNow())
      .run();
  }
  return { apiKey, created: true };
};

export const regenerateApiKey = async (db: D1Database, userId: string, secret: string) => {
  const apiKey = generateApiKey();
  const keyHash = await hashApiKey(apiKey);
  const encrypted = await encryptApiKey(apiKey, secret);
  const existing = await db.prepare('SELECT id FROM api_keys WHERE user_id = ?').bind(userId).first<ApiKeyRow>();
  if (existing?.id) {
    await db
      .prepare('UPDATE api_keys SET key_hash = ?, key_encrypted = ?, key_iv = ?, revoked_at = NULL WHERE id = ?')
      .bind(keyHash, encrypted.ciphertext, encrypted.iv, existing.id)
      .run();
    return { apiKey, regenerated: true };
  }
  await db
    .prepare('INSERT INTO api_keys (id, user_id, key_hash, key_encrypted, key_iv, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), userId, keyHash, encrypted.ciphertext, encrypted.iv, isoNow())
    .run();
  return { apiKey, regenerated: true };
};

export const requireUser = async (
  event: RequestEvent,
  options?: { allowApiKey?: boolean; requireSession?: boolean }
): Promise<{ user: UserRow; authType: 'session' | 'api_key' } | Response> => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);

  const sessionId = getSessionId(event.cookies);
  if (sessionId) {
    const session = await getSessionWithUser(db, sessionId);
    if (session) return { user: session.user, authType: 'session' };
  }

  if (!options?.allowApiKey && options?.requireSession) {
    return fail('UNAUTHORIZED', 'Session required', 401);
  }

  if (options?.allowApiKey ?? true) {
    const header = event.request.headers.get('authorization');
    const apiKeyHeader = event.request.headers.get('x-api-key');
    const token =
      (header && header.toLowerCase().startsWith('bearer ') ? header.substring(7).trim() : '') || (apiKeyHeader ?? '').trim();
    if (token) {
      const user = await findUserByApiKey(db, token);
      if (user) return { user, authType: 'api_key' };
    }
  }

  return fail('UNAUTHORIZED', 'Unauthorized', 401);
};

export const requireSessionUser = async (event: RequestEvent) =>
  requireUser(event, { allowApiKey: false, requireSession: true });
