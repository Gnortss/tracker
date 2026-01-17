import type { RequestHandler } from '@sveltejs/kit';
import { fail, success } from '$lib/server/apiResponse';
import { deleteSession, clearSessionCookie, SESSION_COOKIE } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const sessionId = event.cookies.get(SESSION_COOKIE);
  if (sessionId) {
    await deleteSession(db, sessionId);
  }
  clearSessionCookie(event.cookies, event.url.protocol === 'https:');
  return success({ ok: true });
};
