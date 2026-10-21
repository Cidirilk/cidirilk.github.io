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
 *   /session-meta/<id>   one session's metadata (audio + waveform URLs)
 *   /audio/<id>          the session MP3 with working byte ranges (seekable)
 *   /waveform/<id>       the session's real waveform, downsampled to 240 peaks
 *   /live/meta           live radio state (connected, title, listeners)
 *   /live/audio          302 to the current live MP3 stream (?format=ogg for
 *                        OGG); 503 JSON {connected:false} while offline
 *
 * After deploying, check that Cloudflare caches the audio (seeks are then
 * instant): request /audio/<id> twice with a Range header and look for
 * "X-Upstream-Cache: HIT" on the second response.
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

const fetchSessionMeta = async (sessionId) => {
  const upstream = await fetch(`${SESSION_META_UPSTREAM}${sessionId}`, {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  return upstream.ok ? normalizeSessionMeta(await upstream.json()) : null;
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

// Cached responses can reach the worker without Content-Length; get the file
// size from LiveSets directly (HEAD) and remember it per isolate.
const audioSizes = new Map();
const getAudioSize = async (url, upstream) => {
  const fromHeader = Number(upstream.headers.get('Content-Length') || 0);
  if (fromHeader) return fromHeader;
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

  const rangeHeader = request.headers.get('Range');
  const upstream = await fetch(mp3, {
    headers: rangeHeader ? { Range: rangeHeader } : {},
    cf: { cacheEverything: true, cacheTtl: AUDIO_CACHE_TTL },
  });
  if (!upstream.ok) {
    return new Response('Upstream error', { status: upstream.status, headers: corsHeaders });
  }

  const headers = new Headers(corsHeaders);
  headers.set('Content-Type', upstream.headers.get('Content-Type') || 'audio/mpeg');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', `public, max-age=${AUDIO_CACHE_TTL}`);
  const etag = upstream.headers.get('ETag');
  if (etag) headers.set('ETag', etag);
  // Debug aid: HIT once Cloudflare has cached the file (seeks are then instant)
  headers.set('X-Upstream-Cache', upstream.headers.get('CF-Cache-Status') || 'none');

  // Upstream (or Cloudflare's cache) honoured the range: pass it through.
  if (upstream.status === 206) {
    ['Content-Range', 'Content-Length'].forEach((name) => {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    });
    return new Response(request.method === 'HEAD' ? null : upstream.body, { status: 206, headers });
  }

  const size = await getAudioSize(mp3, upstream);

  // ?t=<seconds>: start the stream at that point of the set. Cloudflare does
  // not pass the browser's Range header through to workers.dev, so the site
  // seeks by URL instead. LiveSets sets are constant-bitrate MP3s, so a
  // time maps linearly to a byte offset (MP3 frames resync on their own).
  const startSeconds = Number(new URL(request.url).searchParams.get('t'));
  if (!rangeHeader && size && Number.isFinite(startSeconds) && startSeconds > 0 && meta.duration > 0) {
    const startByte = Math.min(size - 1, Math.floor((startSeconds / meta.duration) * size));
    headers.set('Content-Length', String(size - startByte));
    headers.set('X-Audio-Start', String(startSeconds));
    headers.delete('Accept-Ranges');
    if (request.method === 'HEAD') {
      upstream.body?.cancel();
      return new Response(null, { status: 200, headers });
    }

    // Preferred: ask Cloudflare's cache for the byte range. A cached object
    // can be served partially, and passing that stream through costs almost
    // no CPU. Reading 40+ MB chunk by chunk in JS (sliceStream) can exceed
    // the free plan's CPU limit and cut the response off.
    const partial = await fetch(mp3, {
      headers: { Range: `bytes=${startByte}-` },
      cf: { cacheEverything: true, cacheTtl: AUDIO_CACHE_TTL },
    });
    if (partial.status === 206) {
      upstream.body?.cancel();
      headers.set('X-Range-Debug', `t=${startSeconds}|${startByte}/${size}|native-206|${partial.headers.get('CF-Cache-Status') || 'none'}`);
      return new Response(partial.body, { status: 200, headers });
    }
    partial.body?.cancel();

    headers.set('X-Range-Debug', `t=${startSeconds}|${startByte}/${size}|sliced|${partial.status}`);
    return new Response(sliceStream(upstream.body, startByte, size - 1), { status: 200, headers });
  }

  const range = rangeHeader && size ? parseRange(rangeHeader, size) : null;
  // Debug aid: what the worker saw (requested range | file size | upstream status)
  headers.set('X-Range-Debug', `${rangeHeader || '-'}|${size}|${upstream.status}`);
  if (range === 'unsatisfiable') {
    upstream.body?.cancel();
    headers.set('Content-Range', `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  if (!range) {
    if (size) headers.set('Content-Length', String(size));
    return new Response(request.method === 'HEAD' ? null : upstream.body, { status: 200, headers });
  }

  // Upstream ignored the range (200, whole file): cut the slice ourselves.
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
  headers.set('Content-Length', String(range.end - range.start + 1));
  if (request.method === 'HEAD') {
    upstream.body?.cancel();
    return new Response(null, { status: 206, headers });
  }
  return new Response(sliceStream(upstream.body, range.start, range.end), { status: 206, headers });
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
  const upstream = await fetch(source, { cf: { cacheEverything: true, cacheTtl: AUDIO_CACHE_TTL } });
  const data = upstream.ok ? await upstream.json() : null;
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
    return Math.round(Math.max(...samples.slice(from, to)) * 1000) / 1000;
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
    if (data?.mountId) mountId = String(data.mountId);
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
  const stream = live.urlAudio.find((item) => item.type.includes(wantOgg ? 'ogg' : 'mpeg')) || live.urlAudio[0];
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
