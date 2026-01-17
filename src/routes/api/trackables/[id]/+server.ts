import type { RequestHandler } from '@sveltejs/kit';
import { fail, success } from '$lib/server/apiResponse';
import { requireUser } from '$lib/server/auth';
import { deleteTrackable, updateTrackable } from '$lib/server/services/trackables';

export const PATCH: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const auth = await requireUser(event);
  if (auth instanceof Response) return auth;
  const { id } = event.params;
  let body: { name?: string; unit?: string | null; min_value?: number; max_value?: number | null; sort_order?: number; active?: boolean };
  try {
    body = await event.request.json();
  } catch (err) {
    return fail('INVALID_PAYLOAD', 'JSON body is required');
  }
  try {
    const nextName = body.name?.trim();
    const nextUnit = body.unit === undefined ? undefined : body.unit?.trim() || null;
    const minValueRaw = body.min_value;
    const maxValueRaw = body.max_value;
    const minValue =
      minValueRaw !== undefined && Number.isFinite(Number(minValueRaw)) ? Number(minValueRaw) : undefined;
    const maxValue =
      maxValueRaw !== undefined && maxValueRaw !== null && Number.isFinite(Number(maxValueRaw))
        ? Number(maxValueRaw)
        : undefined;
    const trackable = await updateTrackable(db, auth.user.id, id, {
      name: nextName || undefined,
      unit: nextUnit,
      min_value: minValue,
      max_value: maxValue,
      sort_order: body.sort_order,
      active: body.active
    });
    if (!trackable) return fail('NOT_FOUND', 'Trackable not found', 404);
    return success(trackable);
  } catch (err: any) {
    if (String(err?.message ?? '').includes('UNIQUE')) {
      return fail('CONFLICT', 'Trackable name already exists', 409);
    }
    return fail('SERVER_ERROR', 'Unable to update trackable', 500);
  }
};

export const DELETE: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const auth = await requireUser(event);
  if (auth instanceof Response) return auth;
  const ok = await deleteTrackable(db, auth.user.id, event.params.id);
  if (!ok) return fail('NOT_FOUND', 'Trackable not found', 404);
  return success({ deleted: true });
};
