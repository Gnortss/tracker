import type { RequestHandler } from '@sveltejs/kit';
import { fail, success } from '$lib/server/apiResponse';
import { maskedApiKey, requireSessionUser } from '$lib/server/auth';
import { getApiKeySecret } from '$lib/server/env';

export const GET: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const auth = await requireSessionUser(event);
  if (auth instanceof Response) return auth;
  const revealAllowed = Boolean(getApiKeySecret(event));
  return success({
    email: auth.user.email,
    timezone: auth.user.timezone,
    apiKeyMasked: maskedApiKey(),
    apiKeyRevealAllowed: revealAllowed
  });
};
