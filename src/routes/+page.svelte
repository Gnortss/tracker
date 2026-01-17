<script lang="ts">
  import { onMount } from 'svelte';
  import type { DashboardPayload, Habit, Trackable } from '$lib/types';
  import {
    createHabit,
    createTrackable,
    deleteHabit,
    deleteTrackable,
    fetchDashboard,
    login,
    logout,
    regenerateApiKey,
    revealApiKey,
    setHabitEntry,
    setTrackableEntry,
    signup,
    updateHabit,
    updateTrackable
  } from '$lib/client/api';
  import AppHeader from '$lib/components/AppHeader.svelte';
  import TrackerCard from '$lib/components/TrackerCard.svelte';
  import DayHeaderRow from '$lib/components/DayHeaderRow.svelte';
  import HabitRow from '$lib/components/HabitRow.svelte';
  import TrackableRow from '$lib/components/TrackableRow.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import NumberInputSheet from '$lib/components/NumberInputSheet.svelte';

  let dashboard: DashboardPayload | null = null;
  let loading = false;
  let toasts: { id: string; message: string; kind: 'status' | 'error' }[] = [];
  let page = 0;
  let dayCount = 5;
  let mainEl: HTMLElement | null = null;

  let loginEmail = '';
  let loginPassword = '';
  let isAuthenticated = false;
  let authMode: 'login' | 'signup' = 'login';

  let apiKeyValue = '';
  let apiKeyVisible = false;

  let showPausedHabits = false;
  let showPausedTrackables = false;

  let addHabitOpen = false;
  let addTrackableOpen = false;
  let habitName = '';
  let trackableName = '';
  let trackableUnit = '';
  let trackableMin = '1';
  let trackableMax = '';

  let deleteTarget: { type: 'habit' | 'trackable'; id: string; name: string } | null = null;

  let sheetOpen = false;
  let sheetTrackable: Trackable | null = null;
  let sheetDay = '';

  const habitPalette = ['filled-pink', 'filled-green', 'filled-blue', 'filled-orange', 'filled-purple'];
  const trackablePalette = ['filled-orange', 'filled-purple', 'filled-blue', 'filled-green', 'filled-pink'];

  const syncDayCount = () => {
    if (!mainEl) return;
    const width = mainEl.clientWidth;
    const fixed = 68 + 40 + 40 + 70 + 88 + 16;
    const styles = getComputedStyle(document.documentElement);
    const cellSize = Number.parseFloat(styles.getPropertyValue('--square-size')) || 60;
    const gap = 2;
    const available = Math.max(0, width - fixed);
    const next = Math.max(5, Math.min(7, Math.floor((available + gap) / (cellSize + gap))));
    if (next !== dayCount) {
      dayCount = next;
      if (isAuthenticated) loadDashboard();
    }
  };

  const pushToast = (message: string, kind: 'status' | 'error' = 'status', ttl = 3200) => {
    const id = crypto.randomUUID();
    toasts = [...toasts, { id, message, kind }];
    setTimeout(() => {
      toasts = toasts.filter((toast) => toast.id !== id);
    }, ttl);
  };

  const loadDashboard = async () => {
    loading = true;
    const res = await fetchDashboard(dayCount, page);
    if (!res.ok) {
      if (res.error.code === 'UNAUTHORIZED') {
        isAuthenticated = false;
        dashboard = null;
      } else {
        pushToast(res.error.message, 'error');
      }
      loading = false;
      return;
    }
    dashboard = res.data;
    isAuthenticated = true;
    loading = false;
  };

  const handleLogin = async () => {
    const res = await login(loginEmail, loginPassword);
    if (!res.ok) {
      pushToast(res.error.message, 'error');
      return;
    }
    loginPassword = '';
    pushToast('Signed in.');
    await loadDashboard();
  };

  const handleSignup = async () => {
    const res = await signup(loginEmail, loginPassword);
    if (!res.ok) {
      pushToast(res.error.message, 'error');
      return;
    }
    loginPassword = '';
    pushToast('Account created.');
    await loadDashboard();
  };

  const handleLogout = async () => {
    await logout();
    dashboard = null;
    isAuthenticated = false;
    apiKeyVisible = false;
    apiKeyValue = '';
  };

  const handleReveal = async () => {
    if (apiKeyValue) {
      apiKeyVisible = !apiKeyVisible;
      return;
    }
    const res = await revealApiKey();
    if (!res.ok) {
      pushToast(res.error.message, 'error');
      return;
    }
    apiKeyValue = res.data.apiKey;
    apiKeyVisible = true;
    pushToast(res.data.created ? 'API key created.' : 'API key revealed.');
  };

  const handleRegenerate = async () => {
    const res = await regenerateApiKey();
    if (!res.ok) {
      pushToast(res.error.message, 'error');
      return;
    }
    apiKeyValue = res.data.apiKey;
    apiKeyVisible = true;
    pushToast('API key regenerated.');
  };

  const handleCopy = async () => {
    if (!apiKeyValue) return;
    try {
      await navigator.clipboard.writeText(apiKeyValue);
      pushToast('API key copied.');
    } catch (err) {
      pushToast('Copy failed.', 'error');
    }
  };

  const submitHabit = async () => {
    const name = habitName.trim();
    if (!name) return;
    const res = await createHabit({ name });
    if (!res.ok) {
      pushToast(res.error.message, 'error');
      return;
    }
    habitName = '';
    addHabitOpen = false;
    await loadDashboard();
  };

  const submitTrackable = async () => {
    const name = trackableName.trim();
    if (!name) return;
    const minValue = Number(trackableMin);
    const maxValue = trackableMax ? Number(trackableMax) : null;
    const res = await createTrackable({
      name,
      unit: trackableUnit.trim() || null,
      min_value: Number.isFinite(minValue) ? minValue : 1,
      max_value: maxValue && Number.isFinite(maxValue) ? maxValue : null
    });
    if (!res.ok) {
      pushToast(res.error.message, 'error');
      return;
    }
    trackableName = '';
    trackableUnit = '';
    trackableMin = '1';
    trackableMax = '';
    addTrackableOpen = false;
    await loadDashboard();
  };

  const toggleHabit = async (habit: Habit, day: string) => {
    const entries = dashboard?.habit_entries?.[habit.id] ?? {};
    const done = !entries[day];
    const res = await setHabitEntry(habit.id, day, done);
    if (!res.ok) {
      pushToast(res.error.message, 'error');
      return;
    }
    await loadDashboard();
  };

  const toggleHabitActive = async (habit: Habit) => {
    const res = await updateHabit(habit.id, { active: !habit.active });
    if (!res.ok) {
      pushToast(res.error.message, 'error');
      return;
    }
    await loadDashboard();
  };

  const toggleTrackableActive = async (trackable: Trackable) => {
    const res = await updateTrackable(trackable.id, { active: !trackable.active });
    if (!res.ok) {
      pushToast(res.error.message, 'error');
      return;
    }
    await loadDashboard();
  };

  const confirmDelete = (type: 'habit' | 'trackable', item: { id: string; name: string }) => {
    deleteTarget = { type, id: item.id, name: item.name };
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    const res = type === 'habit' ? await deleteHabit(id) : await deleteTrackable(id);
    if (!res.ok) {
      pushToast(res.error.message, 'error');
      return;
    }
    deleteTarget = null;
    await loadDashboard();
  };

  const openTrackableSheet = (trackable: Trackable, day: string) => {
    sheetTrackable = trackable;
    sheetDay = day;
    sheetOpen = true;
  };

  const submitTrackableValue = async (value: number) => {
    if (!sheetTrackable) return;
    const res = await setTrackableEntry(sheetTrackable.id, sheetDay, value);
    if (!res.ok) {
      pushToast(res.error.message, 'error');
      return;
    }
    sheetOpen = false;
    await loadDashboard();
  };

  const nextPage = () => {
    if (page === 0) return;
    page = Math.max(0, page - 1);
    loadDashboard();
  };

  const prevPage = () => {
    page = page + 1;
    loadDashboard();
  };

  onMount(() => {
    const observer = new ResizeObserver(() => syncDayCount());
    if (mainEl) {
      observer.observe(mainEl);
      syncDayCount();
    }
    loadDashboard();
    return () => observer.disconnect();
  });

  $: habits = dashboard?.habits ?? [];
  $: trackables = dashboard?.trackables ?? [];
  $: days = dashboard?.days ?? [];
  $: habitEntries = dashboard?.habit_entries ?? {};
  $: trackableEntries = dashboard?.trackable_entries ?? {};
  $: habitStats = dashboard?.habit_stats ?? {};
  $: trackableStats = dashboard?.trackable_stats ?? {};
  $: visibleHabits = showPausedHabits ? habits : habits.filter((h) => h.active);
  $: visibleTrackables = showPausedTrackables ? trackables : trackables.filter((t) => t.active);
  $: canReveal = dashboard?.user?.apiKeyRevealAllowed ?? false;
