import type { RequestHandler } from '@sveltejs/kit';
import { fail, success } from '$lib/server/apiResponse';
import { maskedApiKey, regenerateApiKey, requireSessionUser } from '$lib/server/auth';
import { getApiKeySecret } from '$lib/server/env';

export const POST: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const secret = getApiKeySecret(event);
  if (!secret) return fail('CONFIG_ERROR', 'API key secret missing', 500);
  const auth = await requireSessionUser(event);
  if (auth instanceof Response) return auth;
  try {
    const result = await regenerateApiKey(db, auth.user.id, secret);
    return success({
      apiKey: result.apiKey,
      apiKeyMasked: maskedApiKey()
    });
  } catch (err) {
    return fail('SERVER_ERROR', 'Unable to regenerate API key', 500);
  }
};
