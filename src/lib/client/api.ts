import type { ApiResponse, StatsRangePayload, StatsTodayPayload } from '$lib/types';

const jsonHeaders = (token: string, extra?: Record<string, string>) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...(extra ?? {})
});

const handleResponse = async <T>(res: Response): Promise<ApiResponse<T>> => {
  const data = await res.json();
  return data as ApiResponse<T>;
};

export const fetchToday = async (token: string): Promise<ApiResponse<StatsTodayPayload>> => {
  const res = await fetch('/api/stats/today', { headers: jsonHeaders(token) });
  return handleResponse<StatsTodayPayload>(res);
};

export const fetchStats = async (token: string, days = 21): Promise<ApiResponse<StatsRangePayload>> => {
  const res = await fetch(`/api/stats?days=${days}`, { headers: jsonHeaders(token) });
  return handleResponse<StatsRangePayload>(res);
};

export const postAction = async <T>(token: string, payload: Record<string, any>): Promise<ApiResponse<T>> => {
  const res = await fetch('/api/action', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(payload)
  });
  return handleResponse<T>(res);
};
