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
 *   RATE_LIMIT             (KV)      enables per-IP rate limiting when bound
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
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const isAllowedOrigin = (origin) =>
  ALLOWED_ORIGINS.includes(origin) || LOCAL_ORIGIN_RE.test(origin);

const cors = (origin) => {
  const allow = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
};

const json = (body, status, origin) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405, origin);
    }
    if (origin && !isAllowedOrigin(origin)) {
      return json({ ok: false, error: 'forbidden' }, 403, origin);
    }

    let data;
    try {
      data = await request.json();
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

    // Optional per-IP rate limit (enabled only when a RATE_LIMIT KV is bound).
    if (env.RATE_LIMIT) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const key = `rl:${ip}`;
      const count = parseInt((await env.RATE_LIMIT.get(key)) || '0', 10);
      if (count >= 5) {
        return json({ ok: false, error: 'rate_limited' }, 429, origin);
      }
      await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 60 });
    }

    // Cloudflare Turnstile: verify the challenge token server-side before doing
    // anything with the email. Fails closed (no secret or bad token => reject).
    const token = data && typeof data.token === 'string' ? data.token : '';
    if (!token || !env.TURNSTILE_SECRET_KEY) {
      return json({ ok: false, error: 'failed_captcha' }, 403, origin);
    }
    try {
      const verifyBody = new URLSearchParams();
      verifyBody.append('secret', env.TURNSTILE_SECRET_KEY);
      verifyBody.append('response', token);
      const clientIp = request.headers.get('CF-Connecting-IP');
      if (clientIp) verifyBody.append('remoteip', clientIp);

      const verifyResp = await fetch(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        body: verifyBody,
      });
      const verify = await verifyResp.json();
      if (!verify.success) {
        console.error('turnstile_failed', JSON.stringify(verify['error-codes'] || []));
        return json({ ok: false, error: 'failed_captcha' }, 403, origin);
      }
    } catch (err) {
      console.error('turnstile_exception', err && err.message);
      return json({ ok: false, error: 'failed_captcha' }, 403, origin);
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
        return json({ ok: true, already: true }, 200, origin);
      }

      console.error('brevo_error', resp.status, code);
      return json({ ok: false, error: 'provider_error' }, 502, origin);
    } catch (err) {
      console.error('subscribe_exception', err && err.message);
      return json({ ok: false, error: 'provider_error' }, 502, origin);
    }
  },
};
