import type { D1Database } from '@cloudflare/workers-types';

export const requireDb = (db: D1Database | undefined): D1Database => {
  if (!db) {
    throw new Error('DB_MISSING');
  }
  return db;
};

export const toBool = (value: number | null | undefined): boolean => Boolean(value);
export const toIntBool = (value: boolean): number => (value ? 1 : 0);
