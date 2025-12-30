import { fail } from './apiResponse';

export const requireAuth = (request: Request, token?: string): Response | null => {
  const header = request.headers.get('authorization');
  if (!token) {
    return fail('UNAUTHORIZED', 'API token is not configured', 401);
  }
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return fail('UNAUTHORIZED', 'Missing bearer token', 401);
  }
  const provided = header.substring(7).trim();
  if (provided !== token) {
    return fail('UNAUTHORIZED', 'Invalid bearer token', 401);
  }
  return null;
};
