import { writable } from 'svelte/store';

const storageKey = 'tracker_api_token';
const initial = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) ?? '' : '';

export const token = writable(initial);

token.subscribe((value) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(storageKey, value);
  }
});
