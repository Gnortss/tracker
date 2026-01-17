<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  export let title = '';
  export let message = '';
  export let confirmLabel = 'Delete';
  export let cancelLabel = 'Cancel';

  const dispatch = createEventDispatcher();

  const onCancel = () => dispatch('cancel');
  const onConfirm = () => dispatch('confirm');
</script>

{#if open}
  <div class="modal-backdrop" on:click|self={onCancel}>
    <div class="modal-content" role="dialog" aria-modal="true" aria-label={title}>
      <div class="modal-title">{title}</div>
      <div class="modal-text">{message}</div>
      <div class="modal-actions">
        <button class="btn-modal btn-cancel" type="button" on:click={onCancel}>
          {cancelLabel}
        </button>
        <button class="btn-modal btn-delete" type="button" on:click={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}
