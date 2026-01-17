import type { RequestHandler } from '@sveltejs/kit';
import { fail, success } from '$lib/server/apiResponse';
import { requireUser } from '$lib/server/auth';
import { deleteHabit, updateHabit } from '$lib/server/services/habits';

export const PATCH: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const auth = await requireUser(event);
  if (auth instanceof Response) return auth;
  const { id } = event.params;
  let body: { name?: string; sort_order?: number; active?: boolean };
  try {
    body = await event.request.json();
  } catch (err) {
    return fail('INVALID_PAYLOAD', 'JSON body is required');
  }
  try {
    const sortOrderRaw = body.sort_order;
    const sortOrder = sortOrderRaw !== undefined && Number.isFinite(Number(sortOrderRaw)) ? Number(sortOrderRaw) : undefined;
    const habit = await updateHabit(db, auth.user.id, id, {
      name: body.name?.trim() || undefined,
      sort_order: sortOrder,
      active: body.active
    });
    if (!habit) return fail('NOT_FOUND', 'Habit not found', 404);
    return success(habit);
  } catch (err: any) {
    if (String(err?.message ?? '').includes('UNIQUE')) {
      return fail('CONFLICT', 'Habit name already exists', 409);
    }
    return fail('SERVER_ERROR', 'Unable to update habit', 500);
  }
};

export const DELETE: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const auth = await requireUser(event);
  if (auth instanceof Response) return auth;
  const ok = await deleteHabit(db, auth.user.id, event.params.id);
  if (!ok) return fail('NOT_FOUND', 'Habit not found', 404);
  return success({ deleted: true });
};
