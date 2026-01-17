import type { RequestHandler } from '@sveltejs/kit';
import { fail, success } from '$lib/server/apiResponse';
import { maskedApiKey, requireUser } from '$lib/server/auth';
import { addDays, getTodayDate, rangeDays } from '$lib/server/dates';
import { listHabits, getHabitEntriesForRange } from '$lib/server/services/habits';
import { listTrackables, getTrackableEntriesForRange } from '$lib/server/services/trackables';
import { computeStats } from '$lib/server/stats';

export const GET: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const auth = await requireUser(event);
  if (auth instanceof Response) return auth;
  const today = getTodayDate(auth.user.timezone);
  const daysParam = Number(event.url.searchParams.get('days') ?? '5');
  const pageParam = Number(event.url.searchParams.get('page') ?? '0');
  const windowSize = Math.max(5, Math.min(7, Number.isInteger(daysParam) ? daysParam : 5));
  const page = Math.max(0, Number.isInteger(pageParam) ? pageParam : 0);
  const end = addDays(today, -page * windowSize);
  const start = addDays(end, -(windowSize - 1));
  const days = rangeDays(start, end);

  const [habits, trackables] = await Promise.all([listHabits(db, auth.user.id), listTrackables(db, auth.user.id)]);
  const habitEntries = await getHabitEntriesForRange(db, habits.map((h) => h.id), start, end);
  const trackableEntries = await getTrackableEntriesForRange(db, trackables.map((t) => t.id), start, end);
  const stats = await computeStats(db, auth.user.id, today, habits, trackables, Number(today.slice(0, 4)), Number(today.slice(5, 7)));

  const revealAllowed = Boolean(event.platform?.env?.API_KEY_SECRET);
  return success({
    user: {
      email: auth.user.email,
      timezone: auth.user.timezone,
      apiKeyMasked: maskedApiKey(),
      apiKeyRevealAllowed: auth.authType === 'session' && revealAllowed
    },
    days,
    habits,
    trackables,
    habit_entries: habitEntries,
    trackable_entries: trackableEntries,
    habit_stats: stats.habit_stats,
    trackable_stats: stats.trackable_stats
  });
};
