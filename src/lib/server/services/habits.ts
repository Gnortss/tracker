import type { D1Database } from '@cloudflare/workers-types';
import type { Habit } from '$lib/types';
import { isValidDate } from '$lib/server/dates';
import { toBool, toIntBool } from '$lib/server/db';

type HabitRow = {
  id: string;
  name: string;
  sort_order: number;
  active: number;
  created_at: string;
  updated_at: string;
};

const mapHabit = (row: HabitRow): Habit => ({
  id: row.id,
  name: row.name,
  sort_order: row.sort_order ?? 0,
  active: toBool(row.active),
  created_at: row.created_at,
  updated_at: row.updated_at
});

export const listHabits = async (db: D1Database, userId: string): Promise<Habit[]> => {
  const result = await db
    .prepare(
      `SELECT id, name, sort_order, active, created_at, updated_at
       FROM habits
       WHERE user_id = ?
       ORDER BY active DESC, sort_order ASC, name ASC`
    )
    .bind(userId)
    .all<HabitRow>();
  return (result.results ?? []).map(mapHabit);
};

export const getHabitById = async (db: D1Database, userId: string, id: string): Promise<Habit | null> => {
  const row = await db
    .prepare('SELECT id, name, sort_order, active, created_at, updated_at FROM habits WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first<HabitRow>();
  if (!row) return null;
  return mapHabit(row);
};

export const createHabit = async (
  db: D1Database,
  userId: string,
  input: { name: string; sort_order?: number }
): Promise<Habit> => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO habits (id, user_id, name, sort_order, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`
    )
    .bind(id, userId, input.name, input.sort_order ?? 0, now, now)
    .run();
  return {
    id,
    name: input.name,
    sort_order: input.sort_order ?? 0,
    active: true,
    created_at: now,
    updated_at: now
  };
};

export const updateHabit = async (
  db: D1Database,
  userId: string,
  id: string,
  updates: Partial<{ name: string; sort_order: number; active: boolean }>
): Promise<Habit | null> => {
  const existing = await db
    .prepare('SELECT id, name, sort_order, active, created_at, updated_at FROM habits WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first<HabitRow>();
  if (!existing) return null;
  const next: HabitRow = {
    ...existing,
    name: updates.name ?? existing.name,
    sort_order: updates.sort_order ?? existing.sort_order,
    active: updates.active === undefined ? existing.active : toIntBool(updates.active)
  };
  const now = new Date().toISOString();
  await db
    .prepare('UPDATE habits SET name = ?, sort_order = ?, active = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(next.name, next.sort_order, next.active, now, id, userId)
    .run();
  return mapHabit({ ...next, updated_at: now });
};

export const deleteHabit = async (db: D1Database, userId: string, id: string): Promise<boolean> => {
  const res = await db.prepare('DELETE FROM habits WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return (res.success ?? false) || res.changes > 0;
};

export const setHabitEntry = async (db: D1Database, habitId: string, day: string, done: boolean) => {
  if (!isValidDate(day)) throw new Error('INVALID_DATE');
  if (done) {
    await db.prepare('INSERT OR IGNORE INTO habit_entries (habit_id, day, created_at) VALUES (?, ?, ?)').bind(habitId, day, new Date().toISOString()).run();
    return { done: true };
  }
  await db.prepare('DELETE FROM habit_entries WHERE habit_id = ? AND day = ?').bind(habitId, day).run();
  return { done: false };
};

export const toggleHabitEntry = async (db: D1Database, habitId: string, day: string) => {
  if (!isValidDate(day)) throw new Error('INVALID_DATE');
  const removed = await db.prepare('DELETE FROM habit_entries WHERE habit_id = ? AND day = ?').bind(habitId, day).run();
  if ((removed.success ?? false) || removed.changes > 0) {
    return { done: false };
  }
  await db.prepare('INSERT INTO habit_entries (habit_id, day, created_at) VALUES (?, ?, ?)').bind(habitId, day, new Date().toISOString()).run();
  return { done: true };
};

export const getHabitEntriesForRange = async (db: D1Database, habitIds: string[], start: string, end: string) => {
  if (!habitIds.length) return {};
  const placeholders = habitIds.map(() => '?').join(', ');
  const rows = await db
    .prepare(
      `SELECT habit_id, day
       FROM habit_entries
       WHERE habit_id IN (${placeholders})
         AND day BETWEEN ? AND ?`
    )
    .bind(...habitIds, start, end)
    .all<{ habit_id: string; day: string }>();
  const map: Record<string, Record<string, 1>> = {};
  (rows.results ?? []).forEach((row) => {
    if (!map[row.habit_id]) map[row.habit_id] = {};
    map[row.habit_id][row.day] = 1;
  });
  return map;
};
