import type { RequestHandler } from '@sveltejs/kit';
import { fail, success } from '$lib/server/apiResponse';
import { createSession, createUser, setSessionCookie } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  let body: { email?: string; password?: string; timezone?: string };
  try {
    body = await event.request.json();
  } catch (err) {
    return fail('INVALID_PAYLOAD', 'JSON body is required');
  }
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const timezone = body.timezone ?? 'UTC';
  if (!email || !password) return fail('INVALID_VALUE', 'Email and password required');
  if (password.length < 8) return fail('INVALID_VALUE', 'Password must be at least 8 characters');
  try {
    const user = await createUser(db, { email, password, timezone });
    const session = await createSession(db, user.id);
    setSessionCookie(event.cookies, event.url.protocol === 'https:', session.id, session.expires_at);
    return success({ email: user.email, timezone: user.timezone }, { status: 201 });
  } catch (err: any) {
    if (String(err?.message ?? '').includes('UNIQUE')) {
      return fail('CONFLICT', 'Email already in use', 409);
    }
    return fail('SERVER_ERROR', 'Unable to create account', 500);
  }
};
