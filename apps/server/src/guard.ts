// Request guards: loopback Host only (defeats DNS rebinding), browser origins limited to the extension and
// local pages, JSON-only POSTs (so any other web page needs a preflight we never grant).
import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { PORT } from './config';

const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`]);
const ORIGIN_OK = [/^chrome-extension:\/\/[a-z0-9]{1,64}$/i, /^http:\/\/127\.0\.0\.1(?::\d{1,5})?$/];

export function originAllowed(origin: string | undefined | null): boolean {
  if (!origin) return true; // non-browser callers (the dev check, curl, the eval harness)
  return ORIGIN_OK.some((re) => re.test(origin));
}

export const hostGuard: MiddlewareHandler = async (c, next) => {
  const host = c.req.header('host');
  if (host !== undefined && !ALLOWED_HOSTS.has(host.toLowerCase())) {
    return c.json({ error: 'bad_host', message: 'This server only answers on 127.0.0.1.' }, 403);
  }
  await next();
};

export const originGuard: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.method !== 'OPTIONS') {
    if (!originAllowed(c.req.header('origin'))) {
      return c.json({ error: 'bad_origin', message: 'Requests are accepted from the WebAble extension only.' }, 403);
    }
    const type = c.req.header('content-type') ?? '';
    if (!/^application\/json\b/i.test(type)) {
      return c.json({ error: 'bad_content_type', message: 'Send JSON (Content-Type: application/json).' }, 415);
    }
  }
  await next();
};

export const corsMiddleware: MiddlewareHandler = cors({
  origin: (origin) => (origin && originAllowed(origin) ? origin : null),
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-WebAble', 'X-WebAble-Fresh'],
  exposeHeaders: ['X-WebAble-Cache', 'X-WebAble-Ms'],
  maxAge: 600,
});
