import type { ApiError, ApiSuccess } from '$lib/types';

export const success = <T>(data: T, init?: ResponseInit): Response =>
  new Response(JSON.stringify({ ok: true, data } satisfies ApiSuccess<T>), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  });

export const fail = (code: string, message: string, status = 400, details?: unknown): Response =>
  new Response(
    JSON.stringify({ ok: false, error: { code, message, ...(details ? { details } : {}) } } satisfies ApiError),
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
