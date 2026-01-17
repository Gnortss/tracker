import type { D1Database } from '@cloudflare/workers-types';
import type { Habit, HabitStats, Trackable, TrackableStats } from '$lib/types';
import { addDays, monthEnd, monthStart, rangeDays, yearStart } from '$lib/server/dates';

const percent = (value: number, total: number) => (total ? Math.round((value / total) * 100) : 0);

const roundTo = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const buildEntrySet = (rows: { habit_id: string; day: string }[]) => {
  const map = new Map<string, Set<string>>();
  rows.forEach((row) => {
    if (!map.has(row.habit_id)) map.set(row.habit_id, new Set());
    map.get(row.habit_id)!.add(row.day);
  });
  return map;
};

const buildTrackableMap = (rows: { trackable_id: string; day: string; value: number }[]) => {
  const map = new Map<string, Map<string, number>>();
  rows.forEach((row) => {
    if (!map.has(row.trackable_id)) map.set(row.trackable_id, new Map());
    map.get(row.trackable_id)!.set(row.day, row.value);
  });
  return map;
};

const countDone = (days: string[], done: Set<string>) => days.reduce((acc, day) => acc + (done.has(day) ? 1 : 0), 0);

const countTrackable = (days: string[], values: Map<string, number>) =>
  days.reduce((acc, day) => acc + (values.has(day) ? 1 : 0), 0);

const sumTrackable = (days: string[], values: Map<string, number>) =>
  days.reduce((acc, day) => acc + (values.has(day) ? values.get(day)! : 0), 0);

const bestStreak = (days: string[], done: Set<string>) => {
  let streak = 0;
  let best = 0;
  for (const day of days) {
    if (done.has(day)) {
      streak += 1;
      best = Math.max(best, streak);
    } else {
      streak = 0;
    }
  }
  return best;
};

const currentStreak = (today: string, done: Set<string>) => {
  let streak = 0;
  let cursor = today;
  while (done.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
};

const currentEntryStreak = (today: string, values: Map<string, number>) => {
  let streak = 0;
  let cursor = today;
  while (values.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
};

export const computeStats = async (
  db: D1Database,
  _userId: string,
  today: string,
  habits: Habit[],
  trackables: Trackable[],
  targetYear: number,
  targetMonth: number
) => {
  const monthKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const yearEnd = targetYear === currentYear ? today : `${targetYear}-12-31`;
  const monthEndDay = targetYear === currentYear && targetMonth === currentMonth ? today : monthEnd(targetYear, targetMonth);

  const yearDays = rangeDays(yearStart(targetYear), yearEnd);
  const monthDays = rangeDays(monthStart(targetYear, targetMonth), monthEndDay);

  const habitEntries =
    habits.length === 0
      ? new Map<string, Set<string>>()
      : buildEntrySet(
          (
            await db
              .prepare(
                `SELECT habit_id, day
                 FROM habit_entries
                 WHERE habit_id IN (${habits.map(() => '?').join(', ')})
                   AND day BETWEEN ? AND ?`
              )
              .bind(...habits.map((h) => h.id), yearStart(targetYear), yearEnd)
              .all<{ habit_id: string; day: string }>()
          ).results ?? []
        );

  const trackableEntries =
    trackables.length === 0
      ? new Map<string, Map<string, number>>()
      : buildTrackableMap(
          (
            await db
              .prepare(
                `SELECT trackable_id, day, value
                 FROM trackable_entries
                 WHERE trackable_id IN (${trackables.map(() => '?').join(', ')})
                   AND day BETWEEN ? AND ?`
              )
              .bind(...trackables.map((t) => t.id), yearStart(targetYear), yearEnd)
              .all<{ trackable_id: string; day: string; value: number }>()
          ).results ?? []
        );

  const habitStats: Record<string, HabitStats> = {};
  for (const habit of habits) {
    const done = habitEntries.get(habit.id) ?? new Set<string>();
    const startDay = habit.created_at.slice(0, 10);
    const historyDays = rangeDays(startDay, today);
    const yearlyDone = countDone(yearDays, done);
    const monthlyDone = countDone(monthDays, done);
    habitStats[habit.id] = {
      yearly_completion: percent(yearlyDone, yearDays.length),
      monthly_completion: percent(monthlyDone, monthDays.length),
      best_streak: bestStreak(historyDays, done),
      current_streak: currentStreak(today, done),
      missing_count: Math.max(0, monthDays.length - monthlyDone)
    };
  }

  const trackableStats: Record<string, TrackableStats> = {};
  for (const trackable of trackables) {
    const values = trackableEntries.get(trackable.id) ?? new Map<string, number>();
    const yearlyCount = countTrackable(yearDays, values);
    const monthlyCount = countTrackable(monthDays, values);
    const monthlySum = sumTrackable(monthDays, values);
    const average = monthlyCount ? roundTo(monthlySum / monthlyCount, 1) : null;
    trackableStats[trackable.id] = {
      yearly_completion: percent(yearlyCount, yearDays.length),
      monthly_completion: percent(monthlyCount, monthDays.length),
      current_streak: currentEntryStreak(today, values),
      average_value: average,
      missed_count: Math.max(0, monthDays.length - monthlyCount)
    };
  }

  return {
    year: targetYear,
    month: monthKey,
    days_elapsed_year: yearDays.length,
    days_elapsed_month: monthDays.length,
    habit_stats: habitStats,
    trackable_stats: trackableStats
  };
};
