/**
 * Cloudflare Worker: CIDIRILK email subscription proxy
 * ---------------------------------------------------
 * Keeps the Brevo API key server-side so the static GitHub Pages site never
 * exposes any secret. The browser only ever talks to this Worker.
 *
 * Flow: browser POSTs { email, company } -> this Worker validates, traps bots,
 * (optionally) rate limits, then calls Brevo's double opt-in endpoint. Brevo
 * emails the visitor a confirmation link; only confirmed contacts join the list.
 *
 * Deploy (see subscribe-worker.toml):
 *   wrangler secret put BREVO_API_KEY -c subscribe-worker.toml
 *   wrangler deploy -c subscribe-worker.toml
 *
 * Required env (set in subscribe-worker.toml [vars], key via secret):
 *   BREVO_API_KEY          (secret)  Brevo API v3 key
 *   BREVO_LIST_ID          (var)     numeric id of the target contact list
 *   BREVO_DOI_TEMPLATE_ID  (var)     numeric id of the DOI confirmation template
 *   DOI_REDIRECT_URL       (var)     where Brevo sends users after confirming
 *   TURNSTILE_SECRET_KEY   (secret)  Cloudflare Turnstile secret key
 * Optional:
 *   SUBSCRIBE_LIMITER      (ratelimit binding) per-IP limit checked first;
 *                          no KV writes, so it cannot be exhausted by spam
 *   RATE_LIMIT             (KV)      fallback per-IP limit, only counted
 *                                    after Turnstile passes; fails open
 *   ALLOW_LOCAL_ORIGINS    (var)     "true" only for `wrangler dev` (.dev.vars):
 *                                    accepts localhost origins and skips the
 *                                    Turnstile hostname check (test keys)
 *
 * Set the Turnstile secret:
 *   wrangler secret put TURNSTILE_SECRET_KEY -c subscribe-worker.toml
 */

const ALLOWED_ORIGINS = [
  'https://cidirilk.com',
  'https://www.cidirilk.com',
  'https://cidirilk.github.io',
];
// Local dev servers (Live Server, http-server, vite, etc.) on any port.
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const MAX_BODY_BYTES = 4096;
const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
// Hostnames the Turnstile widget may be solved on (production)
const TURNSTILE_HOSTNAMES = ['cidirilk.com', 'www.cidirilk.com', 'cidirilk.github.io'];
// Must match data-action on #subscribeTurnstile in docs/index.html
const TURNSTILE_ACTION = 'turnstile-spin-v1';

// Set per request from env (module scope keeps the helpers below simple)
let allowLocalOrigins = false;

const isAllowedOrigin = (origin) =>
  ALLOWED_ORIGINS.includes(origin) || (allowLocalOrigins && LOCAL_ORIGIN_RE.test(origin));

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  Vary: 'Origin',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

const json = (body, status, origin) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(isAllowedOrigin(origin) ? cors(origin) : {}),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

