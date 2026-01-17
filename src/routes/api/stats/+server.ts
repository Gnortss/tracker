import type { RequestHandler } from '@sveltejs/kit';
import { fail, success } from '$lib/server/apiResponse';
import { requireUser } from '$lib/server/auth';
import { getTodayDate, parseYearMonth } from '$lib/server/dates';
import { listHabits } from '$lib/server/services/habits';
import { listTrackables } from '$lib/server/services/trackables';
import { computeStats } from '$lib/server/stats';

export const GET: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const auth = await requireUser(event);
  if (auth instanceof Response) return auth;
  const today = getTodayDate(auth.user.timezone);
  const yearParam = event.url.searchParams.get('year');
  const monthParam = event.url.searchParams.get('month');
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  let year = currentYear;
  let month = currentMonth;
  if (monthParam) {
    const parsed = parseYearMonth(monthParam);
    if (!parsed) return fail('INVALID_VALUE', 'month must be YYYY-MM');
    year = parsed.year;
    month = parsed.month;
  } else if (yearParam) {
    const numeric = Number(yearParam);
    if (!Number.isInteger(numeric)) return fail('INVALID_VALUE', 'year must be YYYY');
    year = numeric;
  }
  const [habits, trackables] = await Promise.all([listHabits(db, auth.user.id), listTrackables(db, auth.user.id)]);
  const stats = await computeStats(db, auth.user.id, today, habits, trackables, year, month);
  return success(stats);
};
