<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Habit, HabitStats } from '$lib/types';

  export let habit: Habit;
  export let days: string[] = [];
  export let entries: Record<string, 1> = {};
  export let stats: HabitStats;
  export let colorClass = 'filled-pink';
  export let disabled = false;

  const dispatch = createEventDispatcher();

  const toggleDay = (day: string) => dispatch('toggle', { day });
  const toggleActive = () => dispatch('toggleactive');
  const confirmDelete = () => dispatch('delete');
</script>

<div class={`tracker-grid habit-row ${habit.active ? '' : 'is-paused'}`}>
  <div class="row-title">
    <div class="row-title-main">
      <span class={`row-slit ${colorClass}`}></span>
      <span>{habit.name}</span>
    </div>
    {#if !habit.active}
      <span class="paused-badge">Paused</span>
    {/if}
  </div>
  <div></div>
  {#each days as day}
    <button
      class={`day-square ${entries[day] ? colorClass : ''}`}
      type="button"
      aria-pressed={entries[day] ? 'true' : 'false'}
      aria-label={`${habit.name} ${day}`}
      on:click={() => toggleDay(day)}
      disabled={disabled}
    ></button>
  {/each}
  <div></div>
  <div class="info-block">
    <span class="info-highlight">{stats?.monthly_completion ?? 0}%</span>
    <span>Streak {stats?.current_streak ?? 0}</span>
  </div>
  <div class="row-actions">
    <button class="icon-btn action-icon" type="button" on:click={toggleActive} disabled={disabled} aria-label="Toggle pause">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {#if habit.active}
          <path fill="currentColor" d="M10 4H6v16h4V4Zm8 0h-4v16h4V4Z" />
        {:else}
          <path fill="currentColor" d="M8 5v14l11-7z" />
        {/if}
      </svg>
    </button>
    <button class="icon-btn action-icon destructive" type="button" on:click={confirmDelete} disabled={disabled} aria-label="Delete habit">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9Zm-8 0h2v8H6V9Z"
        />
      </svg>
    </button>
  </div>
</div>
