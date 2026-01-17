<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let days: string[] = [];
  export let canPrev = true;
  export let canNext = true;

  const dispatch = createEventDispatcher();

  const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
  const formatWeekday = (day: string) =>
    toDate(day).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2).toUpperCase();
  const formatDay = (day: string) => String(toDate(day).getUTCDate());

  const prev = () => dispatch('prev');
  const next = () => dispatch('next');
</script>

<div class="tracker-grid day-header-row">
  <div></div>
  <button class="nav-chevron icon-btn" type="button" on:click={prev} disabled={!canPrev} aria-label="Previous days">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M15.5 5.5 9 12l6.5 6.5-1.4 1.4L6.2 12l7.9-7.9z" />
    </svg>
  </button>
  {#each days as day}
    <div class="day-label">
      <span class="day-name">{formatWeekday(day)}</span>
      <span class="day-num">{formatDay(day)}</span>
    </div>
  {/each}
  <button class="nav-chevron icon-btn" type="button" on:click={next} disabled={!canNext} aria-label="Next days">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="m8.5 18.5 6.5-6.5-6.5-6.5 1.4-1.4L17.8 12l-7.9 7.9z" />
    </svg>
  </button>
  <div></div>
  <div></div>
</div>
