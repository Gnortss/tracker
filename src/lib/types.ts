export type ValueType = 'boolean' | 'int' | 'number' | 'text' | 'enum';

export type TrackableConfig = {
  default?: boolean | number | string | null;
  min?: number;
  max?: number;
  step?: number;
  allowed?: string[];
  maxLength?: number;
};

export interface Trackable {
  id: string;
  key: string | null;
  name: string;
  kind: string;
  value_type: ValueType;
  config: TrackableConfig;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

export interface TrackableWithValue extends Trackable {
  value: boolean | number | string | null;
  is_default: boolean;
}

export interface StatsTodayPayload {
  date: string;
  trackables: TrackableWithValue[];
  aggregates: {
    habits_done_today: number;
    habits_total: number;
  };
}

export interface StatsRangePayload {
  start_date: string;
  end_date: string;
  days: string[];
  trackables: Trackable[];
  defaults: Record<string, boolean | number | string | null>;
  values: Record<string, Record<string, boolean | number | string | null>>;
}

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiError = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
