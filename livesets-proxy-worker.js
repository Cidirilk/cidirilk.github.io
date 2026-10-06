/**
 * Cloudflare Worker: LiveSets proxy
 * ---------------------------------
 * Durable, self-hosted CORS proxy for the CIDIRILK live badge and sessions list. Unlike public
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

const STATUS_UPSTREAM = 'https://livesets.com/app/polling/live/42069';
const SESSIONS_UPSTREAM = 'https://livesets.com/cidirilk/sessions';
const SESSION_META_UPSTREAM = 'https://livesets.com/json/session/meta/';
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

const normalizeLiveSetsUrl = (url) => {
  const value = String(url || '').trim();
  if (!value) return '';
  return value.startsWith('http') ? value : `https://livesets.com${value}`;
};

const decodeHtml = (value) =>
  String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const stripTags = (value) => decodeHtml(String(value || '').replace(/<[^>]*>/g, ''));

const attr = (html, name) => {
  const match = String(html || '').match(new RegExp(`${name}=["']([^"']*)["']`, 'i'));
  return decodeHtml(match?.[1] || '');
};

const parseSessionsHtml = (html) => {
  const items = String(html || '').match(/<div class="media-list item link"[\s\S]*?(?=<div class="media-list item link"|<div class="row explorer pager")/g) || [];

  return items
    .map((item, index) => {
      const titleMatch = item.match(/<div class="head">\s*<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      const avatarMatch = item.match(/background:url\(['"]?([^'")]+)['"]?\)/i);
      const subText = stripTags(item.match(/<div class="sub">([\s\S]*?)<\/div>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
      const [, age = ''] = subText.split('|').map((part) => part.trim());
      return {
        index: index + 1,
        title: stripTags(titleMatch?.[2] || '').replace(/\s+/g, ' ').trim(),
        url: normalizeLiveSetsUrl(attr(item, 'data-url') || titleMatch?.[1] || ''),
        age,
        genre: stripTags(item.match(/<div class="meta">([\s\S]*?)<\/div>/i)?.[1] || '').replace(/\s+/g, ' ').trim(),
        duration: stripTags(item.match(/<span class="playtime">\s*([\s\S]*?)\s*<\/span>/i)?.[1] || '').replace(/\s+/g, ' ').trim(),
        artwork: normalizeLiveSetsUrl(avatarMatch?.[1] || ''),
      };
    })
    .filter((session) => session.title && session.url);
};

const normalizeSessionMeta = (meta) => ({
  id: String(meta?.id || meta?.soundId || ''),
  soundId: String(meta?.soundId || meta?.id || ''),
  type: meta?.type || 'session',
  title: meta?.title || '',
  user: meta?.user || '',
  duration: Number(meta?.duration || 0),
  urlPage: normalizeLiveSetsUrl(meta?.urlPage || ''),
  urlWaveform: normalizeLiveSetsUrl(meta?.urlWaveform || ''),
  urlAudio: Array.isArray(meta?.urlAudio)
    ? meta.urlAudio
        .map((audio) => ({
          type: audio?.type || '',
          url: normalizeLiveSetsUrl(audio?.url || ''),
        }))
        .filter((audio) => audio.url)
    : [],
});

export default {
  async fetch(request) {
    const url = new URL(request.url);
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
      if (url.pathname === '/sessions') {
        const upstream = await fetch(`${SESSIONS_UPSTREAM}?t=${Date.now()}`, {
          headers: { Accept: 'text/html' },
          cf: { cacheTtl: 300, cacheEverything: false },
        });

        const html = await upstream.text();
        const sessions = parseSessionsHtml(html);
        return new Response(JSON.stringify({ sessions }), {
          status: upstream.ok ? 200 : upstream.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300',
          },
        });
      }

      const sessionMetaMatch = url.pathname.match(/^\/session-meta\/(\d+)$/);
      if (sessionMetaMatch) {
        const [, sessionId] = sessionMetaMatch;
        const upstream = await fetch(`${SESSION_META_UPSTREAM}${sessionId}?t=${Date.now()}`, {
          headers: { Accept: 'application/json' },
          cf: { cacheTtl: 300, cacheEverything: false },
        });

        const meta = upstream.ok ? normalizeSessionMeta(await upstream.json()) : {};
        return new Response(JSON.stringify({ meta }), {
          status: upstream.ok ? 200 : upstream.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300',
          },
        });
      }

      const upstream = await fetch(`${STATUS_UPSTREAM}?t=${Date.now()}`, {
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
