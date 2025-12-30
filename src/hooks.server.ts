import type { Handle } from '@sveltejs/kit';

const buildCorsHeaders = (origin: string | null, allowed: string | undefined) => {
  if (!origin || !allowed) return {} as Record<string, string>;
  const origins = allowed
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.includes('*') || origins.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origins.includes('*') ? '*' : origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    };
  }
  return {} as Record<string, string>;
};

export const handle: Handle = async ({ event, resolve }) => {
  const origin = event.request.headers.get('Origin');
  const corsHeaders = buildCorsHeaders(origin, event.platform?.env?.ALLOWED_ORIGINS);

  if (event.request.method === 'OPTIONS' && event.url.pathname.startsWith('/api/')) {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const response = await resolve(event);
  if (Object.keys(corsHeaders).length > 0) {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }
  return response;
};
