<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let email = '';
  export let apiKeyMasked = '************';
  export let apiKeyValue = '';
  export let apiKeyVisible = false;
  export let disabled = false;
  export let showLogout = false;

  const dispatch = createEventDispatcher();

  const onReveal = () => dispatch('reveal');
  const onRegenerate = () => dispatch('regenerate');
  const onCopy = () => dispatch('copy');
  const onLogout = () => dispatch('logout');
</script>

<header class="app-header">
  <div class="app-header-inner">
    <div class="app-name">Tracker</div>
    <div class="user-email" title={email}>{email || 'Not signed in'}</div>
    <div class="header-spacer"></div>
    <div class="api-key-container">
      <span class="api-key-mask">{apiKeyVisible && apiKeyValue ? apiKeyValue : apiKeyMasked}</span>
      <button class="icon-btn" type="button" on:click={onReveal} disabled={disabled} aria-label="Reveal API key">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 5c4.5 0 8.4 2.7 10 7-1.6 4.3-5.5 7-10 7S3.6 16.3 2 12c1.6-4.3 5.5-7 10-7Zm0 2C8.6 7 5.6 9 4.2 12 5.6 15 8.6 17 12 17s6.4-2 7.8-5C18.4 9 15.4 7 12 7Zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z"
          />
        </svg>
      </button>
      <button class="icon-btn" type="button" on:click={onRegenerate} disabled={disabled} aria-label="Regenerate API key">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 5a7 7 0 0 1 6.2 3.7V6h2v6h-6v-2h3.2A5 5 0 1 0 17 17l1.4 1.4A7 7 0 1 1 12 5Z"
          />
        </svg>
      </button>
      <button class="icon-btn" type="button" on:click={onCopy} disabled={disabled || !apiKeyValue} aria-label="Copy API key">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1Zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H10V7h9Z"
          />
        </svg>
      </button>
    </div>
    {#if showLogout}
      <button class="header-logout" type="button" on:click={onLogout}>Log out</button>
    {/if}
  </div>
</header>
