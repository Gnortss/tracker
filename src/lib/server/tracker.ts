import type { D1Database } from '@cloudflare/workers-types';
import type { Trackable, TrackableConfig, TrackableWithValue, ValueType, StatsTodayPayload, StatsRangePayload } from '$lib/types';
import { isValidDate, daysAgo, rangeDays } from './dates';

const RANGE_MIN = 1;
const RANGE_MAX = 5;
const RANGE_DEFAULT = 3;

const parseConfig = (configJson: string): TrackableConfig => {
  try {
    const parsed = JSON.parse(configJson);
    return parsed ?? {};
  } catch (err) {
    return {};
  }
};

const configToJson = (config: TrackableConfig): string => JSON.stringify(config ?? {});

const coerceValueType = (valueType: string): ValueType => {
  if (valueType === 'boolean') return 'boolean';
  return 'range';
};

const clampRange = (value: number): number => Math.min(RANGE_MAX, Math.max(RANGE_MIN, value));

const normalizeConfigForType = (valueType: ValueType, config?: TrackableConfig): TrackableConfig => {
  const cfg = config ?? {};
  if (valueType === 'boolean') {
    return { ...cfg, default: typeof cfg.default === 'boolean' ? cfg.default : false };
  }
  const rawDefault = typeof cfg.default === 'number' && Number.isFinite(cfg.default) ? Math.trunc(cfg.default) : RANGE_DEFAULT;
  return { ...cfg, min: RANGE_MIN, max: RANGE_MAX, default: clampRange(rawDefault) };
};

const defaultForType = (valueType: ValueType): boolean | number | null => {
  switch (valueType) {
    case 'boolean':
      return false;
    case 'range':
      return RANGE_DEFAULT;
    default:
      return null;
  }
};

export const defaultValueFor = (trackable: Trackable): boolean | number | null => {
  const cfg = normalizeConfigForType(trackable.value_type, trackable.config);
  if (cfg.default === undefined || cfg.default === null) return defaultForType(trackable.value_type);
  if (trackable.value_type === 'boolean') return Boolean(cfg.default);
  if (trackable.value_type === 'range') return clampRange(Math.trunc(Number(cfg.default)));
  return null;
};

type EntryRow = {
  trackable_id: string;
  date: string;
  value_type: ValueType | 'int';
  value_bool: number | null;
  value_int: number | null;
  value_num: number | null;
  value_text: string | null;
};

const typedValueFromRow = (row: EntryRow): boolean | number | null => {
  switch (row.value_type) {
    case 'boolean':
      return Boolean(row.value_bool);
    case 'int':
    case 'range':
      return row.value_int ?? null;
    default:
      return null;
  }
};

const normalizeValue = (value: unknown, trackable: Trackable): { ok: true; value: boolean | number | null } | { ok: false; error: string } => {
  const cfg = normalizeConfigForType(trackable.value_type, trackable.config);
  switch (trackable.value_type) {
    case 'boolean':
      if (typeof value !== 'boolean') return { ok: false, error: 'Expected boolean' };
      return { ok: true, value };
    case 'range': {
      const num = Number(value);
      if (!Number.isInteger(num)) return { ok: false, error: 'Expected integer' };
      if (num < RANGE_MIN || num > RANGE_MAX) return { ok: false, error: 'OUT_OF_RANGE' };
      return { ok: true, value: num };
    }
    default:
      return { ok: false, error: 'INVALID_VALUE' };
  }
};

const toEntryBindings = (trackable: Trackable, value: boolean | number | null) => {
  switch (trackable.value_type) {
    case 'boolean':
      return { value_bool: value ? 1 : 0, value_int: null, value_num: null, value_text: null };
    case 'range':
      return { value_bool: null, value_int: Number(value), value_num: null, value_text: null };
    default:
      return { value_bool: null, value_int: null, value_num: null, value_text: null };
  }
};

export const fetchTrackables = async (db: D1Database): Promise<Trackable[]> => {
  const result = await db
    .prepare(
      `SELECT id, key, name, kind, value_type, config_json, icon, color, sort_order
       FROM trackables WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC`
    )
    .all();
  return (result.results ?? []).map((row: any) => {
    const valueType = coerceValueType(String(row.value_type ?? 'range'));
    const config = normalizeConfigForType(valueType, parseConfig(row.config_json));
    return {
      id: row.id,
      key: row.key ?? null,
      name: row.name,
      kind: row.kind,
      value_type: valueType,
      config,
      icon: row.icon ?? null,
      color: row.color ?? null,
      sort_order: row.sort_order ?? 0
    };
  });
};

