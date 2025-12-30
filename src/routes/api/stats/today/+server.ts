import type { RequestHandler } from '@sveltejs/kit';
import { success, fail } from '$lib/server/apiResponse';
import { requireAuth } from '$lib/server/auth';
import { getTodayDate } from '$lib/server/dates';
import { todayStats } from '$lib/server/tracker';

export const GET: RequestHandler = async ({ request, platform }) => {
  const authError = requireAuth(request, platform?.env?.API_TOKEN);
  if (authError) return authError;
  if (!platform?.env?.DB) return fail('SERVER_ERROR', 'Database binding missing', 500);
  try {
    const date = getTodayDate(platform.env?.DEFAULT_TZ);
    const data = await todayStats(platform.env.DB, date);
    return success(data);
  } catch (err) {
    return fail('SERVER_ERROR', 'Unable to fetch today stats', 500);
  }
};
