/**
 * Cloudflare Worker: LiveSets status proxy
 * ----------------------------------------
 * Durable, self-hosted CORS proxy for the CIDIRILK live badge. Unlike public
 * proxies (corsproxy.io, allorigins, ...), this one is yours: it won't be rate
 * limited, locked behind an API key, or shut down without notice.
 *
 * Why this exists:
 *   The browser cannot call https://livesets.com/app/polling/live/42069 directly
 *   because LiveSets does not send CORS headers. This worker fetches that
 *   endpoint server-side and re-serves it with permissive CORS headers.
 *
 * Deploy (one-time, free tier is plenty):
 *   Option A - Dashboard:
 *     1. https://dash.cloudflare.com  ->  Workers & Pages  ->  Create  ->  Worker
 *     2. Replace the default code with this file's contents and Deploy.
 *     3. Copy the worker URL, e.g. https://livesets-proxy.<you>.workers.dev
 *     4. In assets/js/script.js set:
 *          const LIVESETS_PROXY_WORKER = 'https://livesets-proxy.<you>.workers.dev/';
 *
 *   Option B - Wrangler CLI:
 *     1. npm i -g wrangler && wrangler login
 *     2. wrangler deploy livesets-proxy-worker.js --name livesets-proxy
 *     3. Use the printed URL as LIVESETS_PROXY_WORKER (see step 4 above).
 *
 * Lock it down (recommended): set ALLOWED_ORIGIN to your site so only it can use
 * the worker. Use '*' while testing locally.
 */

const UPSTREAM = 'https://livesets.com/app/polling/live/42069';
// The site is served from both the GitHub Pages domain and the custom domain.
// A CORS response can only name one origin, so reflect whichever one matches.
const ALLOWED_ORIGINS = [
  'https://cidirilk.com',
  'https://www.cidirilk.com',
  'https://cidirilk.github.io',
];
// Local dev servers (Live Server, http-server, vite, etc.) on any port.
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const isAllowedOrigin = (origin) =>
  ALLOWED_ORIGINS.includes(origin) || LOCAL_ORIGIN_RE.test(origin);

export default {
  async fetch(request) {
    const requestOrigin = request.headers.get('Origin') || '';
    const allowOrigin = isAllowedOrigin(requestOrigin)
      ? requestOrigin
      : ALLOWED_ORIGINS[0];

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    try {
      const upstream = await fetch(`${UPSTREAM}?t=${Date.now()}`, {
        headers: { Accept: 'application/json' },
        cf: { cacheTtl: 0, cacheEverything: false },
      });

      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'upstream_unreachable' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
