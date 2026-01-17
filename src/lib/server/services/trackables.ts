import type { D1Database } from '@cloudflare/workers-types';
import type { Trackable } from '$lib/types';
import { isValidDate } from '$lib/server/dates';
import { toBool, toIntBool } from '$lib/server/db';

type TrackableRow = {
  id: string;
  name: string;
  unit: string | null;
  min_value: number;
  max_value: number | null;
  sort_order: number;
  active: number;
  created_at: string;
  updated_at: string;
};

const mapTrackable = (row: TrackableRow): Trackable => ({
  id: row.id,
  name: row.name,
  unit: row.unit ?? null,
  min_value: row.min_value ?? 1,
  max_value: row.max_value ?? null,
  sort_order: row.sort_order ?? 0,
  active: toBool(row.active),
  created_at: row.created_at,
  updated_at: row.updated_at
});

export const listTrackables = async (db: D1Database, userId: string): Promise<Trackable[]> => {
  const result = await db
    .prepare(
      `SELECT id, name, unit, min_value, max_value, sort_order, active, created_at, updated_at
       FROM trackables
       WHERE user_id = ?
       ORDER BY active DESC, sort_order ASC, name ASC`
    )
    .bind(userId)
    .all<TrackableRow>();
  return (result.results ?? []).map(mapTrackable);
};

export const createTrackable = async (
  db: D1Database,
  userId: string,
  input: { name: string; unit?: string | null; min_value?: number; max_value?: number | null; sort_order?: number }
): Promise<Trackable> => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const minValue = Number.isInteger(input.min_value) ? Math.max(1, input.min_value!) : 1;
  const maxValue = input.max_value !== undefined && input.max_value !== null ? Math.max(minValue, input.max_value) : null;
  await db
    .prepare(
      `INSERT INTO trackables (id, user_id, name, unit, min_value, max_value, sort_order, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
    .bind(id, userId, input.name, input.unit ?? null, minValue, maxValue, input.sort_order ?? 0, now, now)
    .run();
  return {
    id,
    name: input.name,
    unit: input.unit ?? null,
    min_value: minValue,
    max_value: maxValue,
    sort_order: input.sort_order ?? 0,
    active: true,
    created_at: now,
    updated_at: now
  };
};

export const updateTrackable = async (
  db: D1Database,
  userId: string,
  id: string,
  updates: Partial<{ name: string; unit: string | null; min_value: number; max_value: number | null; sort_order: number; active: boolean }>
): Promise<Trackable | null> => {
  const existing = await db
    .prepare('SELECT id, name, unit, min_value, max_value, sort_order, active, created_at, updated_at FROM trackables WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first<TrackableRow>();
  if (!existing) return null;
  const nextMin = updates.min_value ?? existing.min_value;
  const nextMaxRaw = updates.max_value === undefined ? existing.max_value : updates.max_value;
  const nextMax = nextMaxRaw !== null && nextMaxRaw !== undefined ? Math.max(nextMin, nextMaxRaw) : null;
  const nextUnit = updates.unit === undefined ? existing.unit : updates.unit;
  const next: TrackableRow = {
    ...existing,
    name: updates.name ?? existing.name,
    unit: nextUnit,
    min_value: Math.max(1, nextMin),
    max_value: nextMax,
    sort_order: updates.sort_order ?? existing.sort_order,
    active: updates.active === undefined ? existing.active : toIntBool(updates.active)
  };
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE trackables
       SET name = ?, unit = ?, min_value = ?, max_value = ?, sort_order = ?, active = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    )
    .bind(next.name, next.unit ?? null, next.min_value, next.max_value, next.sort_order, next.active, now, id, userId)
    .run();
  return mapTrackable({ ...next, updated_at: now });
};

export const deleteTrackable = async (db: D1Database, userId: string, id: string): Promise<boolean> => {
  const res = await db.prepare('DELETE FROM trackables WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return (res.success ?? false) || res.changes > 0;
};

export const setTrackableEntry = async (
  db: D1Database,
  trackable: Trackable,
  day: string,
  value: number
) => {
  if (!isValidDate(day)) throw new Error('INVALID_DATE');
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) throw new Error('INVALID_VALUE');
  if (numeric <= 0) {
    await db.prepare('DELETE FROM trackable_entries WHERE trackable_id = ? AND day = ?').bind(trackable.id, day).run();
    return { value: 0 };
  }
  if (numeric < trackable.min_value) throw new Error('OUT_OF_RANGE');
  if (trackable.max_value !== null && numeric > trackable.max_value) throw new Error('OUT_OF_RANGE');
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO trackable_entries (trackable_id, day, value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(trackable_id, day)
       DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(trackable.id, day, numeric, now, now)
    .run();
  return { value: numeric };
};

export const getTrackableEntriesForRange = async (db: D1Database, trackableIds: string[], start: string, end: string) => {
  if (!trackableIds.length) return {};
  const placeholders = trackableIds.map(() => '?').join(', ');
  const rows = await db
    .prepare(
      `SELECT trackable_id, day, value
       FROM trackable_entries
       WHERE trackable_id IN (${placeholders})
         AND day BETWEEN ? AND ?`
    )
    .bind(...trackableIds, start, end)
    .all<{ trackable_id: string; day: string; value: number }>();
  const map: Record<string, Record<string, number>> = {};
  (rows.results ?? []).forEach((row) => {
    if (!map[row.trackable_id]) map[row.trackable_id] = {};
    map[row.trackable_id][row.day] = row.value;
  });
  return map;
};

export const getTrackableById = async (db: D1Database, userId: string, id: string): Promise<Trackable | null> => {
  const row = await db
    .prepare('SELECT id, name, unit, min_value, max_value, sort_order, active, created_at, updated_at FROM trackables WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first<TrackableRow>();
  if (!row) return null;
  return mapTrackable(row);
};
