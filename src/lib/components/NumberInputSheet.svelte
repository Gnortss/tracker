<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  export let title = '';
  export let value: number | null = null;
  export let min = 0;
  export let max: number | null = null;
  export let unit: string | null = null;

  const dispatch = createEventDispatcher();
  let localValue = '';

  $: if (open) {
    localValue = value === null || value === undefined ? '' : String(value);
  }

  const cancel = () => dispatch('cancel');
  const confirm = () => {
    const text = String(localValue ?? '').trim();
    if (!text) return;
    const numeric = Number(text);
    if (!Number.isFinite(numeric)) return;
    dispatch('confirm', { value: numeric });
  };
</script>

{#if open}
  <div class="sheet-backdrop" on:click|self={cancel}>
    <form class="sheet" role="dialog" aria-modal="true" aria-label={title} on:submit|preventDefault={confirm}>
      <div class="sheet-header">
        <h3>{title}</h3>
        <p class="sheet-subtitle">Enter a value{unit ? ` (${unit})` : ''}. Use 0 to clear.</p>
      </div>
      <div class="sheet-body">
        <input
          type="number"
          min={0}
          max={max ?? undefined}
          step="1"
          bind:value={localValue}
          inputmode="numeric"
          aria-label="Value"
        />
      </div>
      <div class="sheet-actions">
        <button class="btn-modal btn-cancel" type="button" on:click={cancel}>Cancel</button>
        <button class="btn-modal btn-delete" type="submit">Save</button>
      </div>
    </form>
  </div>
{/if}
