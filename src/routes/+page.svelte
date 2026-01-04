<script lang="ts">
  import { onMount } from 'svelte';
  import { token as tokenStore } from '$lib/client/stores/auth';
  import { fetchStats, fetchToday, postAction } from '$lib/client/api';
  import type { StatsRangePayload, StatsTodayPayload, Trackable } from '$lib/types';
  import { get } from 'svelte/store';

  let token = '';
  let todayData: StatsTodayPayload | null = null;
  let historyData: StatsRangePayload | null = null;
  let status = '';
  let error = '';
  const minPageSize = 1;
  const maxPageSize = 7;
  const maxHistoryDays = 3650;
  const stackBreakpoint = 820;
  let pageSize = maxPageSize;
  let pageIndex = 0;
  let maxPage = 0;
  let historyShell: HTMLDivElement | null = null;
  let showModal = false;

  const fallbackColors = ['#2f7cf6', '#2fbf71', '#f0b429', '#f26b5b', '#7a5cff', '#25b4c7', '#9d7b4a'];

  const habitPreset = {
    name: '',
    key: '',
    kind: 'habit',
    value_type: 'boolean',
    color: fallbackColors[0],
    config: { default: false }
  } as any;

  let trackableForm = { ...habitPreset, config: { ...(habitPreset.config ?? {}) } };

  let todayValues: Record<string, boolean | number | null> = {};

  const loadAll = async () => {
    status = 'Loading...';
    error = '';
    const t = token || get(tokenStore);
    token = t;
    if (!t) {
      status = 'Add your API token to start';
      return;
    }
    const [todayRes, statsRes] = await Promise.all([fetchToday(t), fetchStats(t, 'all')]);
    if (!todayRes.ok) {
      error = todayRes.error.message;
    } else {
      todayData = todayRes.data;
    }
    if (!statsRes.ok) {
      error = statsRes.error.message;
    } else {
      historyData = statsRes.data;
    }
    status = '';
  };

  const parseDay = (day: string) => {
    const [year, month, date] = day.split('-').map(Number);
    return new Date(year, month - 1, date);
  };

  const formatMonth = (day: string) =>
    parseDay(day).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

  const formatWeekday = (day: string) =>
    parseDay(day).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

  const formatDayNumber = (day: string) => parseDay(day).getDate();
  const formatRange = (range: string[]) => {
    if (!range.length) return '';
    const start = parseDay(range[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = parseDay(range[range.length - 1]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${start} - ${end}`;
  };
  const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);
  const addDays = (day: string, delta: number) => {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + delta);
    return toIsoDate(date);
  };
  const buildRangeDays = (start: string, end: string) => {
    const result: string[] = [];
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      result.push(toIsoDate(d));
    }
    return result;
  };

  const normalizeHex = (value: string | null | undefined) => {
    if (!value) return '';
    const raw = value.trim();
    const hex = raw.startsWith('#') ? raw.slice(1) : raw;
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      return `#${hex
        .split('')
        .map((c) => `${c}${c}`)
        .join('')}`;
    }
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return `#${hex}`;
    }
    return '';
  };

  const hexToRgb = (hex: string) => {
    const clean = normalizeHex(hex);
    if (!clean) return null;
    const value = clean.slice(1);
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return { r, g, b };
  };

  const rgbToHex = (r: number, g: number, b: number) =>
    `#${[r, g, b]
      .map((channel) => {
        const hex = Math.round(channel).toString(16).padStart(2, '0');
        return hex;
      })
      .join('')}`;

  const mix = (
    from: { r: number; g: number; b: number },
    to: { r: number; g: number; b: number },
    ratio: number
  ) => ({
    r: from.r + (to.r - from.r) * ratio,
    g: from.g + (to.g - from.g) * ratio,
    b: from.b + (to.b - from.b) * ratio
  });

  const buildGradient = (hex: string) => {
    const base = hexToRgb(hex) ?? { r: 47, g: 124, b: 246 };
    const white = { r: 255, g: 255, b: 255 };
    const steps: string[] = [];
    for (let step = 1; step <= 7; step += 1) {
      const ratio = step / 7;
      const mixed = mix(white, base, ratio);
      steps.push(rgbToHex(mixed.r, mixed.g, mixed.b));
    }
    return steps;
  };

  const resolveColor = (trackable: Trackable, index: number) => {
    const hex = normalizeHex(trackable.color);
    return hex || fallbackColors[index % fallbackColors.length];
  };

  const getValueFor = (trackable: Trackable, day: string) => {
    if (day === todayData?.date && trackable.id in todayValues) {
      return todayValues[trackable.id];
    }
    if (!historyData) return null;
    const value = historyData.values[trackable.id]?.[day];
    return value ?? historyData.defaults[trackable.id];
  };

  const isDone = (trackable: Trackable, day: string) => Boolean(getValueFor(trackable, day));

  const buildAllDays = (history: StatsRangePayload | null, today: StatsTodayPayload | null) => {
    if (!history) return [];
    const daysList = [...history.days];
    if (today?.date && !daysList.includes(today.date)) {
      daysList.push(today.date);
    }
    return daysList;
  };

  const buildDisplayDays = (baseDay: string, page: number, size: number) => {
    if (!baseDay) return [];
    const end = addDays(baseDay, -page * size);
    const start = addDays(end, -(size - 1));
    return buildRangeDays(start, end);
  };

  const buildStreaks = (trackables: Trackable[], daysToShow: string[]) => {
    const streaks: Record<string, Record<string, number>> = {};
    for (const trackable of trackables) {
      let streak = 0;
      streaks[trackable.id] = {};
      for (const day of daysToShow) {
        if (isDone(trackable, day)) {
          streak += 1;
        } else {
          streak = 0;
        }
        streaks[trackable.id][day] = streak;
      }
    }
    return streaks;
  };

  const toggleHabitDay = async (trackable: Trackable, day: string) => {
    if (isDone(trackable, day)) {
      await clearEntry(trackable, day);
      return;
    }
    await setValue(trackable, day, true);
  };

  const setValue = async (trackable: Trackable, date: string, value: boolean | number) => {
    const res = await postAction(token, {
      action: 'entry.set',
      trackable_id: trackable.id,
      date,
      value
    });
    if (!res.ok) {
      error = res.error.message;
      return;
    }
    await loadAll();
  };

  const clearEntry = async (trackable: Trackable, date: string) => {
    const res = await postAction(token, { action: 'entry.clear', trackable_id: trackable.id, date });
    if (!res.ok) {
      error = res.error.message;
      return;
    }
    await loadAll();
  };

  const submitTrackable = async () => {
    if (!token) {
      error = 'Add your API token before creating habits.';
      return;
    }
    if (!trackableForm.name?.trim()) {
      error = 'Please add a habit name.';
      return;
    }
    const payload = {
      ...trackableForm,
      key: trackableForm.key?.trim() ? trackableForm.key.trim() : null,
      action: 'trackable.create'
    };
    const res = await postAction(token, payload);
    if (!res.ok) {
      error = res.error.message;
      return;
    }
    showModal = false;
    trackableForm = { ...habitPreset, config: { ...(habitPreset.config ?? {}) } };
    await loadAll();
  };

  const setPage = (next: number) => {
    const clamped = Math.max(0, Math.min(maxPage, next));
    if (clamped === pageIndex) return;
    pageIndex = clamped;
  };

  const deleteHabit = async (habit: Trackable) => {
    if (!token) {
      error = 'Add your API token before deleting habits.';
      return;
    }
    const ok = window.confirm(`Remove habit "${habit.name}"? This deletes its history.`);
    if (!ok) return;
    const res = await postAction(token, { action: 'trackable.delete', id: habit.id });
    if (!res.ok) {
      error = res.error.message;
      return;
    }
    await loadAll();
  };

  const syncPageSize = () => {
    if (!historyShell) return;
    const styles = getComputedStyle(historyShell);
    const cellSize = Number.parseFloat(styles.getPropertyValue('--cell-size')) || 42;
    const gap = Number.parseFloat(styles.getPropertyValue('--cell-gap')) || 6;
    const nameCol = Number.parseFloat(styles.getPropertyValue('--name-col')) || 180;
    const statsCol = Number.parseFloat(styles.getPropertyValue('--stats-col')) || 260;
    const removeCol = Number.parseFloat(styles.getPropertyValue('--remove-col')) || 44;
    const width = historyShell.clientWidth;
    const available =
      width <= stackBreakpoint ? width : Math.max(0, width - nameCol - statsCol - removeCol);
    const columns = Math.floor((available + gap) / (cellSize + gap));
    const next = Math.max(minPageSize, Math.min(maxPageSize, columns));
    if (next !== pageSize) {
      pageSize = next;
    }
  };

  onMount(() => {
    const unsub = tokenStore.subscribe((v) => (token = v));
    loadAll();
    const observer = new ResizeObserver(() => syncPageSize());
    if (historyShell) {
      observer.observe(historyShell);
      syncPageSize();
    }
    return () => {
      observer.disconnect();
      unsub();
    };
  });

  let habitList: Trackable[] = [];
  let allDays: string[] = [];
  let displayDays: string[] = [];
  let gradientsById: Record<string, string[]> = {};
  let streaksById: Record<string, Record<string, number>> = {};
  let statsById: Record<string, { current: number; longest: number; total: number; rate: number }> = {};

  $: habitList =
    (historyData?.trackables ?? todayData?.trackables ?? []).filter((t) => t.value_type === 'boolean');

  $: todayValues =
    todayData?.trackables.reduce(
      (acc, trackable) => ({ ...acc, [trackable.id]: trackable.value }),
      {}
    ) ?? {};

  $: allDays = buildAllDays(historyData, todayData);

  $: maxPage = Math.max(0, Math.ceil(maxHistoryDays / pageSize) - 1);

  $: if (pageIndex > maxPage) {
    pageIndex = maxPage;
  }

  $: {
    const baseDay =
      todayData?.date ?? historyData?.days?.[historyData.days.length - 1] ?? toIsoDate(new Date());
    displayDays = buildDisplayDays(baseDay, pageIndex, pageSize);
  }

  $: gradientsById = habitList.reduce((acc, habit, index) => {
    acc[habit.id] = buildGradient(resolveColor(habit, index));
    return acc;
  }, {} as Record<string, string[]>);

  $: streaksById = buildStreaks(habitList, allDays);

  const buildStats = (trackables: Trackable[], days: string[]) => {
    const stats: Record<string, { current: number; longest: number; total: number; rate: number }> = {};
    for (const trackable of trackables) {
      let current = 0;
      let longest = 0;
      let total = 0;
      for (const day of days) {
        if (isDone(trackable, day)) {
          total += 1;
          current += 1;
          longest = Math.max(longest, current);
        } else {
          current = 0;
        }
      }
      const rate = days.length ? Math.round((total / days.length) * 100) : 0;
      stats[trackable.id] = { current, longest, total, rate };
    }
    return stats;
  };

  $: statsById = buildStats(habitList, allDays);

  const streakForDay = (habit: Trackable, day: string) => streaksById[habit.id]?.[day] ?? 0;

  const currentStreak = (habit: Trackable) => {
    return statsById[habit.id]?.current ?? 0;
  };

  const gradientForDay = (habit: Trackable, index: number, day: string) => {
    if (!isDone(habit, day)) return '#ffffff';
    const streak = streakForDay(habit, day);
    const step = Math.max(1, Math.min(7, streak));
    return gradientsById[habit.id]?.[step - 1] ?? resolveColor(habit, index);
  };
</script>

<div class="page">
  <header class="topbar">
    <div class="brand">
      <p class="eyebrow">Habits</p>
      <h1>Daily Tracker</h1>
      <p class="subtitle">Tap a square to mark done or skipped.</p>
    </div>
    <div class="token-card">
      <label>
        API Token
        <input
          type="password"
          placeholder="Paste API token"
          bind:value={token}
          on:input={(e) => tokenStore.set((e.target as HTMLInputElement).value)}
          on:change={() => {
            if (token) loadAll();
          }}
        />
      </label>
      <button class="ghost" on:click={() => loadAll()}>Refresh</button>
    </div>
  </header>

  <div class="toast-stack" aria-live="polite">
    {#if status}<p class="toast status">{status}</p>{/if}
    {#if error}<p class="toast error">{error}</p>{/if}
  </div>

  <section class="board" bind:this={historyShell} style={`--cols: ${displayDays.length};`}>
    {#if historyData}
      <div class="board-toolbar">
        <div class="range-label">{formatRange(displayDays)}</div>
        <div class="pager">
          <button class="ghost" on:click={() => setPage(pageIndex - 1)} disabled={pageIndex === 0}>
            Newer
          </button>
          <button class="ghost" on:click={() => setPage(pageIndex + 1)} disabled={pageIndex >= maxPage}>
            Older
          </button>
        </div>
      </div>
      <div class="board-header">
        <div class="board-label">Habits</div>
        <div class="days-grid">
          {#each displayDays as day}
            <div class="day-card {day === todayData?.date ? 'today' : ''}">
              <span class="month">{formatMonth(day)}</span>
              <span class="day">{formatDayNumber(day)}</span>
              <span class="weekday">{formatWeekday(day)}</span>
            </div>
          {/each}
        </div>
        <div class="streak-header">Stats</div>
        <div class="remove-header" aria-hidden="true"></div>
      </div>
      <div class="board-body">
        {#if habitList.length === 0}
          <div class="empty-row">
            <p class="empty">No habits yet. Add your first habit.</p>
          </div>
        {:else}
          {#each habitList as habit, index}
            <div class="habit-row">
              <div class="habit-name">
                <span class="swatch" style={`--swatch: ${resolveColor(habit, index)};`}></span>
                <span>{habit.name}</span>
              </div>
              <div class="days-grid">
                {#each displayDays as day}
                  {@const done = isDone(habit, day)}
                  <button
                    class="day-cell {done ? 'done' : 'skipped'}"
                    style={`--cell: ${gradientForDay(habit, index, day)};`}
                    title={`${habit.name} ${day}`}
                    aria-label={`${habit.name} ${day} ${done ? 'done' : 'skipped'}`}
                    aria-pressed={done}
                    on:click={() => toggleHabitDay(habit, day)}
                  ></button>
                {/each}
              </div>
              <div class="stats-cell" style={`--accent: ${resolveColor(habit, index)};`}>
                <div class="stat">
                  <span class="streak-badge">{currentStreak(habit)}</span>
                  <span class="stat-label">Streak</span>
                </div>
                <div class="stat">
                  <span class="streak-badge">{statsById[habit.id]?.longest ?? 0}</span>
                  <span class="stat-label">Longest</span>
                </div>
                <div class="stat">
                  <span class="streak-badge">{statsById[habit.id]?.total ?? 0}</span>
                  <span class="stat-label">Total</span>
                </div>
                <div class="stat">
                  <span class="streak-badge rate-badge">
                    <span class="rate-text">{statsById[habit.id]?.rate ?? 0}%</span>
                  </span>
                  <span class="stat-label">Rate</span>
                </div>
              </div>
              <div class="remove-cell">
                <button
                  class="delete-habit"
                  on:click={() => deleteHabit(habit)}
                  title="Remove habit"
                  aria-label={`Remove ${habit.name}`}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9Zm-8 0h2v8H6V9Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>
      <button class="new-habit" on:click={() => (showModal = true)}>+ New Habit</button>
    {:else}
      <p class="empty">Connect with your token to load habits.</p>
      <button class="new-habit" on:click={() => (showModal = true)}>+ New Habit</button>
    {/if}
  </section>

  {#if showModal}
    <div class="modal-backdrop" on:click|self={() => (showModal = false)}>
      <div class="modal">
        <h2>New habit</h2>
        <label>
          Habit name
          <input type="text" bind:value={trackableForm.name} placeholder="Read 10 pages" />
        </label>
        <label>
          Color
          <input type="color" bind:value={trackableForm.color} />
        </label>
        <div class="modal-actions">
          <button class="ghost" type="button" on:click={() => (showModal = false)}>Cancel</button>
          <button type="button" on:click={submitTrackable}>Create habit</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=IBM+Plex+Serif:wght@500;700&display=swap');

  :global(body) {
    font-family: 'Figtree', 'Trebuchet MS', sans-serif;
    margin: 0;
    background: radial-gradient(circle at top left, #f7f1e6 0%, rgba(247, 241, 230, 0) 55%),
      radial-gradient(circle at 80% 10%, rgba(223, 239, 255, 0.6) 0%, rgba(223, 239, 255, 0) 45%),
      linear-gradient(120deg, #f4f6f9 0%, #eef2f7 45%, #f7f7fb 100%);
    color: #1f2937;
  }
  :global(*) {
    box-sizing: border-box;
  }
  .page {
    max-width: 1180px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }
  .topbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .brand h1 {
    margin: 0;
    font-family: 'IBM Plex Serif', 'Georgia', serif;
    font-size: clamp(2rem, 3vw, 2.8rem);
  }
  .eyebrow {
    margin: 0 0 0.35rem;
    font-size: 0.7rem;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: #6b7280;
  }
  .subtitle {
    margin: 0.4rem 0 0;
    color: #4b5563;
  }
  .token-card {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 999px;
    padding: 0.4rem 0.7rem;
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
  }
  input,
  button {
    font-size: 0.95rem;
    font-family: inherit;
  }
  input {
    padding: 0.45rem 0.6rem;
    border-radius: 999px;
    border: 1px solid #d1d5db;
    background: #fff;
  }
  input[type='color'] {
    padding: 0;
    width: 46px;
    height: 38px;
    border-radius: 10px;
    border: 1px solid #d1d5db;
    background: #fff;
  }
  button {
    padding: 0.45rem 0.8rem;
    border-radius: 10px;
    border: 1px solid #111827;
    background: #111827;
    color: #fff;
    cursor: pointer;
  }
  button.ghost {
    background: transparent;
    color: #111827;
    border-color: #d1d5db;
  }
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .toast-stack {
    position: fixed;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 20;
    pointer-events: none;
  }
  .toast {
    margin: 0;
    padding: 0.5rem 0.9rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #e5e7eb;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.14);
    font-weight: 600;
    text-align: center;
    pointer-events: auto;
  }
  .toast.status {
    color: #2563eb;
    border-color: rgba(37, 99, 235, 0.35);
  }
  .toast.error {
    color: #dc2626;
    border-color: rgba(220, 38, 38, 0.35);
  }
  .board {
    --cell-size: 42px;
    --cell-gap: 6px;
    --name-col: 180px;
    --stats-col: 260px;
    --remove-col: 44px;
    background: #fdfdfd;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 1rem;
    box-shadow: 0 20px 36px rgba(15, 23, 42, 0.08);
    overflow-x: auto;
    overflow-y: hidden;
  }
  .board-header,
  .habit-row {
    display: grid;
    grid-template-columns: var(--name-col) max-content var(--stats-col) var(--remove-col);
    align-items: center;
    gap: 0.75rem;
  }
  .board-header {
    grid-template-areas: 'label days stats remove';
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #eceff4;
    margin-bottom: 0.6rem;
  }
  .board-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.6rem;
  }
  .range-label {
    font-size: 0.7rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #6b7280;
  }
  .pager {
    display: flex;
    gap: 0.4rem;
  }
  .pager button {
    padding: 0.3rem 0.6rem;
    border-radius: 999px;
    font-size: 0.75rem;
  }
  .board-label {
    grid-area: label;
    font-size: 0.7rem;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: #6b7280;
  }
  .streak-header {
    grid-area: stats;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: #6b7280;
    text-align: center;
  }
  .days-grid {
    grid-area: days;
    display: grid;
    grid-template-columns: repeat(var(--cols), var(--cell-size));
    gap: var(--cell-gap);
    align-items: center;
    width: max-content;
    justify-self: start;
  }
  .day-card {
    display: grid;
    gap: 0.1rem;
    padding: 0.35rem 0.2rem;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    background: #f7f8fa;
    text-align: center;
    font-size: 0.6rem;
    letter-spacing: 0.12em;
    color: #6b7280;
  }
  .day-card .day {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
    letter-spacing: 0;
  }
  .day-card.today {
    background: #ffffff;
    border-color: #111827;
    box-shadow: inset 0 0 0 1px #111827;
  }
  .habit-row {
    grid-template-areas: 'name days stats remove';
    padding: 0.35rem 0;
  }
  .board-body {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .empty-row {
    padding: 0.6rem 0;
  }
  .habit-name {
    grid-area: name;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: #374151;
  }
  .stats-cell {
    grid-area: stats;
  }
  .remove-header {
    grid-area: remove;
  }
  .remove-cell {
    grid-area: remove;
    display: grid;
    place-items: center;
  }
  .delete-habit {
    width: 30px;
    height: 30px;
    padding: 0;
    border-radius: 999px;
    border: 1px solid #e5e7eb;
    background: transparent;
    color: #6b7280;
    display: grid;
    place-items: center;
  }
  .delete-habit svg {
    width: 14px;
    height: 14px;
  }
  .delete-habit:hover {
    border-color: #111827;
    color: #111827;
  }
  .swatch {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--swatch);
    box-shadow: 0 0 0 2px #fff;
    border: 1px solid #e5e7eb;
  }
  .day-cell {
    width: var(--cell-size);
    height: var(--cell-size);
    border-radius: 6px;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    cursor: pointer;
    padding: 0;
    transition: transform 120ms ease, box-shadow 120ms ease;
  }
  .day-cell.done {
    background: var(--cell);
    border-color: transparent;
    box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
  }
  .day-cell:active {
    transform: scale(0.95);
  }
  .stats-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    min-width: 54px;
  }
  .streak-badge {
    width: 38px;
    height: 38px;
    border-radius: 999px;
    border: 2px solid var(--accent);
    color: #111827;
    font-weight: 600;
    display: grid;
    place-items: center;
    background: #fff;
    position: relative;
    z-index: 0;
  }
  .rate-badge {
    border-color: var(--accent);
    font-size: 0.6rem;
    line-height: 1;
    letter-spacing: -0.01em;
  }
  .rate-text {
    font-size: 0.65rem;
    line-height: 1;
    white-space: nowrap;
  }
  .stat-label {
    font-size: 0.6rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #6b7280;
  }
  .new-habit {
    margin-top: 0.75rem;
    background: #fff;
    color: #111827;
    border: 1px dashed #9ca3af;
    width: 100%;
  }
  .new-habit:hover {
    border-color: #111827;
  }
  .empty {
    color: #6b7280;
    margin: 0 0 0.75rem;
  }
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    display: grid;
    place-items: center;
    padding: 1rem;
  }
  .modal {
    background: #fff;
    border-radius: 16px;
    padding: 1.25rem;
    width: min(420px, 92vw);
    box-shadow: 0 24px 48px rgba(15, 23, 42, 0.2);
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .modal h2 {
    margin: 0;
    font-family: 'IBM Plex Serif', 'Georgia', serif;
  }
  .modal label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.9rem;
    color: #374151;
  }
  .modal input[type='text'] {
    border-radius: 10px;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  @media (max-width: 900px) {
    .board {
      --cell-size: 32px;
      --cell-gap: 5px;
      --name-col: 150px;
      --stats-col: 200px;
      --remove-col: 40px;
    }
    .token-card {
      width: 100%;
      justify-content: space-between;
    }
  }
  @media (max-width: 600px) {
    .board {
      --cell-size: 28px;
      --cell-gap: 4px;
      --name-col: 120px;
      --stats-col: 170px;
      --remove-col: 36px;
      padding: 0.8rem;
    }
    .day-card {
      padding: 0.25rem 0.1rem;
    }
    .streak-badge {
      width: 32px;
      height: 32px;
      font-size: 0.85rem;
    }
    .stat-label {
      font-size: 0.55rem;
    }
    .rate-text {
      font-size: 0.55rem;
    }
  }
  @media (max-width: 820px) {
    .board-header,
    .habit-row {
      grid-template-columns: 1fr auto;
      grid-template-areas:
        'label remove'
        'days days'
        'stats stats';
    }
    .habit-row {
      grid-template-areas:
        'name remove'
        'days days'
        'stats stats';
    }
    .streak-header {
      text-align: left;
    }
    .stats-cell {
      justify-content: flex-start;
    }
  }
  @media (max-width: 520px) {
    .day-card .month,
    .day-card .weekday {
      display: none;
    }
  }
</style>
