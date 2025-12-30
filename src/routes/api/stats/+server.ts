import type { RequestHandler } from '@sveltejs/kit';
import { success, fail } from '$lib/server/apiResponse';
import { requireAuth } from '$lib/server/auth';
import { getTodayDate } from '$lib/server/dates';
import { rangeStats } from '$lib/server/tracker';

export const GET: RequestHandler = async ({ request, url, platform }) => {
  const authError = requireAuth(request, platform?.env?.API_TOKEN);
  if (authError) return authError;
  if (!platform?.env?.DB) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const daysParam = Number(url.searchParams.get('days') ?? '21');
  const days = Number.isNaN(daysParam) ? 21 : daysParam;
  try {
    const end = getTodayDate(platform.env?.DEFAULT_TZ);
    const data = await rangeStats(platform.env.DB, days, end);
    return success(data);
  } catch (err) {
    return fail('SERVER_ERROR', 'Unable to fetch stats', 500);
  }
};
