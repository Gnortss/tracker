import type { RequestHandler } from '@sveltejs/kit';
import { fail, success } from '$lib/server/apiResponse';
import { requireUser } from '$lib/server/auth';
import { createTrackable, listTrackables } from '$lib/server/services/trackables';

export const GET: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const auth = await requireUser(event);
  if (auth instanceof Response) return auth;
  const trackables = await listTrackables(db, auth.user.id);
  return success(trackables);
};

export const POST: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const auth = await requireUser(event);
  if (auth instanceof Response) return auth;
  let body: { name?: string; unit?: string | null; min_value?: number; max_value?: number | null; sort_order?: number };
  try {
    body = await event.request.json();
  } catch (err) {
    return fail('INVALID_PAYLOAD', 'JSON body is required');
  }
  const name = String(body.name ?? '').trim();
  if (!name) return fail('INVALID_VALUE', 'Name is required');
  const unit = body.unit === undefined ? null : String(body.unit ?? '').trim() || null;
  const minValueRaw = body.min_value;
  const maxValueRaw = body.max_value;
  const minValue =
    minValueRaw !== undefined && Number.isFinite(Number(minValueRaw)) ? Number(minValueRaw) : undefined;
  const maxValue =
    maxValueRaw !== undefined && maxValueRaw !== null && Number.isFinite(Number(maxValueRaw))
      ? Number(maxValueRaw)
      : null;
  try {
    const trackable = await createTrackable(db, auth.user.id, {
      name,
      unit,
      min_value: minValue,
      max_value: maxValue,
      sort_order: body.sort_order
    });
    return success(trackable, { status: 201 });
  } catch (err: any) {
    if (String(err?.message ?? '').includes('UNIQUE')) {
      return fail('CONFLICT', 'Trackable name already exists', 409);
    }
    return fail('SERVER_ERROR', 'Unable to create trackable', 500);
  }
};
