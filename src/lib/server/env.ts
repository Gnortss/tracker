import type { RequestEvent } from '@sveltejs/kit';

export const getApiKeySecret = (event: RequestEvent): string => {
  const fromPlatform = event.platform?.env?.API_KEY_SECRET;
  if (fromPlatform) return fromPlatform;
  if (typeof process !== 'undefined' && process.env?.API_KEY_SECRET) {
    return process.env.API_KEY_SECRET;
  }
  return '';
};
