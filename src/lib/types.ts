export type ApiSuccess<T> = { ok: true; data: T };
export type ApiError = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type UserSummary = {
  email: string;
  timezone: string;
  apiKeyMasked: string;
  apiKeyRevealAllowed: boolean;
};

export type Habit = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Trackable = {
  id: string;
  name: string;
  unit: string | null;
  min_value: number;
  max_value: number | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type HabitStats = {
  yearly_completion: number;
  monthly_completion: number;
  best_streak: number;
  current_streak: number;
  missing_count: number;
};

export type TrackableStats = {
  yearly_completion: number;
  monthly_completion: number;
  current_streak: number;
  average_value: number | null;
  missed_count: number;
};

export type DashboardPayload = {
  user: UserSummary;
  days: string[];
  habits: Habit[];
  trackables: Trackable[];
  habit_entries: Record<string, Record<string, 1>>;
  trackable_entries: Record<string, Record<string, number>>;
  habit_stats: Record<string, HabitStats>;
  trackable_stats: Record<string, TrackableStats>;
};

export type StatsPayload = {
  year: number;
  month: string;
  days_elapsed_year: number;
  days_elapsed_month: number;
  habit_stats: Record<string, HabitStats>;
  trackable_stats: Record<string, TrackableStats>;
};
