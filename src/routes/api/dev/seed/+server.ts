import type { RequestHandler } from '@sveltejs/kit';
import { fail, success } from '$lib/server/apiResponse';
import { createUser, getUserByEmail } from '$lib/server/auth';
import { getTodayDate, addDays, rangeDays } from '$lib/server/dates';
import { createHabit, setHabitEntry, updateHabit } from '$lib/server/services/habits';
import { createTrackable, setTrackableEntry, updateTrackable } from '$lib/server/services/trackables';

export const POST: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const expected = event.platform?.env?.DEV_SEED_TOKEN;
  const provided = event.request.headers.get('x-dev-seed') ?? event.url.searchParams.get('token');
  if (!expected || provided !== expected) return fail('FORBIDDEN', 'Seed token missing or invalid', 403);

  let body: { email?: string; password?: string; timezone?: string } = {};
  if (event.request.headers.get('content-type')?.includes('application/json')) {
    try {
      body = await event.request.json();
    } catch (err) {
      return fail('INVALID_PAYLOAD', 'JSON body is required');
    }
  }
  const email = (body.email ?? 'demo@example.com').toLowerCase();
  const password = body.password ?? 'demo-pass-123';
  const timezone = body.timezone ?? 'UTC';

  const existing = await getUserByEmail(db, email);
  if (existing) {
    return success({ seeded: false, email });
  }

  const user = await createUser(db, { email, password, timezone });
  const today = getTodayDate(timezone);
  const days = rangeDays(addDays(today, -6), today);

  const habit1 = await createHabit(db, user.id, { name: 'Meditate' });
  const habit2 = await createHabit(db, user.id, { name: 'Read' });
  const habit3 = await createHabit(db, user.id, { name: 'No sugar', sort_order: 2 });

  const track1 = await createTrackable(db, user.id, { name: 'Pushups', unit: 'reps', min_value: 1, max_value: 200 });
  const track2 = await createTrackable(db, user.id, { name: 'Mood', unit: 'score', min_value: 1, max_value: 5 });
  const track3 = await createTrackable(db, user.id, { name: 'Water', unit: 'cups', min_value: 1, max_value: 20 });

  await updateHabit(db, user.id, habit3.id, { active: false });
  await updateTrackable(db, user.id, track3.id, { active: false });

  for (const day of days.slice(0, 5)) {
    await setHabitEntry(db, habit1.id, day, true);
  }
  for (const day of days.slice(0, 3)) {
    await setHabitEntry(db, habit2.id, day, true);
  }
  await setHabitEntry(db, habit3.id, days[0], true);

  await setTrackableEntry(db, track1, days[0], 20);
  await setTrackableEntry(db, track1, days[1], 25);
  await setTrackableEntry(db, track1, days[3], 30);
  await setTrackableEntry(db, track1, days[4], 30);

  await setTrackableEntry(db, track2, days[0], 3);
  await setTrackableEntry(db, track2, days[1], 4);
  await setTrackableEntry(db, track2, days[2], 5);
  await setTrackableEntry(db, track2, days[3], 2);

  await setTrackableEntry(db, track3, days[1], 8);
  await setTrackableEntry(db, track3, days[2], 6);
  await setTrackableEntry(db, track3, days[3], 8);
  await setTrackableEntry(db, track3, days[4], 7);

  return success({ seeded: true, email, password });
};
