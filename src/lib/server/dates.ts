const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isValidDate = (value: string): boolean => {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

export const getTodayDate = (tz?: string): string => {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz ?? 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
    return fmt.format(new Date());
  } catch (err) {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
    return fmt.format(new Date());
  }
};

export const rangeDays = (start: string, end: string): string[] => {
  const result: string[] = [];
  const startDate = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');
  for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    result.push(new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(d));
  }
  return result;
};

export const daysAgo = (date: string, days: number): string => {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(d);
};