export const getTrackableById = async (db: D1Database, id: string): Promise<Trackable | null> => {
  const row = await db
    .prepare(
      `SELECT id, key, name, kind, value_type, config_json, icon, color, sort_order
       FROM trackables WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(id)
    .first();
  if (!row) return null;
  const valueType = coerceValueType(String(row.value_type ?? 'range'));
  const config = normalizeConfigForType(valueType, parseConfig(row.config_json));
  return {
    id: row.id,
    key: row.key ?? null,
    name: row.name,
    kind: row.kind,
    value_type: valueType,
    config,
    icon: row.icon ?? null,
    color: row.color ?? null,
    sort_order: row.sort_order ?? 0
  } satisfies Trackable;
};

export const getTrackableByKey = async (db: D1Database, key: string): Promise<Trackable | null> => {
  const row = await db
    .prepare(
      `SELECT id, key, name, kind, value_type, config_json, icon, color, sort_order
       FROM trackables WHERE key = ? AND deleted_at IS NULL`
    )
    .bind(key)
    .first();
  if (!row) return null;
  const valueType = coerceValueType(String(row.value_type ?? 'range'));
  const config = normalizeConfigForType(valueType, parseConfig(row.config_json));
  return {
    id: row.id,
    key: row.key ?? null,
    name: row.name,
    kind: row.kind,
    value_type: valueType,
    config,
    icon: row.icon ?? null,
    color: row.color ?? null,
    sort_order: row.sort_order ?? 0
  } satisfies Trackable;
};

const entryMapByDate = (rows: EntryRow[]) => {
  const map = new Map<string, EntryRow>();
  rows.forEach((row) => map.set(`${row.trackable_id}-${row.date}`, row));
  return map;
};

export const todayStats = async (db: D1Database, date: string): Promise<StatsTodayPayload> => {
  const trackables = await fetchTrackables(db);
  const entryRows = await db
    .prepare(
      `SELECT e.trackable_id, e.date, e.value_type, e.value_bool, e.value_int, e.value_num, e.value_text
       FROM daily_entries e
       JOIN trackables t ON t.id = e.trackable_id
       WHERE e.date = ? AND t.deleted_at IS NULL`
    )
    .bind(date)
    .all<EntryRow>();

  const map = entryMapByDate(entryRows.results as EntryRow[]);

  let habitsDone = 0;
  let habitsTotal = 0;

  const trackablesWithValues: TrackableWithValue[] = trackables.map((t) => {
    const row = map.get(`${t.id}-${date}`);
    const defaultValue = defaultValueFor(t);
    const value = row ? typedValueFromRow(row) : defaultValue;
    const isDefault = !row;
    if (t.kind === 'habit' && t.value_type === 'boolean') {
      habitsTotal += 1;
      if (value === true) habitsDone += 1;
    }
    return { ...t, value, is_default: isDefault };
  });

  return {
    date,
    trackables: trackablesWithValues,
    aggregates: { habits_done_today: habitsDone, habits_total: habitsTotal }
  };
};

export const rangeStats = async (db: D1Database, days: number, endDate: string): Promise<StatsRangePayload> => {
  const cappedDays = Math.min(Math.max(days, 1), 90);
  const end = endDate;
  const start = daysAgo(end, cappedDays - 1);
  return rangeStatsForRange(db, start, end);
};

const rangeStatsForRange = async (db: D1Database, start: string, end: string): Promise<StatsRangePayload> => {
  const daysList = rangeDays(start, end);
  const trackables = await fetchTrackables(db);
  const rows = await db
    .prepare(
      `SELECT e.trackable_id, e.date, e.value_type, e.value_bool, e.value_int, e.value_num, e.value_text
       FROM daily_entries e
       JOIN trackables t ON t.id = e.trackable_id
       WHERE e.date BETWEEN ? AND ? AND t.deleted_at IS NULL`
    )
    .bind(start, end)
    .all<EntryRow>();
  const map: Record<string, Record<string, boolean | number | null>> = {};
  (rows.results as EntryRow[]).forEach((row) => {
    if (!map[row.trackable_id]) map[row.trackable_id] = {};
    map[row.trackable_id][row.date] = typedValueFromRow(row);
  });

  const defaults: Record<string, boolean | number | null> = {};
  trackables.forEach((t) => {
    defaults[t.id] = defaultValueFor(t);
  });

  return {
    start_date: start,
    end_date: end,
    days: daysList,
    trackables,
    defaults,
    values: map
  };
};

const earliestDate = async (db: D1Database, fallback: string): Promise<string> => {
  const entryRow = await db
    .prepare(`SELECT MIN(date) as min_date FROM daily_entries`)
    .first<{ min_date: string | null }>();
  const trackRow = await db
    .prepare(`SELECT MIN(substr(created_at, 1, 10)) as min_date FROM trackables WHERE deleted_at IS NULL`)
    .first<{ min_date: string | null }>();
  const candidates = [entryRow?.min_date, trackRow?.min_date].filter(Boolean) as string[];
  if (!candidates.length) return fallback;
  candidates.sort();
  return candidates[0];
};

export const rangeStatsAll = async (db: D1Database, endDate: string): Promise<StatsRangePayload> => {
  const start = await earliestDate(db, endDate);
  return rangeStatsForRange(db, start, endDate);
};

export const createTrackable = async (
  db: D1Database,
  input: {
    name: string;
    key?: string | null;
    kind: string;
    value_type: ValueType;
    config?: TrackableConfig;
    icon?: string | null;
    color?: string | null;
    sort_order?: number;
  }
): Promise<Trackable> => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const config = normalizeConfigForType(input.value_type, input.config);
  await db
    .prepare(
      `INSERT INTO trackables (id, key, name, kind, value_type, config_json, icon, color, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.key ?? null,
      input.name,
      input.kind,
      input.value_type,
      configToJson(config),
      input.icon ?? null,
      input.color ?? null,
      input.sort_order ?? 0,
      now,
      now
    )
    .run();

  return {
    id,
    key: input.key ?? null,
    name: input.name,
    kind: input.kind,
    value_type: input.value_type,
    config,
    icon: input.icon ?? null,
    color: input.color ?? null,
    sort_order: input.sort_order ?? 0
  } satisfies Trackable;
};

export const updateTrackable = async (
  db: D1Database,
  id: string,
  updates: Partial<{ name: string; key: string | null; kind: string; value_type: ValueType; config: TrackableConfig; icon: string | null; color: string | null; sort_order: number }>
): Promise<Trackable | null> => {
  const existing = await getTrackableById(db, id);
  if (!existing) return null;
  const next: Trackable = {
    ...existing,
    ...('name' in updates && updates.name !== undefined ? { name: updates.name } : {}),
    ...('key' in updates ? { key: updates.key ?? null } : {}),
    ...('kind' in updates && updates.kind !== undefined ? { kind: updates.kind } : {}),
    ...('value_type' in updates && updates.value_type ? { value_type: updates.value_type } : {}),
    ...('config' in updates && updates.config ? { config: updates.config } : {}),
    ...('icon' in updates ? { icon: updates.icon ?? null } : {}),
    ...('color' in updates ? { color: updates.color ?? null } : {}),
    ...('sort_order' in updates && updates.sort_order !== undefined ? { sort_order: updates.sort_order } : {})
  };
  next.config = normalizeConfigForType(next.value_type, next.config);
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE trackables SET key = ?, name = ?, kind = ?, value_type = ?, config_json = ?, icon = ?, color = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      next.key ?? null,
      next.name,
      next.kind,
      next.value_type,
      configToJson(next.config),
      next.icon ?? null,
      next.color ?? null,
      next.sort_order,
      now,
      id
    )
    .run();
  return next;
};

