<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Trackable, TrackableStats } from '$lib/types';

  export let trackable: Trackable;
  export let days: string[] = [];
  export let entries: Record<string, number> = {};
  export let stats: TrackableStats;
  export let colorClass = 'filled-orange';
  export let disabled = false;

  $: avgValue = stats?.average_value;

  const dispatch = createEventDispatcher();

  const editDay = (day: string) => dispatch('edit', { day });
  const toggleActive = () => dispatch('toggleactive');
  const confirmDelete = () => dispatch('delete');
</script>

<div class={`tracker-grid trackable-row ${trackable.active ? '' : 'is-paused'}`}>
  <div class="row-title">
    <div class="row-title-main">
      <span class={`row-slit ${colorClass}`}></span>
      <span>{trackable.name}</span>
    </div>
    {#if !trackable.active}
      <span class="paused-badge">Paused</span>
    {/if}
  </div>
  <div></div>
  {#each days as day}
    {@const value = entries[day]}
    <button
      class={`day-square ${value ? colorClass : ''}`}
      type="button"
      aria-label={`${trackable.name} ${day}`}
      on:click={() => editDay(day)}
      disabled={disabled}
    >
      {#if value}
        {value}
      {/if}
    </button>
  {/each}
  <div></div>
  <div class="info-block">
    <span class="info-highlight">Avg {avgValue === null || avgValue === undefined ? '--' : avgValue}</span>
    <span>Streak {stats?.current_streak ?? 0}</span>
  </div>
  <div class="row-actions">
    <button class="icon-btn action-icon" type="button" on:click={toggleActive} disabled={disabled} aria-label="Toggle pause">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {#if trackable.active}
          <path fill="currentColor" d="M10 4H6v16h4V4Zm8 0h-4v16h4V4Z" />
        {:else}
          <path fill="currentColor" d="M8 5v14l11-7z" />
        {/if}
      </svg>
    </button>
    <button class="icon-btn action-icon destructive" type="button" on:click={confirmDelete} disabled={disabled} aria-label="Delete trackable">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9Zm-8 0h2v8H6V9Z"
        />
      </svg>
    </button>
  </div>
</div>
