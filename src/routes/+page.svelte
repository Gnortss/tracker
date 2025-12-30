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
  let days = 7;

  const rangeSteps = [1, 2, 3, 4, 5];

  const habitPreset = {
    name: '',
    key: '',
    kind: 'habit',
    value_type: 'boolean',
    config: { default: false }
  } as any;

  const rangePreset = {
    name: 'Mood',
    key: 'mood',
    kind: 'mood',
    value_type: 'range',
    config: { min: 1, max: 5, default: 3 }
  } as any;

  let trackableForm = { ...habitPreset, config: { ...(habitPreset.config ?? {}) } };

  const loadAll = async () => {
    status = 'Loading...';
    error = '';
    const t = get(tokenStore);
    token = t;
    if (!t) {
      status = 'Add your API token to start';
      return;
    }
    const [todayRes, statsRes] = await Promise.all([fetchToday(t), fetchStats(t, days)]);
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

  onMount(() => {
    const unsub = tokenStore.subscribe((v) => (token = v));
    loadAll();
    return () => unsub();
  });

  const clampRange = (value: unknown) => {
    if (value === null || value === undefined) return 3;
    const num = Math.round(Number(value));
    if (!Number.isFinite(num)) return 3;
    return Math.min(5, Math.max(1, num));
  };

  const nextRangeValue = (value: unknown) => {
    const current = clampRange(value);
    return current >= 5 ? 1 : current + 1;
  };

  const formatDay = (day: string) => day.slice(5);

  // const iconFor = (trackable: Trackable) => trackable.icon ?? trackable.name?.slice(0, 1) ?? '';
  const iconFor = (trackable: Trackable) => '';

  const historyValueFor = (trackable: Trackable, day: string) => {
    if (!historyData) return null;
    return historyData.values[trackable.id]?.[day] ?? historyData.defaults[trackable.id];
  };

  const toggleHistoryBoolean = async (trackable: Trackable, day: string, currentValue: boolean) => {
    if (currentValue) {
      await clearEntry(trackable, day);
      return;
    }
    await setValue(trackable, day, true);
  };

  const toggleHabit = async (trackable: Trackable) => {
    if (!todayData) return;
    const res = await postAction(token, {
      action: 'entry.toggle',
      trackable_id: trackable.id,
      date: todayData.date
    });
    if (!res.ok) {
      error = res.error.message;
      return;
    }
    await loadAll();
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
    const payload = { ...trackableForm, action: 'trackable.create' };
    const res = await postAction(token, payload);
    if (!res.ok) {
      error = res.error.message;
      return;
    }
    trackableForm = { ...habitPreset, config: { ...(habitPreset.config ?? {}) } };
    await loadAll();
  };

  const setPreset = (preset: any) => {
    trackableForm = { ...preset, config: { ...(preset.config ?? {}) } };
  };

  const setValueType = (next: 'boolean' | 'range') => {
    trackableForm = {
      ...trackableForm,
      value_type: next,
      config: next === 'boolean' ? { default: false } : { min: 1, max: 5, default: 3 }
    };
  };
</script>

<div class="page">
  <header class="hero">
    <div class="hero-title">
      <p class="eyebrow">Daily tracker</p>
      <h1>Tracker</h1>
      <p class="subtitle">Tap the tiles. Keep the rhythm.</p>
    </div>
    <div class="token-card">
      <label>
        API Token
        <input
          type="password"
          placeholder="Paste API token"
          bind:value={token}
          on:change={(e) => tokenStore.set((e.target as HTMLInputElement).value)}
        />
      </label>
      <button class="ghost" on:click={() => loadAll()}>Refresh</button>
    </div>
  </header>

  {#if status}<p class="status">{status}</p>{/if}
  {#if error}<p class="error">{error}</p>{/if}

  <section class="panel">
    <div class="panel-header">
      <h2>Today</h2>
      {#if todayData}<small>{todayData.date}</small>{/if}
    </div>
    {#if todayData}
      <div class="today-grid">
        {#each todayData.trackables.filter((t) => t.value_type === 'boolean') as habit}
          <div class="tile-row">
            <div class="tile-label">
              <span>{habit.name}</span>
              <small>{habit.kind}</small>
            </div>
            <button
              class="tile boolean {Boolean(habit.value) ? 'on' : 'off'}"
              title={habit.name}
              on:click={() => toggleHabit(habit)}
            >
              <span class="tile-icon">{iconFor(habit)}</span>
            </button>
          </div>
        {/each}
        {#each todayData.trackables.filter((t) => t.value_type === 'range') as tracker}
          <div class="tile-row">
            <div class="tile-label">
              <span>{tracker.name}</span>
              <small>{tracker.kind}</small>
            </div>
            <div class="range-row">
              {#each rangeSteps as step}
                <button
                  class="tile range {clampRange(tracker.value) === step ? 'selected' : ''}"
                  style={`--shade: var(--range-${step});`}
                  title={`${tracker.name} ${step}`}
                  on:click={() => setValue(tracker, todayData.date, step)}
                >
                  <span>{step}</span>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
      <div class="aggregates">
        <p>
          Habits: {todayData.aggregates.habits_done_today}/{todayData.aggregates.habits_total} done
        </p>
      </div>
    {:else}
      <p>Connect with your token to load data.</p>
    {/if}
  </section>

  <section class="panel">
    <div class="panel-header">
      <h2>History</h2>
      <label>
        Days
        <input type="number" min="1" max="90" bind:value={days} on:change={() => loadAll()} />
      </label>
    </div>
    {#if historyData}
      <div class="history-table" style={`--cols: ${historyData.days.length};`}>
        <div class="history-head">
          <div class="history-title">Trackable</div>
          {#each historyData.days as day}
            <div class="history-date">{formatDay(day)}</div>
          {/each}
        </div>
        {#each historyData.trackables as tracker}
          <div class="history-row">
            <div class="history-name">{tracker.name}</div>
            {#each historyData.days as day}
              {@const value = historyValueFor(tracker, day)}
              {#if tracker.value_type === 'boolean'}
                <button
                  class="tile boolean {Boolean(value) ? 'on' : 'off'}"
                  title={`${tracker.name} ${day}`}
                  on:click={() => toggleHistoryBoolean(tracker, day, Boolean(value))}
                >
                  <span class="tile-icon">{iconFor(tracker)}</span>
                </button>
              {:else}
                <button
                  class="tile range"
                  style={`--shade: var(--range-${clampRange(value)});`}
                  title={`${tracker.name} ${day}`}
                  on:click={() => setValue(tracker, day, nextRangeValue(value))}
                >
                  <span>{clampRange(value)}</span>
                </button>
              {/if}
            {/each}
          </div>
        {/each}
      </div>
    {:else}
      <p>History unavailable until stats load.</p>
    {/if}
  </section>

  <section class="panel">
    <div class="panel-header">
      <h2>Add Trackable</h2>
      <div class="preset-buttons">
        <button on:click={() => setPreset(habitPreset)}>Habit preset</button>
        <button on:click={() => setPreset(rangePreset)}>Mood preset</button>
      </div>
    </div>
    <div class="form-grid">
      <label>
        Name
        <input type="text" bind:value={trackableForm.name} />
      </label>
      <label>
        Key (optional)
        <input type="text" bind:value={trackableForm.key} />
      </label>
      <label>
        Kind
        <input type="text" bind:value={trackableForm.kind} />
      </label>
      <label>
        Type
        <div class="type-toggle">
          <button type="button" class:active={trackableForm.value_type === 'boolean'} on:click={() => setValueType('boolean')}>
            boolean
          </button>
          <button type="button" class:active={trackableForm.value_type === 'range'} on:click={() => setValueType('range')}>
            range (1-5)
          </button>
        </div>
      </label>
      <label>
        Sort order
        <input type="number" bind:value={trackableForm.sort_order} />
      </label>
    </div>
    <div class="actions">
      <button on:click={submitTrackable}>Create</button>
    </div>
    <p class="hint">Only boolean and range (1-5) trackables are supported.</p>
  </section>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Fraunces:wght@500;700&display=swap');

  :global(body) {
    font-family: 'Space Grotesk', 'Trebuchet MS', sans-serif;
    margin: 0;
    background: radial-gradient(circle at top, #f8f2e8 0%, #f1f4f8 55%, #e9eef4 100%);
    color: #1b2430;
  }
  :global(:root) {
    --range-1: #f4f5f6;
    --range-2: #dde1e6;
    --range-3: #c6ccd4;
    --range-4: #aab2bd;
    --range-5: #7f8b99;
  }
  .page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .hero-title h1 {
    margin: 0;
    font-family: 'Fraunces', 'Georgia', serif;
    font-size: clamp(2rem, 3vw, 2.8rem);
  }
  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.2em;
    font-size: 0.7rem;
    color: #7a8699;
    margin: 0 0 0.35rem;
  }
  .subtitle {
    margin: 0.4rem 0 0;
    color: #3e4c5f;
  }
  .token-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: white;
    border-radius: 14px;
    box-shadow: 0 12px 24px rgba(19, 24, 38, 0.08);
  }
  input,
  button {
    font-size: 1rem;
  }
  input {
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    border: 1px solid #d0d5dd;
  }
  button {
    padding: 0.5rem 0.8rem;
    border-radius: 6px;
    border: 1px solid #254e70;
    background: #254e70;
    color: white;
    cursor: pointer;
  }
  button.ghost {
    background: transparent;
    color: #1b2430;
    border-color: #d0d5dd;
  }
  .panel {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 14px 30px rgba(19, 24, 38, 0.08);
  }
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .today-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }
  .tile-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .tile-label {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .tile-label small {
    color: #7a8699;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 0.65rem;
  }
  .range-row {
    display: flex;
    gap: 0.4rem;
  }
  .tile {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    border: 2px solid transparent;
    padding: 0;
    background: var(--shade, #cfd6dd);
    color: #1b2430;
    display: grid;
    place-items: center;
    font-weight: 600;
    transition: transform 120ms ease, box-shadow 120ms ease;
  }
  .tile:active {
    transform: scale(0.96);
  }
  .tile.boolean.on {
    background: #2f9b7a;
    color: #f8fbff;
    box-shadow: 0 10px 16px rgba(47, 155, 122, 0.25);
  }
  .tile.boolean.off {
    background: #e45c5c;
    color: #f8fbff;
    box-shadow: 0 10px 16px rgba(228, 92, 92, 0.25);
  }
  .tile.range {
    background: var(--shade, #cfd6dd);
    color: #1b2430;
  }
  .tile.range.selected {
    border-color: #1b2430;
  }
  .tile-icon {
    font-size: 1.1rem;
  }
  .aggregates {
    margin-top: 0.5rem;
    font-weight: 600;
  }
  .history-table {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-top: 0.75rem;
    overflow-x: auto;
  }
  .history-head,
  .history-row {
    display: grid;
    grid-template-columns: 160px repeat(var(--cols), minmax(28px, 1fr));
    gap: 0.4rem;
    align-items: center;
  }
  .history-title {
    font-weight: 600;
  }
  .history-date {
    font-size: 0.75rem;
    text-align: left;
    color: #7a8699;
  }
  .history-name {
    font-weight: 600;
  }
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.75rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.95rem;
  }
  .actions {
    margin-top: 0.75rem;
    display: flex;
    gap: 0.5rem;
  }
  .type-toggle {
    display: flex;
    gap: 0.5rem;
  }
  .type-toggle button {
    background: #f1f4f8;
    color: #1b2430;
    border-color: transparent;
  }
  .type-toggle button.active {
    background: #254e70;
    color: white;
  }
  .status {
    color: #0ea5e9;
  }
  .error {
    color: #dc2626;
  }
  .preset-buttons {
    display: flex;
    gap: 0.5rem;
  }
  .hint {
    color: #64748b;
    font-size: 0.9rem;
  }
</style>
