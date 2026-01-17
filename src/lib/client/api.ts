import type { ApiResponse, DashboardPayload, Habit, StatsPayload, Trackable, UserSummary } from '$lib/types';

const jsonHeaders = (extra?: Record<string, string>) => ({
  'Content-Type': 'application/json',
  ...(extra ?? {})
});

const handleResponse = async <T>(res: Response): Promise<ApiResponse<T>> => {
  const data = await res.json();
  return data as ApiResponse<T>;
};

export const login = async (email: string, password: string): Promise<ApiResponse<{ email: string; timezone: string }>> => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: jsonHeaders(),
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  return handleResponse(res);
};

export const signup = async (email: string, password: string): Promise<ApiResponse<{ email: string; timezone: string }>> => {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: jsonHeaders(),
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  return handleResponse(res);
};

export const logout = async (): Promise<ApiResponse<{ ok: boolean }>> => {
  const res = await fetch('/api/auth/logout', {
    method: 'POST',
    headers: jsonHeaders(),
    credentials: 'include'
  });
  return handleResponse(res);
};

export const fetchMe = async (): Promise<ApiResponse<UserSummary>> => {
  const res = await fetch('/api/me', { credentials: 'include' });
  return handleResponse(res);
};

export const revealApiKey = async (): Promise<ApiResponse<{ apiKey: string; apiKeyMasked: string; created: boolean }>> => {
  const res = await fetch('/api/api-key/reveal', {
    method: 'POST',
    headers: jsonHeaders(),
    credentials: 'include'
  });
  return handleResponse(res);
};

export const regenerateApiKey = async (): Promise<ApiResponse<{ apiKey: string; apiKeyMasked: string }>> => {
  const res = await fetch('/api/api-key/regenerate', {
    method: 'POST',
    headers: jsonHeaders(),
    credentials: 'include'
  });
  return handleResponse(res);
};

export const fetchDashboard = async (days: number, page: number): Promise<ApiResponse<DashboardPayload>> => {
  const res = await fetch(`/api/dashboard?days=${days}&page=${page}`, { credentials: 'include' });
  return handleResponse(res);
};

export const fetchStats = async (year?: number, month?: string): Promise<ApiResponse<StatsPayload>> => {
  const params = new URLSearchParams();
  if (year) params.set('year', String(year));
  if (month) params.set('month', month);
  const res = await fetch(`/api/stats?${params.toString()}`, { credentials: 'include' });
  return handleResponse(res);
};

export const createHabit = async (payload: { name: string }): Promise<ApiResponse<Habit>> => {
  const res = await fetch('/api/habits', {
    method: 'POST',
    headers: jsonHeaders(),
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
};

export const updateHabit = async (id: string, payload: Partial<{ name: string; sort_order: number; active: boolean }>): Promise<ApiResponse<Habit>> => {
  const res = await fetch(`/api/habits/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
};

export const deleteHabit = async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
  const res = await fetch(`/api/habits/${id}`, {
    method: 'DELETE',
    headers: jsonHeaders(),
    credentials: 'include'
  });
  return handleResponse(res);
};

export const setHabitEntry = async (id: string, day: string, done: boolean): Promise<ApiResponse<{ habit_id: string; day: string; done: boolean }>> => {
  const res = await fetch(`/api/habits/${id}/entries/${day}`, {
    method: 'PUT',
    headers: jsonHeaders(),
    credentials: 'include',
    body: JSON.stringify({ done })
  });
  return handleResponse(res);
};

export const createTrackable = async (payload: { name: string; unit?: string | null; min_value?: number; max_value?: number | null }): Promise<ApiResponse<Trackable>> => {
  const res = await fetch('/api/trackables', {
    method: 'POST',
    headers: jsonHeaders(),
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
};

export const updateTrackable = async (
  id: string,
  payload: Partial<{ name: string; unit: string | null; min_value: number; max_value: number | null; sort_order: number; active: boolean }>
): Promise<ApiResponse<Trackable>> => {
  const res = await fetch(`/api/trackables/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
};

export const deleteTrackable = async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
  const res = await fetch(`/api/trackables/${id}`, {
    method: 'DELETE',
    headers: jsonHeaders(),
    credentials: 'include'
  });
  return handleResponse(res);
};

export const setTrackableEntry = async (
  id: string,
  day: string,
  value: number
): Promise<ApiResponse<{ trackable_id: string; day: string; value: number }>> => {
  const res = await fetch(`/api/trackables/${id}/entries/${day}`, {
    method: 'PUT',
    headers: jsonHeaders(),
    credentials: 'include',
    body: JSON.stringify({ value })
  });
  return handleResponse(res);
};
