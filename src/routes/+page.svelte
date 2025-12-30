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
  let days = 21;

  const habitPreset = {
    name: '',
    key: '',
    kind: 'habit',
    value_type: 'boolean',
    config: { default: false }
  } as any;

  const moodPreset = {
    name: 'Mood',
    key: 'mood',
    kind: 'mood',
    value_type: 'int',
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

  const setValue = async (trackable: Trackable, date: string, value: boolean | number | string) => {
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
</script>

<div class="page">
  <header>
    <h1>Tracker</h1>
    <div class="token">
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
      <div class="trackables">
        <h3>Habits</h3>
        {#each todayData.trackables.filter((t) => t.kind === 'habit') as habit}
          <div class="item">
            <label>
              <input
                type="checkbox"
                checked={Boolean(habit.value)}
                on:change={() => toggleHabit(habit)}
              />
              <span>{habit.name}</span>
            </label>
          </div>
        {/each}
      </div>
      <div class="trackables">
        <h3>Other</h3>
        {#each todayData.trackables.filter((t) => t.kind !== 'habit') as tracker}
          <div class="item">
            <label>{tracker.name}</label>
            {#if tracker.value_type === 'int' || tracker.value_type === 'number'}
              <input
                type="number"
                min={tracker.config.min}
                max={tracker.config.max}
                value={Number(tracker.value)}
                on:change={(e) => setValue(tracker, todayData.date, Number((e.target as HTMLInputElement).value))}
              />
            {:else if tracker.value_type === 'enum'}
              <select value={String(tracker.value)} on:change={(e) => setValue(tracker, todayData.date, (e.target as HTMLSelectElement).value)}>
                {#each tracker.config.allowed ?? [] as opt}
                  <option value={opt} selected={tracker.value === opt}>{opt}</option>
                {/each}
              </select>
            {:else}
              <input
                type="text"
                value={String(tracker.value ?? '')}
                on:change={(e) => setValue(tracker, todayData.date, (e.target as HTMLInputElement).value)}
              />
            {/if}
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
      <div class="history">
        {#each historyData.trackables as tracker}
          <div class="history-row">
            <div class="history-name">{tracker.name}</div>
            <div class="history-grid">
              {#each historyData.days as day}
                <div class="history-cell" title={`${tracker.name} ${day}`}>
                  {#if tracker.value_type === 'boolean'}
                    <input
                      type="checkbox"
                      checked={Boolean(historyData.values[tracker.id]?.[day] ?? historyData.defaults[tracker.id])}
                      on:change={(e) =>
                        (e.target as HTMLInputElement).checked
                          ? setValue(tracker, day, true)
                          : clearEntry(tracker, day)
                      }
                    />
                  {:else if tracker.value_type === 'enum'}
                    <select
                      value={String(historyData.values[tracker.id]?.[day] ?? historyData.defaults[tracker.id] ?? '')}
                      on:change={(e) => setValue(tracker, day, (e.target as HTMLSelectElement).value)}
                    >
                      {#each tracker.config.allowed ?? [] as opt}
                        <option value={opt}>{opt}</option>
                      {/each}
                    </select>
                  {:else}
                    <input
                      type={tracker.value_type === 'text' ? 'text' : 'number'}
                      value={String(historyData.values[tracker.id]?.[day] ?? historyData.defaults[tracker.id] ?? '')}
                      on:change={(e) =>
                        setValue(
                          tracker,
                          day,
                          tracker.value_type === 'text'
                            ? (e.target as HTMLInputElement).value
                            : Number((e.target as HTMLInputElement).value)
                        )
                      }
                    />
                  {/if}
                </div>
              {/each}
            </div>
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
        <button on:click={() => setPreset(moodPreset)}>Mood preset</button>
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
        Value Type
        <select bind:value={trackableForm.value_type}>
          <option value="boolean">boolean</option>
          <option value="int">int</option>
          <option value="number">number</option>
          <option value="text">text</option>
          <option value="enum">enum</option>
        </select>
      </label>
      <label>
        Default
        <input type="text" bind:value={trackableForm.config.default} />
      </label>
      <label>
        Sort order
        <input type="number" bind:value={trackableForm.sort_order} />
      </label>
    </div>
    <div class="actions">
      <button on:click={submitTrackable}>Create</button>
    </div>
    <p class="hint">For enums, provide comma-separated allowed values inside config.allowed via advanced edits in API payloads.</p>
  </section>
</div>

<style>
  :global(body) {
    font-family: system-ui, sans-serif;
    margin: 0;
    background: #f5f7fb;
    color: #1f2a3d;
  }
  .page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
  }
  h1 {
    margin: 0;
  }
  .token {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  input,
  select,
  button {
    font-size: 1rem;
  }
  input,
  select {
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    border: 1px solid #d0d5dd;
  }
  button {
    padding: 0.5rem 0.8rem;
    border-radius: 6px;
    border: 1px solid #3b82f6;
    background: #3b82f6;
    color: white;
    cursor: pointer;
  }
  button.ghost {
    background: transparent;
    color: #1f2a3d;
    border-color: #d0d5dd;
  }
  .panel {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
  }
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .trackables .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0;
  }
  .trackables h3 {
    margin-bottom: 0.25rem;
    color: #334155;
  }
  .aggregates {
    margin-top: 0.5rem;
    font-weight: 600;
  }
  .history {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .history-row {
    border-top: 1px solid #e5e7eb;
    padding-top: 0.75rem;
  }
  .history-name {
    font-weight: 600;
    margin-bottom: 0.35rem;
  }
  .history-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 0.4rem;
  }
  .history-cell {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.4rem;
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
