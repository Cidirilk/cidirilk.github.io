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
 *
 * Routes:
 *   /                    LiveSets live status (polling)
 *   /sessions            latest sessions list (parsed)
 *   /session-meta/<id>   one of CIDIRILK's sessions: metadata (audio + waveform URLs)
 *   /audio/<id>          the session MP3 with working byte ranges (seekable);
 *                        ?t=<seconds> starts the stream at that time
 *   /waveform/<id>       the session's real waveform, downsampled to 240 peaks
 *   /live/meta           live radio state (connected, title, listeners)
 *   /live/audio          302 to the current live MP3 stream (?format=ogg for
 *                        OGG); 503 JSON {connected:false} while offline
 *   anything else        404
 *
 * Session routes serve CIDIRILK's own sets only (LiveSets page under
 * /cidirilk/), so the worker can't be used to stream other users' audio.
 * Errors are never cached for long (see cacheFor).
 */

const STATUS_UPSTREAM = 'https://livesets.com/app/polling/live/42069';
const SESSIONS_UPSTREAM = 'https://livesets.com/cidirilk/sessions';
const SESSION_META_UPSTREAM = 'https://livesets.com/json/session/meta/';
// Live radio: the stream URL carries a fresh token on every request, so the
// site asks /live/audio and gets redirected to the current one.
const LIVE_META_UPSTREAM = 'https://livesets.com/json/meta/live/';
const LIVE_MOUNT_FALLBACK = '37551';
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

// ---------------------------------------------------------------------------
// Session audio + waveform
// LiveSets' Apache server advertises "Accept-Ranges: bytes" but ignores Range
// and always answers 200 with the whole file, so browsers cannot seek past
// what they have buffered. /audio/<id> serves the MP3 through Cloudflare's
// cache and answers Range requests with proper 206 slices (cutting the slice
// from the full stream when the upstream ignores the range).
// /waveform/<id> returns the set's real waveform, downsampled.
// ---------------------------------------------------------------------------
const AUDIO_CACHE_TTL = 60 * 60 * 24 * 7; // a week; sets don't change
const WAVEFORM_POINTS = 240;
// Only CIDIRILK's own sets are proxied (LiveSets page URLs are /<user>/...),
// so the worker cannot be used to stream or mirror anyone else's audio.
const OWNER_PATH_PREFIX = '/cidirilk/';

// Cloudflare cache settings: cache successes, never keep errors around for
// long (a passing LiveSets hiccup must not break a set for a week).
const cacheFor = (seconds) => ({
  cacheEverything: true,
  cacheTtlByStatus: { '200-299': seconds, '404': 60, '500-599': 0 },
});

const isOwnSession = (meta) => {
  try {
    return new URL(meta?.urlPage || '').pathname.startsWith(OWNER_PATH_PREFIX);
  } catch {
    return false;
  }
};

const fetchSessionMeta = async (sessionId) => {
  const upstream = await fetch(`${SESSION_META_UPSTREAM}${sessionId}`, {
    headers: { Accept: 'application/json' },
    cf: cacheFor(3600),
  });
  if (!upstream.ok) return null;
  const meta = normalizeSessionMeta(await upstream.json().catch(() => null));
  return isOwnSession(meta) ? meta : null;
};

const isLiveSetsPubUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.hostname === 'livesets.com' && parsed.pathname.startsWith('/pub/');
  } catch {
    return false;
  }
};

const parseRange = (header, size) => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start;
  let end;
  if (match[1]) {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    // bytes=10-5 is invalid: ignore the header and serve the whole file
    if (match[2] && Number(match[2]) < start) return null;
  } else {
    // suffix range: last N bytes
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  }
  return start <= end && start < size ? { start, end } : 'unsatisfiable';
};

// Pass through only bytes [start, end] of a stream.
const sliceStream = (body, start, end) => {
  let offset = 0;
  return body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        const chunkStart = offset;
        const chunkEnd = offset + chunk.byteLength - 1;
        offset += chunk.byteLength;
        if (chunkEnd < start || chunkStart > end) return;
        controller.enqueue(chunk.subarray(Math.max(0, start - chunkStart), Math.min(chunk.byteLength, end - chunkStart + 1)));
        if (chunkEnd >= end) controller.terminate();
      },
    }),
  );
};

