<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let title = '';
  export let showPaused = false;
  export let disabled = false;

  const dispatch = createEventDispatcher();

  const togglePaused = () => dispatch('togglepaused');
  const addItem = () => dispatch('add');
</script>

<section class="tracker-card">
  <div class="card-header">
    <div class="card-title">{title}</div>
    <div class="card-actions">
      <button class="btn-action" type="button" on:click={togglePaused} disabled={disabled}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 5c4.5 0 8.4 2.7 10 7-1.6 4.3-5.5 7-10 7S3.6 16.3 2 12c1.6-4.3 5.5-7 10-7Zm0 2C8.6 7 5.6 9 4.2 12 5.6 15 8.6 17 12 17s6.4-2 7.8-5C18.4 9 15.4 7 12 7Zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z"
          />
        </svg>
        {showPaused ? 'Hide paused' : 'Show paused'}
      </button>
      <button class="btn-action" type="button" on:click={addItem} disabled={disabled}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M11 5h2v14h-2zM5 11h14v2H5z" />
        </svg>
        Add
      </button>
    </div>
  </div>
  <slot />
</section>