</script>

<AppHeader
  email={dashboard?.user?.email ?? ''}
  apiKeyMasked={dashboard?.user?.apiKeyMasked ?? '************'}
  apiKeyValue={apiKeyValue}
  apiKeyVisible={apiKeyVisible}
  disabled={!isAuthenticated || !canReveal}
  showLogout={isAuthenticated}
  on:reveal={handleReveal}
  on:regenerate={handleRegenerate}
  on:copy={handleCopy}
  on:logout={handleLogout}
/>

<main bind:this={mainEl} style={`--day-count: ${dayCount};`}>
  {#if !isAuthenticated}
    <section class="tracker-card login-card">
      <div class="card-header">
        <div class="card-title">{authMode === 'login' ? 'Sign in' : 'Create account'}</div>
      </div>
      <div class="login-body">
        <label>
          Email
          <input type="email" bind:value={loginEmail} placeholder="you@example.com" />
        </label>
        <label>
          Password
          <input type="password" bind:value={loginPassword} placeholder="password" />
        </label>
        <div class="login-actions">
          <button
            class="btn-action"
            type="button"
            on:click={authMode === 'login' ? handleLogin : handleSignup}
            disabled={loading}
          >
            {authMode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </div>
        <div class="login-actions">
          <button class="link-btn" type="button" on:click={() => (authMode = authMode === 'login' ? 'signup' : 'login')}>
            {authMode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </section>
  {/if}

  <div class="toast-stack" aria-live="polite">
    {#each toasts as toast (toast.id)}
      <p class={`toast ${toast.kind === 'error' ? 'toast-error' : ''}`}>{toast.message}</p>
    {/each}
  </div>

  {#if isAuthenticated}
    <TrackerCard title="Habits" showPaused={showPausedHabits} disabled={loading} on:togglepaused={() => (showPausedHabits = !showPausedHabits)} on:add={() => (addHabitOpen = true)}>
      <DayHeaderRow
        days={days}
        canPrev={!loading}
        canNext={!loading && page > 0}
        on:prev={prevPage}
        on:next={nextPage}
      />
      {#if visibleHabits.length === 0}
        <div class="empty-row">No habits yet.</div>
      {:else}
        {#each visibleHabits as habit, index}
          <HabitRow
            habit={habit}
            days={days}
            entries={habitEntries[habit.id] ?? {}}
            stats={habitStats[habit.id]}
            colorClass={habitPalette[index % habitPalette.length]}
            disabled={loading}
            on:toggle={(event) => toggleHabit(habit, event.detail.day)}
            on:toggleactive={() => toggleHabitActive(habit)}
            on:delete={() => confirmDelete('habit', habit)}
          />
        {/each}
      {/if}
    </TrackerCard>

    <TrackerCard title="Trackables" showPaused={showPausedTrackables} disabled={loading} on:togglepaused={() => (showPausedTrackables = !showPausedTrackables)} on:add={() => (addTrackableOpen = true)}>
      <DayHeaderRow
        days={days}
        canPrev={!loading}
        canNext={!loading && page > 0}
        on:prev={prevPage}
        on:next={nextPage}
      />
      {#if visibleTrackables.length === 0}
        <div class="empty-row">No trackables yet.</div>
      {:else}
        {#each visibleTrackables as trackable, index}
          <TrackableRow
            trackable={trackable}
            days={days}
            entries={trackableEntries[trackable.id] ?? {}}
            stats={trackableStats[trackable.id]}
            colorClass={trackablePalette[index % trackablePalette.length]}
            disabled={loading}
            on:edit={(event) => openTrackableSheet(trackable, event.detail.day)}
            on:toggleactive={() => toggleTrackableActive(trackable)}
            on:delete={() => confirmDelete('trackable', trackable)}
          />
        {/each}
      {/if}
    </TrackerCard>

  {/if}
</main>

<ConfirmModal
  open={Boolean(deleteTarget)}
  title={deleteTarget?.type === 'habit' ? 'Delete Habit?' : 'Delete Trackable?'}
  message="This action cannot be undone. All data for this item will be lost forever."
  confirmLabel="Delete"
  cancelLabel="Cancel"
  on:cancel={() => (deleteTarget = null)}
  on:confirm={performDelete}
/>

<NumberInputSheet
  open={sheetOpen}
  title={sheetTrackable?.name ?? ''}
  value={sheetTrackable ? trackableEntries[sheetTrackable.id]?.[sheetDay] ?? null : null}
  min={sheetTrackable?.min_value ?? 1}
  max={sheetTrackable?.max_value ?? null}
  unit={sheetTrackable?.unit ?? null}
  on:cancel={() => (sheetOpen = false)}
  on:confirm={(event) => submitTrackableValue(event.detail.value)}
/>

{#if addHabitOpen}
  <div class="modal-backdrop" on:click|self={() => (addHabitOpen = false)}>
    <div class="modal-content form-modal">
      <div class="modal-title">Add habit</div>
      <label>
        Name
        <input type="text" bind:value={habitName} placeholder="Meditate" />
      </label>
      <div class="modal-actions">
        <button class="btn-modal btn-cancel" type="button" on:click={() => (addHabitOpen = false)}>Cancel</button>
        <button class="btn-modal btn-delete" type="button" on:click={submitHabit}>Add</button>
      </div>
    </div>
  </div>
{/if}

{#if addTrackableOpen}
  <div class="modal-backdrop" on:click|self={() => (addTrackableOpen = false)}>
    <div class="modal-content form-modal">
      <div class="modal-title">Add trackable</div>
      <label>
        Name
        <input type="text" bind:value={trackableName} placeholder="Pushups" />
      </label>
      <label>
        Unit (optional)
        <input type="text" bind:value={trackableUnit} placeholder="cups" />
      </label>
      <div class="form-row">
        <label>
          Min
          <input type="number" bind:value={trackableMin} min="1" />
        </label>
        <label>
          Max (optional)
          <input type="number" bind:value={trackableMax} min="1" />
        </label>
      </div>
      <div class="modal-actions">
        <button class="btn-modal btn-cancel" type="button" on:click={() => (addTrackableOpen = false)}>Cancel</button>
        <button class="btn-modal btn-delete" type="button" on:click={submitTrackable}>Add</button>
      </div>
    </div>
  </div>
{/if}



