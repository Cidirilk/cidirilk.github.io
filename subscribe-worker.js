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
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
// The form contains only an email address, honeypot value, and Turnstile token.
// Keep the accepted request deliberately small so malformed requests cannot make
// the Worker parse an unbounded body.
const MAX_REQUEST_BYTES = 4 * 1024;
const MAX_TURNSTILE_TOKEN_LEN = 2 * 1024;
const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const isAllowedOrigin = (origin) =>
  ALLOWED_ORIGINS.includes(origin) || LOCAL_ORIGIN_RE.test(origin);

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

const readJsonBody = async (request) => {
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return { error: 'unsupported_media_type' };
  }

  const contentLength = request.headers.get('Content-Length');
  if (
    contentLength &&
    (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_REQUEST_BYTES)
  ) {
    return { error: 'body_too_large' };
  }

  if (!request.body) return { error: 'bad_request' };

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return { error: 'body_too_large' };
      }
      chunks.push(value);
    }
  } catch (err) {
    return { error: 'bad_request' };
  } finally {
    reader.releaseLock();
  }

  try {
    const data = JSON.parse(new TextDecoder().decode(concatChunks(chunks, size)));
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { error: 'bad_request' };
    }
    return { data };
  } catch (err) {
    return { error: 'bad_request' };
  }
};

const concatChunks = (chunks, size) => {
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
};

const applyRateLimit = async (rateLimit, ip) => {
  const key = `rl:${ip}`;
  try {
    const storedCount = await rateLimit.get(key);
    const count = storedCount === null ? 0 : Number(storedCount);
    if (!Number.isSafeInteger(count) || count < 0) {
      console.error('rate_limit_invalid_counter');
      return { ok: false, status: 503 };
    }
    if (count >= 5) return { ok: false, status: 429 };

    await rateLimit.put(key, String(count + 1), { expirationTtl: 60 });
    return { ok: true };
  } catch (err) {
    // Do not accept subscriptions without the configured abuse control when KV
    // is unavailable. The detailed storage error stays out of the response.
    console.error('rate_limit_exception', err && err.message);
    return { ok: false, status: 503 };
  }
};

export default {
  async fetch(request, env) {
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

    const parsed = await readJsonBody(request);
    if (parsed.error) {
      const status = parsed.error === 'unsupported_media_type'
        ? 415
        : parsed.error === 'body_too_large'
          ? 413
          : 400;
      return json({ ok: false, error: parsed.error }, status, origin);
    }
    const { data } = parsed;

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
      const rateLimit = await applyRateLimit(env.RATE_LIMIT, ip);
      if (!rateLimit.ok) {
        if (rateLimit.status === 429) {
          return json({ ok: false, error: 'rate_limited' }, 429, origin);
        }
        return json({ ok: false, error: 'service_unavailable' }, 503, origin);
      }
    }

    // Cloudflare Turnstile: verify the challenge token server-side before doing
    // anything with the email. Fails closed (no secret or bad token => reject).
    const token = data && typeof data.token === 'string' ? data.token.trim() : '';
    if (
      !token ||
      token.length > MAX_TURNSTILE_TOKEN_LEN ||
      !env.TURNSTILE_SECRET_KEY
    ) {
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
