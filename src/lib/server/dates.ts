const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isValidDate = (value: string): boolean => {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

export const formatDate = (date: Date, tz: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export const formatUtcDate = (date: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export const getTodayDate = (tz?: string): string => formatDate(new Date(), tz ?? 'UTC');

export const addDays = (day: string, delta: number): string => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return formatUtcDate(date);
};

export const rangeDays = (start: string, end: string): string[] => {
  const result: string[] = [];
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    result.push(formatUtcDate(d));
  }
  return result;
};

export const parseYearMonth = (value: string): { year: number; month: number } | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
};

export const monthStart = (year: number, month: number): string => {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return formatUtcDate(date);
};

export const monthEnd = (year: number, month: number): string => {
  const date = new Date(Date.UTC(year, month, 0));
  return formatUtcDate(date);
};

export const yearStart = (year: number): string => `${year}-01-01`;
