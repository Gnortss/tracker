import type { RequestHandler } from '@sveltejs/kit';
import { fail, success } from '$lib/server/apiResponse';
import { requireUser } from '$lib/server/auth';
import { getHabitById, setHabitEntry, toggleHabitEntry } from '$lib/server/services/habits';

export const PUT: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const auth = await requireUser(event);
  if (auth instanceof Response) return auth;
  const { id, day } = event.params;
  const habit = await getHabitById(db, auth.user.id, id);
  if (!habit) return fail('NOT_FOUND', 'Habit not found', 404);
  let done: boolean | undefined;
  if (event.request.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = await event.request.json();
      if (typeof body?.done === 'boolean') done = body.done;
    } catch (err) {
      return fail('INVALID_PAYLOAD', 'JSON body is required');
    }
  }
  try {
    const result = done === undefined ? await toggleHabitEntry(db, habit.id, day) : await setHabitEntry(db, habit.id, day, done);
    return success({ habit_id: habit.id, day, ...result });
  } catch (err: any) {
    if (String(err?.message ?? '') === 'INVALID_DATE') {
      return fail('INVALID_DATE', 'Date must be YYYY-MM-DD');
    }
    return fail('SERVER_ERROR', 'Unable to update habit entry', 500);
  }
};
