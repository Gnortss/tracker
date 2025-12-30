import type { RequestHandler } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types';
import { success, fail } from '$lib/server/apiResponse';
import { requireAuth } from '$lib/server/auth';
import { isValidDate } from '$lib/server/dates';
import {
  clearEntry,
  createTrackable,
  getTrackableById,
  getTrackableByKey,
  setEntry,
  softDeleteTrackable,
  toggleEntry,
  updateTrackable,
  validateTrackableInput
} from '$lib/server/tracker';

const invalidAction = () => fail('INVALID_ACTION', 'Unsupported action');

const resolveTrackable = async (db: D1Database, id?: string | null, key?: string | null) => {
  if (id) return getTrackableById(db, id);
  if (key) return getTrackableByKey(db, key);
  return null;
};

export const POST: RequestHandler = async ({ request, platform }) => {
  const authError = requireAuth(request, platform?.env?.API_TOKEN);
  if (authError) return authError;
  if (!platform?.env?.DB) return fail('SERVER_ERROR', 'Database binding missing', 500);

  let body: any;
  try {
    body = await request.json();
  } catch (err) {
    return fail('INVALID_PAYLOAD', 'JSON body is required');
  }

  const { action } = body ?? {};
  if (!action || typeof action !== 'string') return invalidAction();

  try {
    switch (action) {
      case 'trackable.create': {
        const validation = validateTrackableInput(body);
        if (!validation.ok) return fail('INVALID_VALUE', validation.message ?? 'Invalid trackable payload');
        const created = await createTrackable(platform.env.DB!, {
          name: body.name,
          key: body.key ?? null,
          kind: body.kind,
          value_type: body.value_type,
          config: body.config ?? {},
          icon: body.icon ?? null,
          color: body.color ?? null,
          sort_order: body.sort_order ?? 0
        });
        return success(created, { status: 201 });
      }
      case 'trackable.update': {
        if (!body.id) return fail('INVALID_VALUE', 'id is required');
        if (body.value_type && !['boolean', 'range'].includes(body.value_type)) {
          return fail('INVALID_VALUE', 'Unsupported value_type');
        }
        const updated = await updateTrackable(platform.env.DB!, body.id, {
          name: body.name,
          key: body.key,
          kind: body.kind,
          value_type: body.value_type,
          config: body.config,
          icon: body.icon,
          color: body.color,
          sort_order: body.sort_order
        });
        if (!updated) return fail('NOT_FOUND', 'Trackable not found', 404);
        return success(updated);
      }
      case 'trackable.delete': {
        if (!body.id) return fail('INVALID_VALUE', 'id is required');
        const ok = await softDeleteTrackable(platform.env.DB!, body.id);
        if (!ok) return fail('NOT_FOUND', 'Trackable not found', 404);
        return success({ deleted: true });
      }
      case 'entry.set': {
        const { trackable_id, trackable_key, date, value } = body;
        if ((!trackable_id && !trackable_key) || !date) return fail('INVALID_VALUE', 'trackable_id/key and date are required');
        if (!isValidDate(date)) return fail('INVALID_DATE', 'Date must be YYYY-MM-DD');
        const trackable = await resolveTrackable(platform.env.DB!, trackable_id, trackable_key);
        if (!trackable) return fail('NOT_FOUND', 'Trackable not found', 404);
        const result = await setEntry(platform.env.DB!, trackable, date, value);
        return success({ trackable_id: trackable.id, date, ...result });
      }
      case 'entry.clear': {
        const { trackable_id, trackable_key, date } = body;
        if ((!trackable_id && !trackable_key) || !date) return fail('INVALID_VALUE', 'trackable_id/key and date are required');
        if (!isValidDate(date)) return fail('INVALID_DATE', 'Date must be YYYY-MM-DD');
        const trackable = await resolveTrackable(platform.env.DB!, trackable_id, trackable_key);
        if (!trackable) return fail('NOT_FOUND', 'Trackable not found', 404);
        await clearEntry(platform.env.DB!, trackable.id, date);
        return success({ trackable_id: trackable.id, date, cleared: true });
      }
      case 'entry.toggle': {
        const { trackable_id, trackable_key, date } = body;
        if ((!trackable_id && !trackable_key) || !date) return fail('INVALID_VALUE', 'trackable_id/key and date are required');
        if (!isValidDate(date)) return fail('INVALID_DATE', 'Date must be YYYY-MM-DD');
        const trackable = await resolveTrackable(platform.env.DB!, trackable_id, trackable_key);
        if (!trackable) return fail('NOT_FOUND', 'Trackable not found', 404);
        const result = await toggleEntry(platform.env.DB!, trackable, date);
        return success({ trackable_id: trackable.id, date, ...result });
      }
      default:
        return invalidAction();
    }
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Server error';
    if (message === 'INVALID_DATE') return fail('INVALID_DATE', 'Date must be YYYY-MM-DD');
    if (message === 'INVALID_ACTION') return invalidAction();
    if (message === 'OUT_OF_RANGE') return fail('OUT_OF_RANGE', 'Value outside allowed range');
    if (message === 'INVALID_VALUE') return fail('INVALID_VALUE', 'Invalid value');
    return fail('SERVER_ERROR', 'Unable to process action', 500);
  }
};