export default {
  async fetch(request, env) {
    allowLocalOrigins = env.ALLOW_LOCAL_ORIGINS === 'true';
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      if (!isAllowedOrigin(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (!isAllowedOrigin(origin)) {
      return json({ ok: false, error: 'forbidden' }, 403, origin);
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405, origin);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    // First line of defence, before any work: Cloudflare's rate limiter.
    // It keeps its counters outside KV, so spam cannot burn the daily KV
    // write quota and take sign-ups down for everyone.
    if (env.SUBSCRIBE_LIMITER) {
      try {
        const { success } = await env.SUBSCRIBE_LIMITER.limit({ key: ip });
        if (!success) return json({ ok: false, error: 'rate_limited' }, 429, origin);
      } catch (err) {
        console.error('ratelimit_exception', err && err.message);
      }
    }

    // Small JSON bodies only
    const contentType = request.headers.get('Content-Type') || '';
    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (!contentType.includes('application/json') || contentLength > MAX_BODY_BYTES) {
      return json({ ok: false, error: 'bad_request' }, 400, origin);
    }

    let data;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) {
        return json({ ok: false, error: 'bad_request' }, 400, origin);
      }
      data = JSON.parse(raw);
    } catch (err) {
      return json({ ok: false, error: 'bad_request' }, 400, origin);
    }

    // Honeypot: real users never see the `company` field. If it is filled,
    // silently pretend success so bots get no signal.
    if (data && typeof data.company === 'string' && data.company.trim() !== '') {
      return json({ ok: true }, 200, origin);
    }

    const email = (data && typeof data.email === 'string' ? data.email : '')
      .trim()
      .toLowerCase();
    if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
      return json({ ok: false, error: 'invalid_email' }, 422, origin);
    }

    // Cloudflare Turnstile: verify the challenge token server-side before doing
    // anything with the email. Fails closed (no secret or bad token => reject).
    const token = data && typeof data.token === 'string' ? data.token : '';
    if (!token || token.length > 2048 || !env.TURNSTILE_SECRET_KEY) {
      return json({ ok: false, error: 'failed_captcha' }, 403, origin);
    }
    try {
      const verifyBody = new URLSearchParams();
      verifyBody.append('secret', env.TURNSTILE_SECRET_KEY);
      verifyBody.append('response', token);
      if (ip !== 'unknown') verifyBody.append('remoteip', ip);

      const verifyResp = await fetch(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        body: verifyBody,
      });
      const verify = await verifyResp.json();
      if (!verify.success) {
        console.error('turnstile_failed', JSON.stringify(verify['error-codes'] || []));
        return json({ ok: false, error: 'failed_captcha' }, 403, origin);
      }
      // The token must come from this site's widget, not one embedded elsewhere
      // with the same sitekey. (Test keys report example.com, so local dev skips this.)
      if (!allowLocalOrigins) {
        const hostOk = TURNSTILE_HOSTNAMES.includes(String(verify.hostname || ''));
        const actionOk = !verify.action || verify.action === TURNSTILE_ACTION;
        if (!hostOk || !actionOk) {
          console.error('turnstile_mismatch', verify.hostname, verify.action);
          return json({ ok: false, error: 'failed_captcha' }, 403, origin);
        }
      }
    } catch (err) {
      console.error('turnstile_exception', err && err.message);
      return json({ ok: false, error: 'failed_captcha' }, 403, origin);
    }

    // Fallback per-IP limit (KV). Counted only after Turnstile passed, so it
    // costs a human-solved challenge per write; fails open if KV errors out.
    if (env.RATE_LIMIT && !env.SUBSCRIBE_LIMITER) {
      try {
        const key = `rl:${ip}`;
        const count = parseInt((await env.RATE_LIMIT.get(key)) || '0', 10);
        if (count >= 5) {
          return json({ ok: false, error: 'rate_limited' }, 429, origin);
        }
        await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 60 });
      } catch (err) {
        console.error('kv_ratelimit_exception', err && err.message);
      }
    }

    try {
      const payload = {
        email,
        includeListIds: [parseInt(env.BREVO_LIST_ID, 10)],
        templateId: parseInt(env.BREVO_DOI_TEMPLATE_ID, 10),
        redirectionUrl: env.DOI_REDIRECT_URL,
      };
      const resp = await fetch(
        'https://api.brevo.com/v3/contacts/doubleOptinConfirmation',
        {
          method: 'POST',
          headers: {
            'api-key': env.BREVO_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (resp.status === 201 || resp.status === 204) {
        return json({ ok: true }, 200, origin);
      }

      // An already-known contact returns 400 duplicate_parameter; treat that as
      // success so we never reveal who is or is not already subscribed.
      const text = await resp.text();
      let code = '';
      try {
        code = JSON.parse(text).code || '';
      } catch (err) {
        /* non-JSON error body */
      }
      if (code === 'duplicate_parameter') {
        // Same answer as a new sign-up: never reveal who is subscribed
        return json({ ok: true }, 200, origin);
      }

      console.error('brevo_error', resp.status, code);
      return json({ ok: false, error: 'provider_error' }, 502, origin);
    } catch (err) {
      console.error('subscribe_exception', err && err.message);
      return json({ ok: false, error: 'provider_error' }, 502, origin);
    }
  },
};
