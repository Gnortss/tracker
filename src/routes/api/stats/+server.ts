import type { RequestHandler } from '@sveltejs/kit';
import { success, fail } from '$lib/server/apiResponse';
import { requireAuth } from '$lib/server/auth';
import { getTodayDate } from '$lib/server/dates';
import { rangeStats, rangeStatsAll } from '$lib/server/tracker';

export const GET: RequestHandler = async ({ request, url, platform }) => {
  const authError = requireAuth(request, platform?.env?.API_TOKEN);
  if (authError) return authError;
  if (!platform?.env?.DB) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const daysParam = url.searchParams.get('days') ?? '21';
  try {
    const end = getTodayDate(platform.env?.DEFAULT_TZ);
    const data =
      daysParam === 'all'
        ? await rangeStatsAll(platform.env.DB, end)
        : await rangeStats(platform.env.DB, Number.isNaN(Number(daysParam)) ? 21 : Number(daysParam), end);
    return success(data);
  } catch (err) {
    return fail('SERVER_ERROR', 'Unable to fetch stats', 500);
  }
};