// File size from LiveSets with a HEAD request (no download), remembered per
// isolate, so a ?t= seek never has to open the whole file first.
const audioSizes = new Map();
const getAudioSize = async (url) => {
  if (audioSizes.has(url)) return audioSizes.get(url);
  try {
    const head = await fetch(url, { method: 'HEAD' });
    const size = Number(head.headers.get('Content-Length') || 0);
    if (size) audioSizes.set(url, size);
    return size;
  } catch {
    return 0;
  }
};

const serveSessionAudio = async (request, sessionId, corsHeaders) => {
  const meta = await fetchSessionMeta(sessionId);
  const mp3 = meta?.urlAudio?.find((audio) => /mpeg|mp3/i.test(audio.type) || /\.mp3$/i.test(audio.url))?.url;
  if (!mp3 || !isLiveSetsPubUrl(mp3)) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  const isHead = request.method === 'HEAD';
  const rangeHeader = request.headers.get('Range');
  const tParam = new URL(request.url).searchParams.get('t');
  const startSeconds = tParam === null ? 0 : Number(tParam);

  const headers = new Headers(corsHeaders);
  headers.set('Content-Type', 'audio/mpeg');
  headers.set('Cache-Control', `public, max-age=${AUDIO_CACHE_TTL}`);

  // Cached byte range from Cloudflare (206): passing it through costs almost
  // no CPU, unlike reading 40+ MB in JS (sliceStream), which can exceed the
  // free plan's CPU limit and cut the response off.
  const fetchRange = (start, end = '') => fetch(mp3, {
    headers: { Range: `bytes=${start}-${end}` },
    cf: cacheFor(AUDIO_CACHE_TTL),
  });

  // ?t=<seconds>: start the stream at that point of the set. Cloudflare does
  // not pass the browser's Range header through to workers.dev, so the site
  // seeks by URL instead. LiveSets sets are constant-bitrate MP3s, so a time
  // maps linearly to a byte offset (MP3 frames resync on their own).
  if (!rangeHeader && Number.isFinite(startSeconds) && startSeconds > 0 && meta.duration > 0) {
    const size = await getAudioSize(mp3);
    if (size) {
      const startByte = Math.min(size - 1, Math.floor((Math.min(startSeconds, meta.duration) / meta.duration) * size));
      // A partial body: no ETag, and no byte ranges (see the 200 path below)
      headers.set('Accept-Ranges', 'none');
      headers.set('Content-Length', String(size - startByte));
      headers.set('X-Audio-Start', String(startSeconds));
      if (isHead) return new Response(null, { status: 200, headers });

      const partial = await fetchRange(startByte);
      if (partial.status === 206) return new Response(partial.body, { status: 200, headers });
      if (partial.ok) {
        // Upstream ignored the range: cut the slice ourselves (last resort)
        return new Response(sliceStream(partial.body, startByte, size - 1), { status: 200, headers });
      }
      partial.body?.cancel();
      return new Response('Upstream error', { status: 502, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
    }
  }

  const upstream = await fetch(mp3, {
    method: isHead ? 'HEAD' : 'GET',
    headers: rangeHeader ? { Range: rangeHeader } : {},
    cf: cacheFor(AUDIO_CACHE_TTL),
  });
  if (!upstream.ok) {
    upstream.body?.cancel();
    return new Response('Upstream error', { status: upstream.status, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
  }
  headers.set('Content-Type', upstream.headers.get('Content-Type') || 'audio/mpeg');
  // Byte ranges are only advertised on real 206 answers. Cloudflare strips the
  // browser's Range header on workers.dev, so a 200 here can't honour a later
  // "from byte N" request: phones (iOS Safari) that relied on it got the file
  // from byte 0 and the set restarted. "none" makes them stream it straight
  // through; the site seeks with ?t= instead.
  headers.set('Accept-Ranges', 'none');

  // Upstream (or Cloudflare's cache) honoured the range: pass it through.
  if (upstream.status === 206) {
    headers.set('Accept-Ranges', 'bytes');
    const etag = upstream.headers.get('ETag');
    if (etag) headers.set('ETag', etag);
    ['Content-Range', 'Content-Length'].forEach((name) => {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    });
    if (isHead) upstream.body?.cancel();
    return new Response(isHead ? null : upstream.body, { status: 206, headers });
  }

  const size = Number(upstream.headers.get('Content-Length') || 0) || await getAudioSize(mp3);
  const range = rangeHeader && size ? parseRange(rangeHeader, size) : null;
  if (range === 'unsatisfiable') {
    upstream.body?.cancel();
    headers.set('Content-Range', `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  if (!range) {
    if (size) headers.set('Content-Length', String(size));
    if (isHead) upstream.body?.cancel();
    return new Response(isHead ? null : upstream.body, { status: 200, headers });
  }

  // Upstream ignored the range (200, whole file): ask the cache for the
  // slice natively first, slice in JS only as a last resort.
  upstream.body?.cancel();
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
  headers.set('Content-Length', String(range.end - range.start + 1));
  headers.set('Accept-Ranges', 'bytes');
  if (isHead) return new Response(null, { status: 206, headers });
  const partial = await fetchRange(range.start, range.end);
  if (partial.status === 206) return new Response(partial.body, { status: 206, headers });
  if (partial.ok) return new Response(sliceStream(partial.body, range.start, range.end), { status: 206, headers });
  partial.body?.cancel();
  return new Response('Upstream error', { status: 502, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
};

const serveSessionWaveform = async (sessionId, corsHeaders) => {
  const meta = await fetchSessionMeta(sessionId);
  const source = meta?.urlWaveform;
  if (!source || !isLiveSetsPubUrl(source)) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const upstream = await fetch(source, { cf: cacheFor(AUDIO_CACHE_TTL) });
  const data = upstream.ok ? await upstream.json().catch(() => null) : null;
  const samples = Array.isArray(data?.left) ? data.left.map(Number).filter(Number.isFinite) : [];
  if (!samples.length) {
    return new Response(JSON.stringify({ error: 'no_waveform' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  // Downsample to WAVEFORM_POINTS peaks (max of each bucket).
  const bucket = samples.length / WAVEFORM_POINTS;
  const peaks = Array.from({ length: Math.min(WAVEFORM_POINTS, samples.length) }, (_, i) => {
    const from = Math.floor(i * bucket);
    const to = Math.max(from + 1, Math.floor((i + 1) * bucket));
    // Loop, not Math.max(...slice): a spread of a huge bucket throws RangeError
    let peak = -Infinity;
    for (let j = from; j < to && j < samples.length; j += 1) if (samples[j] > peak) peak = samples[j];
    return Math.round((Number.isFinite(peak) ? peak : 0) * 1000) / 1000;
  });
  return new Response(JSON.stringify({ peaks, duration: Number(data.duration) || meta.duration || 0 }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${AUDIO_CACHE_TTL}`,
    },
  });
};

// Live radio. The polling endpoint names the current mount; its meta lists
// the stream URLs (MP3 + OGG), each with a short-lived token.
const fetchLiveMeta = async () => {
  let mountId = LIVE_MOUNT_FALLBACK;
  try {
    const status = await fetch(`${STATUS_UPSTREAM}?t=${Date.now()}`, {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    const data = status.ok ? (await status.json())?.data : null;
    // Upstream value goes into a URL path: digits only
    if (/^\d+$/.test(String(data?.mountId || ''))) mountId = String(data.mountId);
  } catch {}
  const upstream = await fetch(`${LIVE_META_UPSTREAM}${mountId}?t=${Date.now()}`, {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: 0, cacheEverything: false },
  });
  if (!upstream.ok) return null;
  const meta = await upstream.json();
  const urlAudio = (Array.isArray(meta?.urlAudio) ? meta.urlAudio : [])
    .map((item) => ({
      type: String(item?.type || ''),
      url: String(item?.url || '').startsWith('//') ? `https:${item.url}` : normalizeLiveSetsUrl(item?.url),
    }))
    .filter((item) => item.url);
  return {
    mountId,
    connected: Boolean(meta?.connected),
    title: String(meta?.title || ''),
    listeners: Number(meta?.listeners) || 0,
    urlAudio,
  };
};

const serveLive = async (url, corsHeaders) => {
  const live = await fetchLiveMeta();
  const json = (body, status) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  if (!live) return json({ connected: false, error: 'meta_unavailable' }, 502);

  if (url.pathname === '/live/meta') {
    const { connected, title, listeners } = live;
    return json({ connected, title, listeners }, 200);
  }

  // /live/audio: send the player to the current stream
  if (!live.connected) return json({ connected: false }, 503);
  const wantOgg = url.searchParams.get('format') === 'ogg' || url.pathname.endsWith('.ogg');
  // Only ever redirect to LiveSets' own https stream URLs (never an open redirect)
  const isLiveSetsStream = (value) => {
    try {
      const target = new URL(value);
      return target.protocol === 'https:'
        && (target.hostname === 'livesets.com' || target.hostname.endsWith('.livesets.com'));
    } catch {
      return false;
    }
  };
  const streams = live.urlAudio.filter((item) => isLiveSetsStream(item.url));
  const stream = streams.find((item) => item.type.includes(wantOgg ? 'ogg' : 'mpeg')) || streams[0];
  if (!stream) return json({ connected: true, error: 'no_stream' }, 502);
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: stream.url, 'Cache-Control': 'no-store' },
  });
};

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
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, Content-Type, Range',
      'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    try {
      const audioMatch = url.pathname.match(/^\/audio\/(\d+)(?:\.mp3)?$/);
      if (audioMatch) {
        return await serveSessionAudio(request, audioMatch[1], corsHeaders);
      }

      if (url.pathname === '/live/meta' || /^\/live\/audio(?:\.(?:mp3|ogg))?$/.test(url.pathname)) {
        return await serveLive(url, corsHeaders);
      }

      const waveformMatch = url.pathname.match(/^\/waveform\/(\d+)$/);
      if (waveformMatch) {
        return await serveSessionWaveform(waveformMatch[1], corsHeaders);
      }

      // JSON helper: errors are never cached by browsers
      const jsonResponse = (body, status, maxAge = 0) => new Response(JSON.stringify(body), {
        status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': status === 200 && maxAge ? `public, max-age=${maxAge}` : 'no-store',
        },
      });

      if (url.pathname === '/sessions') {
        // No cache-buster: Cloudflare caches the page for 5 minutes, so
        // visitors (or abuse) don't each hit LiveSets
        const upstream = await fetch(SESSIONS_UPSTREAM, {
          headers: { Accept: 'text/html' },
          cf: cacheFor(300),
        });
        if (!upstream.ok) {
          upstream.body?.cancel();
          return jsonResponse({ sessions: [], error: 'upstream_error' }, 502);
        }
        const sessions = parseSessionsHtml(await upstream.text());
        return jsonResponse({ sessions }, 200, 300);
      }

      const sessionMetaMatch = url.pathname.match(/^\/session-meta\/(\d+)$/);
      if (sessionMetaMatch) {
        // CIDIRILK's own sets only (see fetchSessionMeta)
        const meta = await fetchSessionMeta(sessionMetaMatch[1]);
        if (!meta) return jsonResponse({ meta: {}, error: 'not_found' }, 404);
        return jsonResponse({ meta }, 200, 300);
      }

      if (url.pathname !== '/') {
        return new Response('Not Found', { status: 404, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
      }

      // Live status (the badge polls this every 15s)
      const upstream = await fetch(`${STATUS_UPSTREAM}?t=${Date.now()}`, {
        headers: { Accept: 'application/json' },
        cf: { cacheTtl: 0, cacheEverything: false },
      });
      if (!upstream.ok) {
        upstream.body?.cancel();
        return jsonResponse({ error: 'upstream_error' }, 502);
      }
      return new Response(await upstream.text(), {
        status: 200,
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
