import type { RequestHandler } from '@sveltejs/kit';
import { fail, success } from '$lib/server/apiResponse';
import { requireUser } from '$lib/server/auth';
import { getTrackableById, setTrackableEntry } from '$lib/server/services/trackables';

export const PUT: RequestHandler = async (event) => {
  const db = event.platform?.env?.DB;
  if (!db) return fail('SERVER_ERROR', 'Database binding missing', 500);
  const auth = await requireUser(event);
  if (auth instanceof Response) return auth;
  const { id, day } = event.params;
  const trackable = await getTrackableById(db, auth.user.id, id);
  if (!trackable) return fail('NOT_FOUND', 'Trackable not found', 404);
  let body: { value?: number };
  try {
    body = await event.request.json();
  } catch (err) {
    return fail('INVALID_PAYLOAD', 'JSON body is required');
  }
  if (body.value === undefined || body.value === null) {
    return fail('INVALID_VALUE', 'Value is required');
  }
  try {
    const result = await setTrackableEntry(db, trackable, day, body.value);
    return success({ trackable_id: trackable.id, day, ...result });
  } catch (err: any) {
    const message = String(err?.message ?? '');
    if (message === 'INVALID_DATE') return fail('INVALID_DATE', 'Date must be YYYY-MM-DD');
    if (message === 'OUT_OF_RANGE') return fail('OUT_OF_RANGE', 'Value outside allowed range');
    if (message === 'INVALID_VALUE') return fail('INVALID_VALUE', 'Invalid value');
    return fail('SERVER_ERROR', 'Unable to update trackable entry', 500);
  }
};