export const softDeleteTrackable = async (db: D1Database, id: string): Promise<boolean> => {
  const now = new Date().toISOString();
  const res = await db.prepare(`UPDATE trackables SET deleted_at = ?, updated_at = ? WHERE id = ?`).bind(now, now, id).run();
  return (res.success ?? false) || res.changes > 0;
};

export const setEntry = async (db: D1Database, trackable: Trackable, date: string, value: unknown) => {
  if (!isValidDate(date)) throw new Error('INVALID_DATE');
  const normalized = normalizeValue(value, trackable);
  if (!normalized.ok) throw new Error(normalized.error);
  const typed = normalized.value;
  const defaultValue = defaultValueFor(trackable);
  if (typed === defaultValue) {
    await clearEntry(db, trackable.id, date);
    return { value: defaultValue, is_default: true };
  }

  const bindings = toEntryBindings(trackable, typed);
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO daily_entries (trackable_id, date, value_type, value_bool, value_int, value_num, value_text, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(trackable_id, date) DO UPDATE SET value_type = excluded.value_type, value_bool = excluded.value_bool, value_int = excluded.value_int, value_num = excluded.value_num, value_text = excluded.value_text, updated_at = excluded.updated_at`
    )
    .bind(trackable.id, date, trackable.value_type, bindings.value_bool, bindings.value_int, bindings.value_num, bindings.value_text, now)
    .run();

  return { value: typed, is_default: false };
};

export const clearEntry = async (db: D1Database, trackableId: string, date: string) => {
  if (!isValidDate(date)) throw new Error('INVALID_DATE');
  await db.prepare(`DELETE FROM daily_entries WHERE trackable_id = ? AND date = ?`).bind(trackableId, date).run();
};

export const toggleEntry = async (db: D1Database, trackable: Trackable, date: string) => {
  if (trackable.value_type !== 'boolean') throw new Error('INVALID_ACTION');
  if (!isValidDate(date)) throw new Error('INVALID_DATE');
  const currentRow = await db
    .prepare(
      `SELECT trackable_id, date, value_type, value_bool, value_int, value_num, value_text FROM daily_entries WHERE trackable_id = ? AND date = ?`
    )
    .bind(trackable.id, date)
    .first<EntryRow>();
  const defaultValue = defaultValueFor(trackable) as boolean;
  const currentValue = currentRow ? (typedValueFromRow(currentRow) as boolean) : defaultValue;
  const nextValue = !currentValue;
  return setEntry(db, trackable, date, nextValue);
};

export const validateTrackableInput = (input: any): { ok: boolean; message?: string } => {
  if (!input || typeof input !== 'object') return { ok: false, message: 'Invalid payload' };
  const required = ['name', 'kind', 'value_type'];
  for (const key of required) {
    if (!input[key]) return { ok: false, message: `Missing ${key}` };
  }
  if (!['boolean', 'range'].includes(input.value_type)) return { ok: false, message: 'Unsupported value_type' };
  return { ok: true };
};
