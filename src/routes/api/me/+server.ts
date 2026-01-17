import type { RequestHandler } from '@sveltejs/kit';
import { fail, success } from '$lib/server/apiResponse';
import { maskedApiKey, requireSessionUser } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const auth = await requireSessionUser(event);
  if (auth instanceof Response) return auth;
  const revealAllowed = Boolean(event.platform?.env?.API_KEY_SECRET);
  return success({
    email: auth.user.email,
    timezone: auth.user.timezone,
    apiKeyMasked: maskedApiKey(),
    apiKeyRevealAllowed: revealAllowed
  });
};
