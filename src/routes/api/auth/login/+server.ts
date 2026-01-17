import type { RequestHandler } from '@sveltejs/kit';
import { fail, success } from '$lib/server/apiResponse';
import { createSession, getUserByEmail, setSessionCookie, verifyPassword } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  let body: { email?: string; password?: string };
  try {
    body = await event.request.json();
  } catch (err) {
    return fail('INVALID_PAYLOAD', 'JSON body is required');
  }
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!email || !password) return fail('INVALID_VALUE', 'Email and password required');
  const user = await getUserByEmail(db, email);
  if (!user) return fail('UNAUTHORIZED', 'Invalid credentials', 401);
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return fail('UNAUTHORIZED', 'Invalid credentials', 401);
  const session = await createSession(db, user.id);
  setSessionCookie(event.cookies, event.url.protocol === 'https:', session.id, session.expires_at);
  return success({ email: user.email, timezone: user.timezone });
};
