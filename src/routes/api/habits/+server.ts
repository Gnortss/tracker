import type { RequestHandler } from '@sveltejs/kit';
import { fail, success } from '$lib/server/apiResponse';
import { requireUser } from '$lib/server/auth';
import { createHabit, listHabits } from '$lib/server/services/habits';

export const GET: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const auth = await requireUser(event);
  if (auth instanceof Response) return auth;
  const habits = await listHabits(db, auth.user.id);
  return success(habits);
};

export const POST: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const auth = await requireUser(event);
  if (auth instanceof Response) return auth;
  let body: { name?: string; sort_order?: number };
  try {
    body = await event.request.json();
  } catch (err) {
    return fail('INVALID_PAYLOAD', 'JSON body is required');
  }
  const name = String(body.name ?? '').trim();
  if (!name) return fail('INVALID_VALUE', 'Name is required');
  const sortOrderRaw = body.sort_order;
  const sortOrder = sortOrderRaw !== undefined && Number.isFinite(Number(sortOrderRaw)) ? Number(sortOrderRaw) : undefined;
  try {
    const habit = await createHabit(db, auth.user.id, { name, sort_order: sortOrder });
    return success(habit, { status: 201 });
  } catch (err: any) {
    if (String(err?.message ?? '').includes('UNIQUE')) {
      return fail('CONFLICT', 'Habit name already exists', 409);
    }
    return fail('SERVER_ERROR', 'Unable to create habit', 500);
  }
};
